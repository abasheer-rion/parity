// The browser side of live data (DEC-0052): one WebSocket per source to our edge
// (/live/ws), shared by every chart and quote on the page. Updates are queued as they
// arrive and handed to listeners once per animation frame, so a busy feed never makes
// the page stutter. Every update carries the edge's times; this module adds the
// browser's receive and paint times (in the edge's clock) and keeps the latest hops per
// source for the latency badge. A small random sample of hops goes to /rum every 30 s
// so the Latency page can show p50, p95 and p99 per feed. Do Not Track and Global
// Privacy Control turn that sampling off; the badge still works.
import { endpointUrl, optedOut } from "../rum";
import { ClockOffset, hops, Reservoir, type HopTimes } from "./latency";
import { BOARD, bookKey, parseServer, tradesKey, type BoardRow, type FeedType, type Level, type ServerMsg, type Tick, type TradeRow } from "./protocol";
import { isInternal } from "./sources";
import { holdable } from "./pause";
import { TRADE_ORIGIN } from "../meta";

export type LineState = "connecting" | "open" | "closed";

export interface FeedStatus {
  src: string;
  feed: FeedType | null;
  delay?: number;
  /** Our socket to the edge. */
  line: LineState;
  /** The edge's connection to the source. */
  upstream: "up" | "connecting" | "down";
  why?: string;
  /** Hops of the newest update drawn, and its exchange time (edge clock). */
  last: HopTimes | null;
  lastTe: number | null;
  /** Edge time minus browser time, and the round trip it was measured on. */
  offset: number;
  rtt: number;
  /** Updates lost between the edge and here (sequence gaps). */
  gaps: number;
  ticks: number;
  /** Team only (internal use): the feed is real-time and not for the public. */
  internal: boolean;
  /** Exchange to screen over the last 200 timed updates: median and 95th percentile, ms. */
  p50: number | null;
  p95: number | null;
  /** Times our line to the edge dropped and came back since the page opened. */
  reconnects: number;
  /** The edge said this person may not see this feed (not on the team, or signed out). */
  refused?: boolean;
}

export interface BookSnap { b: Level[]; a: Level[]; te: number; recv: number }

type TickFn = (t: Tick, recv: number) => void;
type BookFn = (b: BookSnap) => void;
type TradesFn = (rows: TradeRow[]) => void;
export type BoardFn = (rows: BoardRow[], full: boolean, sp?: Record<string, number[]>) => void;

