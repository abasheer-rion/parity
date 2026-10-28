// LiveHub, the fan-out (DEC-0052, DEC-0056, REF-0019 tier C): one Durable Object per source.
// It holds ONE connection to that source's feed, subscribed to the union of what its viewers
// want, and relays it to every viewer:
//   "SYM"    trades, conflated to at most four updates a second per symbol (charts, quotes)
//   "X:SYM"  the recent trades list, batched every 250 ms
//   "B:SYM"  the order book, top levels each side, at most four times a second
//   "*"      the market overview: every symbol the source lists, changed rows once a second
// Every message is stamped with the exchange time, our receive time and our send time. The
// upstream line opens with the first viewer and closes a minute after the last one leaves,
// so nothing runs (or is billed) while nobody watches.
//
// Team-only sources (terms allow internal use only): the site's /live/ws function checks the
// person's sign-in and the team list, then passes X-Parity-Team (when the sign-in expires).
// This object refuses an internal source's viewer without it, and closes a viewer's socket
// with code 4001 once that time passes, so a removed member is cut off within the hour.
//
// Viewers use the WebSocket Hibernation API (state.acceptWebSocket), so idle viewer sockets
// cost nothing. Caps: MAX_VIEWERS sockets, MAX_SUBS keys per socket and the adapter's
// maxUpstream symbols, so no viewer can make us flood a venue. GET /status is the log.
import { Conflator, type Trade } from "../../src/lib/live/conflate";
import { BOARD, baseOf, MAX_SUBS, parseClient, type BoardRow, type Level, type ServerMsg, type Tick, type TradeRow } from "../../src/lib/live/protocol";
import { adapterFor, type Adapter } from "./adapters";
import type { BoardPatch, BookUpdate, Parsed } from "./base";
import { sourceById } from "../../src/lib/live/sources";
import type { DurableObjectState, Env, WebSocketPairCtor, WorkerSocket } from "./types";

declare const WebSocketPair: WebSocketPairCtor;

const MAX_VIEWERS = 500;
const IDLE_CLOSE_MS = 60_000;
const STALL_MS = 45_000;
const SNAPSHOT_MS = 3_000;
const FLUSH_MS = 250;
const BOARD_MS = 1_000;
/** Overview sparklines: one point a minute, the last hour. */
const SPARK_EVERY = 60_000;
const SPARK_N = 60;
const BOOK_SHOWN = 20;
const X_MAX = 60;

interface Attachment { subs: string[]; at: number; until?: number }
interface Viewer { ws: WorkerSocket; subs: Set<string>; until?: number }
interface Book { bids: Map<number, number>; asks: Map<number, number>; te: number; tr: number }
interface Row { p: number; o?: number; c?: number; v?: number; te: number }

