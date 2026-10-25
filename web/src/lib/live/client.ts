// The browser side of live data (DEC-0049): one WebSocket per source to our edge
// (/live/ws), shared by every chart and quote on the page. Updates are queued as they
// arrive and handed to listeners once per animation frame, so a busy feed never makes
// the page stutter. Every update carries the edge's times; this module adds the
// browser's receive and paint times (in the edge's clock) and keeps the latest hops per
// source for the latency badge. A small random sample of hops goes to /rum every 30 s
// so the Latency page can show p50, p95 and p99 per feed. Do Not Track and Global
// Privacy Control turn that sampling off; the badge still works.
import { endpointUrl, optedOut } from "../rum";
import { ClockOffset, hops, Reservoir, type HopTimes } from "./latency";
import { parseServer, type FeedType, type ServerMsg, type Tick } from "./protocol";

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
}

type TickFn = (t: Tick, recv: number) => void;

/** Where /live lives: this site, or the main address for the desktop app and local dev. */
export function liveOrigin(loc: Pick<Location, "protocol" | "host" | "hostname"> = location): string {
  const local = loc.hostname === "localhost" || loc.hostname === "127.0.0.1";
  if ((loc.protocol === "https:" || loc.protocol === "http:") && !local) return `${loc.protocol === "https:" ? "wss" : "ws"}://${loc.host}`;
  return "wss://trade.endyland.com";
}

class SourceLine {
  status: FeedStatus;
  private ws: WebSocket | null = null;
  private subs = new Map<string, Set<TickFn>>();
  private statusFns = new Set<(s: FeedStatus) => void>();
  private queue: { t: Tick; recv: number }[] = [];
  private frame = 0;
  private clock = new ClockOffset();
  private seq = new Map<string, number>();
  private retry = 0;
  private timer = 0;
  private pinger = 0;
  private idle = 0;

  constructor(readonly src: string, private reservoir: Reservoir | null) {
    this.status = { src, feed: null, line: "closed", upstream: "connecting", last: null, lastTe: null, offset: 0, rtt: Infinity, gaps: 0, ticks: 0 };
  }

  subscribe(symbol: string, fn: TickFn): () => void {
    let set = this.subs.get(symbol);
    const fresh = !set;
    if (!set) { set = new Set(); this.subs.set(symbol, set); }
    set.add(fn);
    window.clearTimeout(this.idle);
    if (!this.ws) this.open();
    else if (fresh) this.send({ op: "sub", s: [symbol] });
    return () => {
      const s = this.subs.get(symbol);
      if (!s) return;
      s.delete(fn);
      if (s.size) return;
      this.subs.delete(symbol);
      this.seq.delete(symbol);
      this.send({ op: "unsub", s: [symbol] });
      // Close the line a little after the last chart leaves, so switching symbols reuses it.
      if (!this.subs.size) this.idle = window.setTimeout(() => this.close(), 20_000);
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

  private open() {
    this.emit({ line: "connecting" });
    let ws: WebSocket;
    try { ws = new WebSocket(`${liveOrigin()}/live/ws?src=${encodeURIComponent(this.src)}`); } catch { this.later(); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.emit({ line: "open" });
      const all = [...this.subs.keys()];
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
    ws.onclose = () => {
      window.clearInterval(this.pinger);
      if (this.ws === ws) { this.ws = null; this.emit({ line: "closed" }); if (this.subs.size) this.later(); }
    };
    ws.onerror = () => { try { ws.close(); } catch { /* already closed */ } };
  }

  private ping() { this.send({ op: "ping", c: Date.now() }); }

  private later() {
    window.clearTimeout(this.timer);
    const wait = Math.min(30_000, 500 * 2 ** this.retry) * (0.75 + Math.random() * 0.5);
    this.retry += 1;
    this.timer = window.setTimeout(() => { if (this.subs.size && !this.ws) this.open(); }, wait);
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
      this.emit({ feed: m.feed, delay: m.delay });
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
      if (!this.frame) this.frame = window.requestAnimationFrame(() => this.flush());
    }
  }

  /** Once per frame: hand queued updates to listeners, then note how long the trip took. */
  private flush() {
    this.frame = 0;
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
    if (this.reservoir) for (const x of timed) {
      const hx = hops(x.t, x.recv, paint);
      for (const k of Object.keys(hx) as (keyof HopTimes)[]) this.reservoir.add(`${this.src}/${k}`, hx[k]);
    }
    this.emit({ last: h, lastTe: Math.max(newest.t.te, this.status.lastTe ?? 0), ticks: this.status.ticks + batch.length });
  }
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
  const rows = r.drain().slice(0, 40);
  if (!rows.length) return;
  const ev = rows.map(({ key, v }) => ({ m: "lag", e: `trade:live/${key}`.slice(0, 66), v }));
  try { navigator.sendBeacon?.(endpointUrl(), new Blob([JSON.stringify({ a: rumApp, ev })], { type: "text/plain" })); } catch { /* never breaks the page */ }
}

function line(src: string): SourceLine {
  let l = lines.get(src);
  if (!l) { l = new SourceLine(src, sampler()); lines.set(src, l); }
  return l;
}

/** Listen to one symbol of one source. Returns the function that stops listening. */
export function subscribeTicks(src: string, symbol: string, fn: TickFn): () => void {
  return line(src).subscribe(symbol, fn);
}

/** Listen to a source's status (line, upstream, last hops). Called at once with the current one. */
export function subscribeStatus(src: string, fn: (s: FeedStatus) => void): () => void {
  return line(src).onStatus(fn);
}