/** The person's access token, for team-only feeds (the desktop app has no cookie for /live). */
async function accessToken(): Promise<string | null> {
  try {
    const { supabase } = await import("../../auth/client");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** A rolling window of the last n values, for p50 and p95. */
class Window {
  private xs: number[] = [];
  constructor(private n = 200) {}
  add(v: number) { this.xs.push(v); if (this.xs.length > this.n) this.xs.shift(); }
  q(p: number): number | null {
    if (!this.xs.length) return null;
    const s = [...this.xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
  }
}

/** Where /live lives: this site, or the main address for the desktop app. Local dev has no
 *  /live unless VITE_LIVE_ORIGIN points at a deploy; then it returns null and nothing connects. */
export function liveOrigin(loc: Pick<Location, "protocol" | "host" | "hostname"> = location): string | null {
  const local = loc.hostname === "localhost" || loc.hostname === "127.0.0.1";
  if ((loc.protocol === "https:" || loc.protocol === "http:") && !local) return `${loc.protocol === "https:" ? "wss" : "ws"}://${loc.host}`;
  // Local dev can point at a preview deploy: VITE_LIVE_ORIGIN=wss://<id>.parity-research.pages.dev
  const dev = typeof import.meta !== "undefined" ? (import.meta.env?.VITE_LIVE_ORIGIN as string | undefined) : undefined;
  if (local) return dev || null;
  return TRADE_ORIGIN.replace(/^https:/, "wss:");
}

export class SourceLine {
  status: FeedStatus;
  private ws: WebSocket | null = null;
  private subs = new Map<string, Set<TickFn>>();
  private bookFns = new Map<string, Set<BookFn>>();
  private tradeFns = new Map<string, Set<TradesFn>>();
  private boardFns = new Set<BoardFn>();
  private other: { m: ServerMsg; recv: number }[] = [];
  private e2e = new Window();
  private opened = 0;
  private statusFns = new Set<(s: FeedStatus) => void>();
  private queue: { t: Tick; recv: number }[] = [];
  private frame = 0;
  private frameIsTimer = false;
  private clock = new ClockOffset();
  private seq = new Map<string, number>();
  private retry = 0;
  private timer = 0;
  private pinger = 0;
  private idle = 0;

  constructor(readonly src: string, private reservoir: Reservoir | null) {
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => this.onHidden());
    this.status = { src, feed: null, line: "closed", upstream: "connecting", last: null, lastTe: null, offset: 0, rtt: Infinity, gaps: 0, ticks: 0, internal: isInternal(src), p50: null, p95: null, reconnects: 0 };
  }

  /** Every key this page holds on this source: symbols, books, trades lists and the overview. */
  private keys(): string[] {
    return [...this.subs.keys(), ...[...this.bookFns.keys()].map(bookKey), ...[...this.tradeFns.keys()].map(tradesKey), ...(this.boardFns.size ? [BOARD] : [])];
  }

  /** Add a listener under a key; the first listener subscribes, the last one to leave unsubscribes. */
  private hold<F>(map: Map<string, Set<F>>, key: string, wire: string, fn: F, gone?: () => void): () => void {
    let set = map.get(key);
    const fresh = !set;
    if (!set) { set = new Set(); map.set(key, set); }
    set.add(fn);
    window.clearTimeout(this.idle);
    if (!this.ws) this.open();
    else if (fresh) this.send({ op: "sub", s: [wire] });
    return () => {
      const s = map.get(key);
      if (!s) return;
      s.delete(fn);
      if (s.size) return;
      map.delete(key);
      gone?.();
      this.send({ op: "unsub", s: [wire] });
      this.idleSoon();
    };
  }

  /** Close the line a little after the last listener leaves, so switching symbols reuses it. */
  private idleSoon() {
    if (!this.keys().length) this.idle = window.setTimeout(() => this.close(), 20_000);
  }

  subscribe(symbol: string, fn: TickFn): () => void {
    return this.hold(this.subs, symbol, symbol, fn, () => this.seq.delete(symbol));
  }
  subscribeBook(symbol: string, fn: BookFn): () => void { return this.hold(this.bookFns, symbol, bookKey(symbol), fn); }
  subscribeTrades(symbol: string, fn: TradesFn): () => void { return this.hold(this.tradeFns, symbol, tradesKey(symbol), fn); }
  subscribeBoard(fn: BoardFn): () => void {
    const fresh = !this.boardFns.size;
    this.boardFns.add(fn);
    window.clearTimeout(this.idle);
    if (!this.ws) this.open();
    else if (fresh) this.send({ op: "sub", s: [BOARD] });
    return () => {
      this.boardFns.delete(fn);
      if (this.boardFns.size) return;
      this.send({ op: "unsub", s: [BOARD] });
      this.idleSoon();
    };
  }

  onStatus(fn: (s: FeedStatus) => void): () => void {
    this.statusFns.add(fn);
    fn(this.status);
    return () => { this.statusFns.delete(fn); };
  }

  private emit(patch: Partial<FeedStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.statusFns) fn(this.status);
  }

  private send(m: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private opening = false;
  private open() {
    const origin = liveOrigin();
    if (!origin) { this.emit({ line: "closed", upstream: "down", why: "live data runs on the deployed site" }); return; }
    if (this.opening) return;
    this.opening = true;
    this.emit({ line: "connecting" });
    // Team-only feeds: the edge checks the sign-in. On the site the cookie carries it; the
    // token also rides as a sub-protocol for the desktop app, which has no cookie here.
    const go = (token: string | null) => {
      this.opening = false;
      if (this.ws || !this.keys().length) return;
      let ws: WebSocket;
      const url = `${origin}/live/ws?src=${encodeURIComponent(this.src)}`;
      try { ws = token ? new WebSocket(url, ["parity-live", `bearer.${token}`]) : new WebSocket(url); } catch { this.later(); return; }
      this.wire(ws);
    };
    if (this.status.internal) void accessToken().then(go); else go(null);
  }

  private wire(ws: WebSocket) {
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      if (this.opened++ > 0) this.status.reconnects += 1;
      this.emit({ line: "open", refused: false });
      const all = this.keys();
      if (all.length) this.send({ op: "sub", s: all });
      this.ping();
      window.clearInterval(this.pinger);
      this.pinger = window.setInterval(() => this.ping(), 15_000);
    };
    ws.onmessage = (e) => {
      const recvLocal = Date.now();
      const m = parseServer(typeof e.data === "string" ? e.data : "");
      if (m) this.handle(m, recvLocal);
    };
    ws.onclose = (e) => {
      window.clearInterval(this.pinger);
      if (this.ws !== ws) return;
      this.ws = null;
      // 4003: not on the team (or signed out); retrying will not help until that changes.
      if (e.code === 4003) { this.emit({ line: "closed", upstream: "down", why: "Team only", refused: true }); return; }
      this.emit({ line: "closed" });
      // 4001: the sign-in expired; reconnect at once with a fresh token.
      if (e.code === 4001) { this.retry = 0; this.open(); return; }
      if (this.keys().length) this.later();
    };
    ws.onerror = () => { try { ws.close(); } catch { /* already closed */ } };
  }

  private ping() { this.send({ op: "ping", c: Date.now() }); }

  private later() {
    window.clearTimeout(this.timer);
    const wait = Math.min(30_000, 500 * 2 ** this.retry) * (0.75 + Math.random() * 0.5);
    this.retry += 1;
    this.timer = window.setTimeout(() => { if (this.keys().length && !this.ws) this.open(); }, wait);
  }

  private close() {
    window.clearInterval(this.pinger);
    window.clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(1000); } catch { /* ignore */ }
    this.emit({ line: "closed" });
  }

  private handle(m: ServerMsg, recvLocal: number) {
    if (m.op === "pong") {
      this.clock.add(m.c, m.ts, recvLocal);
      this.emit({ offset: this.clock.offset, rtt: this.clock.rtt });
    } else if (m.op === "hello") {
      // A first guess at the offset until the first pong comes back.
      if (!Number.isFinite(this.clock.rtt)) this.clock.offset = m.ts - recvLocal;
      this.emit({ feed: m.feed, delay: m.delay, internal: !!m.internal || isInternal(this.src) });
    } else if (m.op === "b" || m.op === "x" || m.op === "r") {
      this.other.push({ m, recv: this.clock.now(recvLocal) });
      this.schedule();
    } else if (m.op === "state") {
      this.emit({ upstream: m.up, why: m.why });
    } else if (m.op === "t") {
      const recv = this.clock.now(recvLocal);
      let gaps = 0;
      for (const t of m.d) {
        const prev = this.seq.get(t.s);
        if (!t.r && prev != null && t.q > prev + 1) gaps += t.q - prev - 1;
        this.seq.set(t.s, t.q);
        this.queue.push({ t, recv });
      }
      if (gaps) this.status.gaps += gaps;
      this.schedule();
    }
  }

  /**
   * Hands queued updates over once per frame. A hidden page (a background tab, a minimised or
   * hidden desktop window) draws no frames, so there it uses a timer instead; before, the
   * queue grew with every message until the page was looked at again (REF-0025).
   */
  private schedule() {
    if (this.frame) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      this.frameIsTimer = true;
      this.frame = window.setTimeout(() => this.flush(), 250);
    } else {
      this.frameIsTimer = false;
      this.frame = window.requestAnimationFrame(() => this.flush());
    }
  }

  /** A frame asked for just before the page was hidden would never come: use the timer. */
  private onHidden() {
    if (document.visibilityState !== "hidden" || !this.frame || this.frameIsTimer) return;
    window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.schedule();
  }

  /** Once per frame: hand queued updates to listeners, then note how long the trip took. */
  private flush() {
    this.frame = 0;
    const other = this.other;
    this.other = [];
    if (other.length) this.flushOther(other);
    const batch = this.queue;
    this.queue = [];
    if (!batch.length) return;
    for (const { t, recv } of batch) for (const fn of this.subs.get(t.s) ?? []) fn(t, recv);
    const paint = this.clock.now();
    const timed = batch.filter((x) => !x.t.r);
    const newest = batch.reduce((a, b) => (b.t.te >= a.t.te ? b : a));
    if (!timed.length) { this.emit({ lastTe: Math.max(newest.t.te, this.status.lastTe ?? 0), ticks: this.status.ticks + batch.length }); return; }
    const nt = timed.reduce((a, b) => (b.t.te >= a.t.te ? b : a));
    const h = hops(nt.t, nt.recv, paint);
    for (const x of timed) this.e2e.add(Math.max(0, paint - x.t.te));
    if (this.reservoir) for (const x of timed) {
      const hx = hops(x.t, x.recv, paint);
      for (const k of Object.keys(hx) as (keyof HopTimes)[]) this.reservoir.add(`${this.src}/${k}`, hx[k]);
    }
    this.emit({ last: h, lastTe: Math.max(newest.t.te, this.status.lastTe ?? 0), ticks: this.status.ticks + batch.length, p50: this.e2e.q(0.5), p95: this.e2e.q(0.95) });
  }

  /** Books, trades lists and overview rows, once per frame: only the newest book per symbol. */
  private flushOther(items: { m: ServerMsg; recv: number }[]) {
    const books = new Map<string, BookSnap>();
    let newest = 0;
    for (const { m, recv } of items) {
      if (m.op === "b") { books.set(m.s, { b: m.b, a: m.a, te: m.te, recv }); newest = Math.max(newest, m.te); }
      else if (m.op === "x") { for (const fn of this.tradeFns.get(m.s) ?? []) fn(m.d); for (const r of m.d) newest = Math.max(newest, r[0]); }
      else if (m.op === "r") { for (const fn of this.boardFns) fn(m.d, !!m.full, m.sp); for (const r of m.d) newest = Math.max(newest, r[4]); }
    }
    for (const [s, b] of books) for (const fn of this.bookFns.get(s) ?? []) fn(b);
    // A page that only shows books or the overview still gets a data age on its badge.
    if (newest > (this.status.lastTe ?? 0)) this.emit({ lastTe: newest });
  }

  /** Counters for the latency tables: reconnects and lost updates since the last report. */
  drainCounts(): { reconnects: number; gaps: number } {
    const out = { reconnects: this.status.reconnects - this.sentReconnects, gaps: this.status.gaps - this.sentGaps };
    this.sentReconnects = this.status.reconnects;
    this.sentGaps = this.status.gaps;
    return out;
  }
  private sentReconnects = 0;
  private sentGaps = 0;
}