export class LiveHub {
  private adapter: Adapter | null = null;
  private src = "";
  /** The upstream line: a socket, or a source's own lines (Adapter.connect) behind the same two calls. */
  private up: Pick<WorkerSocket, "send" | "close"> | null = null;
  private lines: { state?(): string } | null = null;
  private upState: "up" | "connecting" | "down" = "down";
  private why = "";
  private ready = false;
  private upTrades = new Set<string>();
  private upBooks = new Set<string>();
  private boardOn = false;
  /** When each symbol was subscribed upstream: trades from before then are the source's
   *  catch-up snapshot, not live, and are dropped. */
  private subAt = new Map<string, number>();
  /** Newest exchange time relayed per symbol; a polled source repeats prices, which are skipped. */
  private lastTe = new Map<string, number>();
  private poller: ReturnType<typeof setInterval> | null = null;
  private boardPoller: ReturnType<typeof setInterval> | null = null;
  /** The newest update per symbol, sent at once to a viewer who subscribes later. */
  private lastTick = new Map<string, Tick>();
  private conflator = new Conflator();
  private timer: ReturnType<typeof setInterval> | null = null;
  private flusher: ReturnType<typeof setInterval> | null = null;
  private boardTimer: ReturnType<typeof setInterval> | null = null;
  private sparkTimer: ReturnType<typeof setInterval> | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;
  private idle: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;
  private lastUpMsg = 0;
  private books = new Map<string, Book>();
  private bookDirty = new Set<string>();
  private xbuf = new Map<string, TradeRow[]>();
  private board = new Map<string, Row>();
  private boardDirty = new Set<string>();
  private spark = new Map<string, number[]>();
  /** Symbols whose source sends its own sparkline (CoinGecko); not sampled here. */
  private ownSpark = new Set<string>();
  private sparkDirty = new Set<string>();
  private boardFullDue = false;
  private vcache: Viewer[] | null = null;
  private lastExpiry = 0;
  private stats = { started: Date.now(), viewersSeen: 0, upstreamOpens: 0, reconnects: 0, upstreamMsgs: 0, trades: 0, sent: 0, refused: 0, expired: 0, bookMsgs: 0, boardMsgs: 0, feedLagMs: [] as number[] };

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const src = url.searchParams.get("src") ?? "";
    if (!this.adapter) {
      this.adapter = adapterFor(src, this.env);
      this.src = src;
    }
    if (!this.adapter) return new Response("Unknown source", { status: 404 });
    if (url.pathname.endsWith("/status")) return this.status();
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket only", { status: 426 });
    // A team-only source needs the site's word that this viewer is on the team (DEC-0056).
    const until = Number(req.headers.get("X-Parity-Team") ?? "0");
    if (this.adapter.internal && !(until > Date.now())) {
      this.stats.refused += 1;
      return new Response("Team only", { status: 403 });
    }
    if (this.state.getWebSockets().length >= MAX_VIEWERS) {
      this.stats.refused += 1;
      return new Response("Too many viewers on this source right now", { status: 503 });
    }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.state.acceptWebSocket(server, [src]);
    server.serializeAttachment({ subs: [], at: Date.now(), ...(this.adapter.internal ? { until } : {}) } satisfies Attachment);
    this.vcache = null;
    this.stats.viewersSeen += 1;
    this.send(server, { op: "hello", src, feed: this.adapter.feed, delay: this.adapter.delayMin ?? sourceById(src)?.delayMin, ts: Date.now(), max: MAX_SUBS, ...(this.adapter.internal ? { internal: true } : {}) });
    this.send(server, { op: "state", up: this.upState, why: this.why || undefined, ts: Date.now() });
    // A browser that offered sub-protocols (the sign-in rides there for the desktop app) must hear one back.
    const offered = req.headers.get("Sec-WebSocket-Protocol");
    const headers = offered?.split(",").some((p) => p.trim() === "parity-live") ? { "Sec-WebSocket-Protocol": "parity-live" } : undefined;
    return new Response(null, { status: 101, webSocket: client, headers } as ResponseInit & { webSocket: WebSocket });
  }

  // ------------------------------------------------------------------ viewers

  async webSocketMessage(ws: WorkerSocket, raw: string | ArrayBuffer) {
    const m = parseClient(typeof raw === "string" ? raw : "");
    if (!m) return;
    // After hibernation the object starts fresh: the socket's tag names its source.
    if (!this.adapter) {
      const src = this.state.getTags?.(ws)?.[0] ?? "";
      this.adapter = adapterFor(src, this.env);
      this.src = src;
      if (!this.adapter) return;
    }
    this.expireViewers();
    if (this.adapter.internal && !(ws.deserializeAttachment() as Attachment | null)?.until) return;
    if (m.op === "ping") { this.send(ws, { op: "pong", c: m.c, ts: Date.now() }); return; }
    const att = (ws.deserializeAttachment() as Attachment | null) ?? { subs: [], at: Date.now() };
    const mine = new Set(att.subs);
    if (m.op === "sub") {
      for (const k of m.s) {
        if (mine.size >= MAX_SUBS) break;
        if (k === BOARD) { if (this.adapter.board) mine.add(k); else this.send(ws, { op: "err", why: "No market overview from this source" }); continue; }
        if (k.startsWith("B:") && !this.adapter.book) { this.send(ws, { op: "err", why: "No order book from this source" }); continue; }
        if (!this.adapter.allows(baseOf(k))) { this.send(ws, { op: "err", why: `${baseOf(k)} is not offered by this source` }); continue; }
        mine.add(k);
      }
    } else {
      for (const k of m.s) mine.delete(k);
    }
    ws.serializeAttachment({ ...att, subs: [...mine] } satisfies Attachment);
    this.vcache = null;
    if (m.op === "sub") this.catchUp(ws, m.s.filter((k) => mine.has(k)));
    this.reconcile();
  }

  /** What a new subscriber sees at once: the last price, the current book, the whole overview. */
  private catchUp(ws: WorkerSocket, keys: string[]) {
    const now = Date.now();
    const ticks = keys.flatMap((k) => (this.lastTick.has(k) ? [{ ...this.lastTick.get(k)!, r: 1 as const }] : []));
    if (ticks.length) this.send(ws, { op: "t", d: ticks });
    for (const k of keys) {
      if (k.startsWith("B:") && this.books.has(baseOf(k))) this.send(ws, this.bookMsg(baseOf(k), now));
      if (k === BOARD && this.board.size) this.send(ws, { op: "r", full: 1, d: this.boardRows([...this.board.keys()]), ts: now, sp: Object.fromEntries(this.spark), every: SPARK_EVERY });
    }
  }

  async webSocketClose(ws: WorkerSocket) { this.forget(ws); }
  async webSocketError(ws: WorkerSocket) { this.forget(ws); }

  private forget(ws: WorkerSocket) {
    try { ws.serializeAttachment({ subs: [], at: 0 }); } catch { /* closed */ }
    try { ws.close(1000); } catch { /* closed */ }
    this.vcache = null;
    this.reconcile();
  }

  private viewers(): Viewer[] {
    if (this.vcache) return this.vcache;
    this.vcache = this.state.getWebSockets().map((ws) => {
      const w = ws as WorkerSocket;
      const a = w.deserializeAttachment() as Attachment | null;
      return { ws: w, subs: new Set(a?.subs ?? []), until: a?.until };
    });
    return this.vcache;
  }

  /** Close team viewers whose sign-in has expired (code 4001: sign in again). True if any closed. */
  private expireViewers(): boolean {
    if (!this.adapter?.internal) return false;
    const now = Date.now();
    let n = 0;
    for (const v of this.viewers()) {
      if (v.until && v.until < now) {
        n += 1;
        try { v.ws.serializeAttachment({ subs: [], at: 0 }); v.ws.close(4001, "Sign-in expired"); } catch { /* gone */ }
      }
    }
    if (n) { this.stats.expired += n; this.vcache = null; this.reconcile(); }
    return n > 0;
  }

  private wanted() {
    const cap = this.adapter?.maxUpstream ?? 60;
    const trades = new Set<string>(), books = new Set<string>();
    let board = false;
    for (const v of this.viewers()) {
      for (const k of v.subs) {
        if (k === BOARD) board = true;
        else if (k.startsWith("B:")) { if (books.size < cap) books.add(baseOf(k)); }
        else if (trades.size < cap) trades.add(baseOf(k));
      }
    }
    return { trades, books, board, any: board || trades.size > 0 || books.size > 0 };
  }

  /** Bring the upstream line and its subscriptions in line with what viewers want. */
  private reconcile() {
    const want = this.wanted();
    const a = this.adapter!;
    if (!want.any) {
      if (!this.idle && (this.up || this.poller || this.boardPoller)) this.idle = setTimeout(() => this.closeUpstream("nobody watching"), IDLE_CLOSE_MS);
      return;
    }
    if (this.idle) { clearTimeout(this.idle); this.idle = null; }
    this.reconcileBoardPoll(want.board);
    if (a.poll) { this.reconcilePoll(want.trades); return; }
    const needsLine = want.trades.size > 0 || want.books.size > 0 || (want.board && !!a.board?.subscribe);
    if (!needsLine) return;
    if (!this.up) { if (this.upState !== "connecting") void this.openUpstream(); return; }
    if (this.upState !== "up" || (a.needsReady && !this.ready)) return;
    const send = (msgs: string[]) => { for (const m of msgs) try { this.up!.send(m); } catch { /* the close handler retries */ } };
    const add = [...want.trades].filter((s) => !this.upTrades.has(s));
    const drop = [...this.upTrades].filter((s) => !want.trades.has(s));
    if (add.length) { send(a.subscribe(add)); const at = Date.now(); add.forEach((s) => { this.upTrades.add(s); this.subAt.set(s, at); }); }
    if (drop.length) { send(a.unsubscribe(drop)); drop.forEach((s) => { this.upTrades.delete(s); this.conflator.drop(s); this.xbuf.delete(s); }); }
    if (a.book) {
      const badd = [...want.books].filter((s) => !this.upBooks.has(s));
      const bdrop = [...this.upBooks].filter((s) => !want.books.has(s));
      if (badd.length) { badd.forEach((s) => { this.upBooks.add(s); this.books.delete(s); }); send(a.book.subscribe(badd)); }
      if (bdrop.length) { send(a.book.unsubscribe(bdrop)); bdrop.forEach((s) => { this.upBooks.delete(s); this.books.delete(s); this.bookDirty.delete(s); }); }
    }
    if (a.board?.subscribe && want.board !== this.boardOn) {
      this.boardOn = want.board;
      send(want.board ? a.board.subscribe() : a.board.unsubscribe?.() ?? []);
    }
    this.ensureTimers();
  }

  // ------------------------------------------------------------------ polled parts

  /** A polled source: one request per period for every wanted symbol, while anyone watches. */
  private reconcilePoll(want: Set<string>) {
    for (const s of want) if (!this.upTrades.has(s)) { this.upTrades.add(s); this.lastTe.delete(s); }
    for (const s of [...this.upTrades]) if (!want.has(s)) { this.upTrades.delete(s); this.conflator.drop(s); }
    if (!want.size) return;
    if (this.poller) { void this.pollOnce(); return; }
    this.setState("connecting");
    void this.pollOnce();
    this.poller = setInterval(() => void this.pollOnce(), this.adapter!.poll!.every);
  }

  private polling = false;
  private pollFails = 0;
  private nextPollAt = 0;
  private async pollOnce() {
    if (this.polling || !this.upTrades.size || Date.now() < this.nextPollAt) return;
    this.polling = true;
    try {
      const trades = await this.adapter!.poll!.run([...this.upTrades]);
      this.stats.upstreamMsgs += 1;
      this.lastUpMsg = Date.now();
      this.pollFails = 0;
      this.nextPollAt = 0;
      if (this.upState !== "up") { this.stats.upstreamOpens += 1; this.setState("up"); }
      this.relay(trades.filter((t) => t.te > (this.lastTe.get(t.s) ?? 0)), false);
    } catch (e) {
      console.log(`[${this.src}] poll failed: ${String(e)}`);
      const code = String(e).match(/\b(\d{3})\b/)?.[1];
      this.setState("down", code ? `source answered ${code}` : "source did not answer");
      // Back off (5, 10, 20, 40, then 60 s) instead of a whole period, with one retry pending at
      // most; a free API that limits by address (429) must not be hammered.
      const wait = Math.min(60_000, 5_000 * 2 ** this.pollFails);
      this.pollFails += 1;
      this.nextPollAt = Date.now() + wait;
      setTimeout(() => void this.pollOnce(), wait + 50);
    } finally {
      this.polling = false;
    }
  }

  /** The overview's poll (sources without an all-symbol stream, or for 24 h figures). */
  private reconcileBoardPoll(on: boolean) {
    const p = this.adapter?.board?.poll;
    if (!p) return;
    if (on && !this.boardPoller) {
      const run = async () => {
        // With no line and no price poll running, the overview poll is what says up or down.
        const alone = () => !this.up && !this.poller && this.upState !== "connecting";
        try {
          this.applyBoard(await p.run());
          if (alone()) this.setState("up");
        } catch (e) {
          console.log(`[${this.src}] overview poll failed: ${String(e)}`);
          const code = String(e).match(/\b(\d{3})\b/)?.[1];
          if (alone()) this.setState("down", code ? `source answered ${code}` : "source did not answer");
        }
      };
      void run();
      this.boardPoller = setInterval(() => void run(), p.every);
      this.ensureTimers();
    } else if (!on && this.boardPoller) {
      clearInterval(this.boardPoller);
      this.boardPoller = null;
    }
  }

  // ------------------------------------------------------------------ upstream

  private setState(up: "up" | "connecting" | "down", why = "") {
    if (this.upState === up && this.why === why) return;
    this.upState = up;
    this.why = why;
    const msg: ServerMsg = { op: "state", up, why: why || undefined, ts: Date.now() };
    for (const v of this.viewers()) this.send(v.ws, msg);
  }

  private async openUpstream() {
    const a = this.adapter!;
    this.setState("connecting");
    if (a.connect) { await this.openLines(); return; }
    let ws: WorkerSocket | null = null;
    try {
      await a.prepare?.();
      const res = await fetch(a.url.replace(/^ws/, "http"), { headers: { Upgrade: "websocket", "User-Agent": "parity-live (contact@paritytrading.app)" } });
      ws = (res as Response & { webSocket?: WorkerSocket }).webSocket ?? null;
      if (!ws) throw new Error(`upstream answered ${res.status}`);
    } catch (e) {
      console.log(`[${this.src}] upstream connect failed: ${String(e)}`);
      const code = String(e).match(/\b(\d{3})\b/)?.[1];
      this.setState("down", code ? `source answered ${code}` : "source unreachable");
      this.later();
      return;
    }
    ws.accept();
    this.up = ws;
    this.retry = 0;
    if (this.stats.upstreamOpens > 0) this.stats.reconnects += 1;
    this.stats.upstreamOpens += 1;
    this.upTrades.clear(); this.upBooks.clear(); this.boardOn = false; this.books.clear();
    this.ready = !a.needsReady;
    this.lastUpMsg = Date.now();
    console.log(`[${this.src}] upstream open`);
    ws.addEventListener("message", (e: MessageEvent) => this.onUpstream(typeof e.data === "string" ? e.data : ""));
    ws.addEventListener("close", (e: CloseEvent) => { if (this.up === ws) this.lost(`source closed the line${e.code ? ` (${e.code})` : ""}`); });
    ws.addEventListener("error", () => { if (this.up === ws) this.lost("line error"); });
    for (const m of a.hello?.() ?? []) ws.send(m);
    if (this.ready) this.setState("up");
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = setInterval(() => {
      if (!this.up) return;
      if (Date.now() - this.lastUpMsg > (a.stallMs ?? STALL_MS)) { this.lost("no data from source"); return; }
      const p = a.ping?.();
      if (p) try { this.up.send(p); } catch { /* the close handler retries */ }
    }, a.pingEvery ?? 20_000);
    this.reconcile();
  }

  private lost(why: string) {
    console.log(`[${this.src}] upstream lost: ${why}`);
    this.dropUpstream();
    this.setState("down", why);
    if (this.wanted().any) this.later();
  }

  private closeUpstream(why: string) {
    this.idle = null;
    if (this.wanted().any) return;
    console.log(`[${this.src}] upstream closed: ${why}`);
    this.dropUpstream();
    for (const t of [this.poller, this.boardPoller, this.flusher, this.boardTimer, this.sparkTimer]) if (t) clearInterval(t);
    this.poller = this.boardPoller = this.flusher = this.boardTimer = this.sparkTimer = null;
    this.upTrades.clear();
    this.upState = "down";
  }

  private dropUpstream() {
    const ws = this.up;
    this.up = null;
    this.lines = null;
    this.ready = false;
    this.upTrades.clear(); this.upBooks.clear(); this.boardOn = false;
    if (this.pinger) { clearInterval(this.pinger); this.pinger = null; }
    try { ws?.close(1000); } catch { /* already gone */ }
  }

  private later() {
    const wait = Math.min(30_000, 1_000 * 2 ** this.retry) * (0.75 + Math.random() * 0.5);
    this.retry += 1;
    setTimeout(() => { if (!this.up && this.wanted().any) void this.openUpstream(); }, wait);
  }

  /** A source with its own lines (several chains, its own failover): it opens them and
   *  hands back what they carry; we keep the same subscriptions, timers and stall check. */
  private async openLines() {
    const a = this.adapter!;
    try { await a.prepare?.(); } catch (e) { console.log(`[${this.src}] prepare failed: ${String(e)}`); }
    const conn = a.connect!((p) => { if (this.up === line) this.onParsed(p); }, (why) => { console.log(`[${this.src}] ${why}`); this.why = why; });
    const line = { send: (m: string) => conn.send(m), close: () => conn.close() };
    this.up = line;
    this.lines = conn;
    this.retry = 0;
    if (this.stats.upstreamOpens > 0) this.stats.reconnects += 1;
    this.stats.upstreamOpens += 1;
    this.upTrades.clear(); this.upBooks.clear(); this.boardOn = false; this.books.clear();
    this.ready = true;
    this.lastUpMsg = Date.now();
    this.setState("up");
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = setInterval(() => {
      if (this.up === line && Date.now() - this.lastUpMsg > (a.stallMs ?? STALL_MS)) this.lost("no data from source");
    }, 20_000);
    this.reconcile();
  }

  private onUpstream(data: string) {
    let p: Parsed;
    try { p = this.adapter!.parse(data); } catch (e) { console.log(`[${this.src}] parse failed: ${String(e)}`); return; }
    this.onParsed(p);
  }

  private onParsed(p: Parsed) {
    this.lastUpMsg = Date.now();
    this.stats.upstreamMsgs += 1;
    if (p.fail) { console.log(`[${this.src}] source said: ${p.fail}`); this.why = p.fail; }
    if (p.drop) { this.lost(p.fail ?? "source refused"); return; }
    if (p.ready && !this.ready) { this.ready = true; this.setState("up"); this.reconcile(); }
    if (p.t?.length) this.relay(p.t, true);
    if (p.b?.length) this.applyBooks(p.b);
    if (p.r?.length) this.applyBoard(p.r);
  }

  // ------------------------------------------------------------------ trades

  /** Conflate and send trades; `live` drops a source's catch-up snapshot after a subscribe. */
  private relay(trades: Trade[], live: boolean) {
    if (!trades.length) return;
    const now = Date.now();
    const out: Tick[] = [];
    for (const t of trades) {
      if (!this.upTrades.has(t.s) || !Number.isFinite(t.te) || !Number.isFinite(t.p)) continue;
      if (live && t.te < (this.subAt.get(t.s) ?? 0) - SNAPSHOT_MS) continue;
      this.lastTe.set(t.s, Math.max(t.te, this.lastTe.get(t.s) ?? 0));
      this.stats.trades += 1;
      const lag = now - t.te;
      if (this.stats.feedLagMs.length < 2000) this.stats.feedLagMs.push(lag);
      else this.stats.feedLagMs[Math.floor(Math.random() * 2000)] = lag;
      out.push(...this.conflator.add(t, now));
      let buf = this.xbuf.get(t.s);
      if (!buf) { buf = []; this.xbuf.set(t.s, buf); }
      buf.push([t.te, t.p, Number.isFinite(t.v) ? t.v : 0, t.side ?? 0]);
      if (buf.length > X_MAX) buf.splice(0, buf.length - X_MAX);
    }
    if (out.length) this.broadcast(out);
    if (this.conflator.waiting && !this.timer) {
      this.timer = setInterval(() => {
        const due = this.conflator.due(Date.now());
        if (due.length) this.broadcast(due);
        if (!this.conflator.waiting && this.timer) { clearInterval(this.timer); this.timer = null; }
      }, 25);
    }
    this.ensureTimers();
  }

  private broadcast(ticks: Tick[]) {
    for (const t of ticks) this.lastTick.set(t.s, t);
    for (const v of this.viewers()) {
      if (!v.subs.size) continue;
      const d = ticks.filter((t) => v.subs.has(t.s));
      if (d.length) { this.send(v.ws, { op: "t", d }); this.stats.sent += d.length; }
    }
  }

  // ------------------------------------------------------------------ books

  private applyBooks(updates: BookUpdate[]) {
    const now = Date.now();
    const depth = this.adapter!.bookDepth ?? 50;
    for (const u of updates) {
      if (!this.upBooks.has(u.s)) continue;
      let b = this.books.get(u.s);
      if (!b || u.snap) { b = { bids: new Map(), asks: new Map(), te: 0, tr: 0 }; this.books.set(u.s, b); }
      for (const [side, levels] of [[b.bids, u.bids], [b.asks, u.asks]] as [Map<number, number>, Level[]][]) {
        for (const [p, q] of levels) {
          if (!Number.isFinite(p) || !Number.isFinite(q)) continue;
          if (q <= 0) side.delete(p); else side.set(p, q);
        }
      }
      // Sources that send a fixed depth do not delete levels that fall off the end: cut them.
      if (b.bids.size > depth) for (const p of [...b.bids.keys()].sort((x, y) => y - x).slice(depth)) b.bids.delete(p);
      if (b.asks.size > depth) for (const p of [...b.asks.keys()].sort((x, y) => x - y).slice(depth)) b.asks.delete(p);
      b.te = Number.isFinite(u.te) ? u.te : now;
      b.tr = now;
      this.bookDirty.add(u.s);
    }
    this.ensureTimers();
  }

  private bookMsg(s: string, now: number): ServerMsg {
    const b = this.books.get(s)!;
    const top = (m: Map<number, number>, desc: boolean): Level[] => [...m.entries()].sort((x, y) => (desc ? y[0] - x[0] : x[0] - y[0])).slice(0, BOOK_SHOWN);
    return { op: "b", s, b: top(b.bids, true), a: top(b.asks, false), te: b.te, tr: b.tr, ts: now };
  }

  /** Every 250 ms: changed books and new trades lists to their subscribers. */
  private flush() {
    const now = Date.now();
    // Team-only sources: cut off expired sign-ins even when nobody sends a message.
    if (this.adapter?.internal && now - this.lastExpiry > 5_000) { this.lastExpiry = now; this.expireViewers(); }
    if (this.bookDirty.size) {
      const msgs = new Map<string, string>();
      for (const s of this.bookDirty) if (this.books.has(s)) msgs.set(`B:${s}`, JSON.stringify(this.bookMsg(s, now)));
      this.bookDirty.clear();
      for (const v of this.viewers()) for (const [k, m] of msgs) if (v.subs.has(k)) { this.sendRaw(v.ws, m); this.stats.bookMsgs += 1; }
    }
    if (this.xbuf.size) {
      const msgs = new Map<string, string>();
      for (const [s, d] of this.xbuf) if (d.length) msgs.set(`X:${s}`, JSON.stringify({ op: "x", s, d, ts: now } satisfies ServerMsg));
      this.xbuf.clear();
      for (const v of this.viewers()) for (const [k, m] of msgs) if (v.subs.has(k)) this.sendRaw(v.ws, m);
    }
  }

  // ------------------------------------------------------------------ the overview

  private applyBoard(rows: BoardPatch[]) {
    // The first rows a source gives go out as a whole list, sparklines included.
    if (!this.board.size && rows.length) this.boardFullDue = true;
    for (const r of rows) {
      if (!r.s) continue;
      const old = this.board.get(r.s);
      const p = r.p != null && Number.isFinite(r.p) && r.p > 0 ? r.p : old?.p;
      if (p == null) continue;
      const fin = (x: number | undefined) => (x != null && Number.isFinite(x) ? x : undefined);
      const next: Row = { p, o: fin(r.o) ?? old?.o, c: fin(r.c) ?? (fin(r.o) == null ? old?.c : undefined), v: fin(r.v) ?? old?.v, te: Number.isFinite(r.te) ? r.te : Date.now() };
      if (old && old.p === next.p && old.o === next.o && old.c === next.c && old.v === next.v) continue;
      this.board.set(r.s, next);
      this.boardDirty.add(r.s);
      if (r.spark?.length) { this.spark.set(r.s, r.spark.slice(-SPARK_N)); this.ownSpark.add(r.s); this.sparkDirty.add(r.s); }
      else if (!this.spark.has(r.s)) this.spark.set(r.s, [p]);
    }
    this.ensureTimers();
  }

  private boardRows(syms: string[]): BoardRow[] {
    const out: BoardRow[] = [];
    for (const s of syms) {
      const r = this.board.get(s);
      if (!r) continue;
      const chg = r.c ?? (r.o ? (r.p / r.o - 1) * 100 : null);
      out.push([s, r.p, chg != null && Number.isFinite(chg) ? Math.round(chg * 100) / 100 : null, r.v != null ? Math.round(r.v) : null, r.te]);
    }
    return out;
  }

  private flushBoard() {
    if (!this.boardDirty.size) return;
    const watchers = this.viewers().filter((v) => v.subs.has(BOARD));
    const full = this.boardFullDue;
    this.boardFullDue = false;
    const d = this.boardRows(full ? [...this.board.keys()] : [...this.boardDirty]);
    const sp = full ? Object.fromEntries(this.spark) : this.sparkDirty.size ? Object.fromEntries([...this.sparkDirty].map((s) => [s, this.spark.get(s) ?? []])) : null;
    this.boardDirty.clear();
    this.sparkDirty.clear();
    if (!watchers.length || !d.length) return;
    const m = JSON.stringify({ op: "r", d, ts: Date.now(), ...(full ? { full: 1 as const, every: SPARK_EVERY } : {}), ...(sp ? { sp } : {}) } satisfies ServerMsg);
    for (const v of watchers) { this.sendRaw(v.ws, m); this.stats.boardMsgs += 1; }
  }

  /** One sparkline point a minute per symbol (sources that do not send their own line). */
  private sampleSparks() {
    for (const [s, r] of this.board) {
      if (this.ownSpark.has(s)) continue;
      const line = this.spark.get(s) ?? [];
      line.push(r.p);
      if (line.length > SPARK_N) line.splice(0, line.length - SPARK_N);
      this.spark.set(s, line);
    }
  }

  private ensureTimers() {
    if (!this.flusher) this.flusher = setInterval(() => this.flush(), FLUSH_MS);
    if (this.board.size && !this.boardTimer) this.boardTimer = setInterval(() => { this.flushBoard(); this.expireViewers(); }, BOARD_MS);
    if (this.board.size && !this.sparkTimer) this.sparkTimer = setInterval(() => this.sampleSparks(), SPARK_EVERY);
  }

  // ------------------------------------------------------------------ out

  private send(ws: WorkerSocket, m: ServerMsg) { this.sendRaw(ws, JSON.stringify(m)); }
  private sendRaw(ws: WorkerSocket, m: string) {
    try { ws.send(m); } catch { /* the close handler tidies up */ }
  }

  private status(): Response {
    const lag = [...this.stats.feedLagMs].sort((a, b) => a - b);
    const q = (p: number) => (lag.length ? lag[Math.min(lag.length - 1, Math.floor(p * lag.length))] : null);
    const v = this.viewers();
    const body = {
      ...this.stats,
      src: this.src, feed: this.adapter?.feed, internal: !!this.adapter?.internal, upstream: this.upState, why: this.why || null,
      viewers: v.length, ...(this.adapter?.internal ? {} : { symbols: [...this.upTrades], books: [...this.upBooks] }), overviewRows: this.board.size, overviewOn: this.boardOn || !!this.boardPoller,
      lastUpstreamMsgAgoMs: this.lastUpMsg ? Date.now() - this.lastUpMsg : null,
      ...(this.lines?.state ? { lines: this.lines.state() } : {}),
      feedLagMs: { p50: q(0.5), p95: q(0.95), p99: q(0.99), n: lag.length },
      folded: this.conflator.folded, now: Date.now(),
    };
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
}