const lines = new Map<string, SourceLine>();
let reservoir: Reservoir | null | undefined;

function sampler(): Reservoir | null {
  if (reservoir !== undefined) return reservoir;
  reservoir = typeof window !== "undefined" && !optedOut() ? new Reservoir(4) : null;
  if (reservoir) {
    const send = () => sendSample(reservoir!);
    window.setInterval(send, 30_000);
    addEventListener("pagehide", send);
  }
  return reservoir;
}

/** The rum app name for live samples (any app may show live data; the endpoint names the feed). */
let rumApp = "trade";
export function setLiveApp(name: "trade" | "sim" | "lab" | "product") { rumApp = name; }

function sendSample(r: Reservoir) {
  const rows = r.drain().slice(0, 34);
  // Reconnects and lost updates per feed, as counts for the Latency page (metric "gap").
  const counts = [...lines.values()].flatMap((l) => {
    const c = l.drainCounts();
    return [...(c.reconnects ? [{ m: "gap", e: `trade:live/${l.src}/reconnect`, v: c.reconnects }] : []), ...(c.gaps ? [{ m: "gap", e: `trade:live/${l.src}/lost`, v: c.gaps }] : [])];
  }).slice(0, 6);
  if (!rows.length && !counts.length) return;
  const ev = [...rows.map(({ key, v }) => ({ m: "lag", e: `trade:live/${key}`.slice(0, 66), v })), ...counts];
  try { navigator.sendBeacon?.(endpointUrl(), new Blob([JSON.stringify({ a: rumApp, ev })], { type: "text/plain" })); } catch { /* never breaks the page */ }
}

function line(src: string): SourceLine {
  let l = lines.get(src);
  if (!l) { l = new SourceLine(src, sampler()); lines.set(src, l); }
  return l;
}

/** Listen to one symbol of one source. Returns the function that stops listening. */
export function subscribeTicks(src: string, symbol: string, fn: TickFn): () => void {
  const h = holdable(fn, "all");
  const off = line(src).subscribe(symbol, h.call);
  return () => { h.release(); off(); };
}

/** The order book of one symbol (top levels, at most once per frame). */
export function subscribeBook(src: string, symbol: string, fn: BookFn): () => void {
  const h = holdable(fn, "last");
  const off = line(src).subscribeBook(symbol, h.call);
  return () => { h.release(); off(); };
}

/** The recent trades of one symbol, as they arrive (batched per frame). */
export function subscribeTrades(src: string, symbol: string, fn: TradesFn): () => void {
  const h = holdable(fn, "all");
  const off = line(src).subscribeTrades(symbol, h.call);
  return () => { h.release(); off(); };
}

/** The market overview of one source: a full list first, then changed rows. */
export function subscribeBoard(src: string, fn: BoardFn): () => void {
  const h = holdable(fn, "all");
  const off = line(src).subscribeBoard(h.call);
  return () => { h.release(); off(); };
}

/** Listen to a source's status (line, upstream, last hops). Called at once with the current one. */
export function subscribeStatus(src: string, fn: (s: FeedStatus) => void): () => void {
  return line(src).onStatus(fn);
}
