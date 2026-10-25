// LiveHub, the fan-out (DEC-0049, REF-0019 tier C): one Durable Object per source. It holds
// ONE connection to that source's public feed, subscribed to the union of the symbols its
// viewers want, and relays every trade to every viewer of that symbol, conflated to at most
// four updates a second and stamped with our receive and send times. The upstream line
// opens with the first viewer and closes a minute after the last one leaves, so nothing
// runs (or is billed) while nobody watches.
//
// Viewers use the WebSocket Hibernation API (state.acceptWebSocket), so idle viewer
// sockets cost nothing. Caps: MAX_VIEWERS sockets, MAX_SUBS symbols per socket and
// MAX_UPSTREAM symbols per source, so no viewer can make us flood a venue. GET /status
// returns counters and is the log; connects and upstream changes also go to the Workers log.
import { Conflator, type Trade } from "../../src/lib/live/conflate";
import { MAX_SUBS, parseClient, type ServerMsg, type Tick } from "../../src/lib/live/protocol";
import { adapterFor, type Adapter } from "./adapters";
import { sourceById } from "../../src/lib/live/sources";
import type { DurableObjectState, Env, WebSocketPairCtor, WorkerSocket } from "./types";

declare const WebSocketPair: WebSocketPairCtor;

const MAX_VIEWERS = 500;
const MAX_UPSTREAM = 60;
const IDLE_CLOSE_MS = 60_000;
const STALL_MS = 45_000;
const SNAPSHOT_MS = 3_000;

interface Attachment { subs: string[]; at: number }

export class LiveHub {
  private adapter: Adapter | null = null;
  private src = "";
  private up: WorkerSocket | null = null;
  private upState: "up" | "connecting" | "down" = "down";
  private why = "";
  private upSubs = new Set<string>();
  /** When each symbol was subscribed upstream: trades from before then are the source's
   *  catch-up snapshot, not live, and are dropped. */
  private subAt = new Map<string, number>();
  /** Newest exchange time relayed per symbol; a polled source repeats prices, which are skipped. */
  private lastTe = new Map<string, number>();
  private poller: ReturnType<typeof setInterval> | null = null;
  /** The newest update per symbol, sent at once to a viewer who subscribes later. */
  private lastTick = new Map<string, Tick>();
  private conflator = new Conflator();
  private timer: ReturnType<typeof setInterval> | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;
  private idle: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;
  private lastUpMsg = 0;
  private stats = { started: Date.now(), viewersSeen: 0, upstreamOpens: 0, upstreamMsgs: 0, trades: 0, sent: 0, refused: 0, feedLagMs: [] as number[] };

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
    if (this.state.getWebSockets().length >= MAX_VIEWERS) {
      this.stats.refused += 1;
      return new Response("Too many viewers on this source right now", { status: 503 });
    }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.state.acceptWebSocket(server, [src]);
    server.serializeAttachment({ subs: [], at: Date.now() } satisfies Attachment);
    this.stats.viewersSeen += 1;
    this.send(server, { op: "hello", src, feed: this.adapter.feed, delay: this.adapter.delayMin ?? sourceById(src)?.delayMin, ts: Date.now(), max: MAX_SUBS });
    this.send(server, { op: "state", up: this.upState, why: this.why || undefined, ts: Date.now() });
    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
  }

  // ------------------------------------------------------------------ viewers

  async webSocketMessage(ws: WorkerSocket, raw: string | ArrayBuffer) {
    const m = parseClient(typeof raw === "string" ? raw : "");
    if (!m) return;
    if (m.op === "ping") { this.send(ws, { op: "pong", c: m.c, ts: Date.now() }); return; }
    if (!this.adapter) return;
    const att = (ws.deserializeAttachment() as Attachment | null) ?? { subs: [], at: Date.now() };
    const mine = new Set(att.subs);
    if (m.op === "sub") {
      for (const s of m.s) {
        if (mine.size >= MAX_SUBS) break;
        if (!this.adapter.allows(s)) { this.send(ws, { op: "err", why: `${s} is not offered by this source` }); continue; }
        mine.add(s);
      }
    } else {
      for (const s of m.s) mine.delete(s);
    }
    ws.serializeAttachment({ ...att, subs: [...mine] } satisfies Attachment);
    if (m.op === "sub") {
      const have = m.s.flatMap((s) => (mine.has(s) && this.lastTick.has(s) ? [{ ...this.lastTick.get(s)!, r: 1 as const }] : []));
      if (have.length) this.send(ws, { op: "t", d: have });
    }
    this.reconcile();
  }

  async webSocketClose(ws: WorkerSocket) { this.forget(ws); }
  async webSocketError(ws: WorkerSocket) { this.forget(ws); }

  private forget(ws: WorkerSocket) {
    try { ws.serializeAttachment({ subs: [], at: 0 }); } catch { /* closed */ }
    try { ws.close(1000); } catch { /* closed */ }
    this.reconcile();
  }

  private viewers(): { ws: WorkerSocket; subs: string[] }[] {
    return this.state.getWebSockets().map((ws) => {
      const w = ws as WorkerSocket;
      const a = w.deserializeAttachment() as Attachment | null;
      return { ws: w, subs: a?.subs ?? [] };
    });
  }

  private wanted(): Set<string> {
    const want = new Set<string>();
    for (const v of this.viewers()) for (const s of v.subs) if (want.size < MAX_UPSTREAM) want.add(s);
    return want;
  }

  /** Bring the upstream line and its subscriptions in line with what viewers want. */
  private reconcile() {
    const want = this.wanted();
    if (!want.size) {
      if (!this.idle && (this.up || this.poller)) this.idle = setTimeout(() => this.closeUpstream("nobody watching"), IDLE_CLOSE_MS);
      return;
    }
    if (this.idle) { clearTimeout(this.idle); this.idle = null; }
    if (this.adapter!.poll) { this.reconcilePoll(want); return; }
    if (!this.up) { if (this.upState !== "connecting") void this.openUpstream(); return; }
    if (this.upState !== "up") return;
    const add = [...want].filter((s) => !this.upSubs.has(s));
    const drop = [...this.upSubs].filter((s) => !want.has(s));
    if (add.length) { for (const m of this.adapter!.subscribe(add)) this.up.send(m); const at = Date.now(); add.forEach((s) => { this.upSubs.add(s); this.subAt.set(s, at); }); }
    if (drop.length) { for (const m of this.adapter!.unsubscribe(drop)) this.up.send(m); drop.forEach((s) => { this.upSubs.delete(s); this.conflator.drop(s); }); }
  }

  // ------------------------------------------------------------------ polled sources

  /** A polled source: one request per period for every wanted symbol, while anyone watches. */
  private reconcilePoll(want: Set<string>) {
    for (const s of want) if (!this.upSubs.has(s)) { this.upSubs.add(s); this.lastTe.delete(s); }
    for (const s of [...this.upSubs]) if (!want.has(s)) { this.upSubs.delete(s); this.conflator.drop(s); }
    if (this.poller) { void this.pollOnce(); return; }
    this.setState("connecting");
    void this.pollOnce();
    this.poller = setInterval(() => void this.pollOnce(), this.adapter!.poll!.every);
  }

  private polling = false;
  private async pollOnce() {
    if (this.polling || !this.upSubs.size) return;
    this.polling = true;
    try {
      const trades = await this.adapter!.poll!.run([...this.upSubs]);
      this.stats.upstreamMsgs += 1;
      this.lastUpMsg = Date.now();
      if (this.upState !== "up") { this.stats.upstreamOpens += 1; this.setState("up"); }
      this.relay(trades.filter((t) => t.te > (this.lastTe.get(t.s) ?? 0)), false);
    } catch (e) {
      console.log(`[${this.src}] poll failed: ${String(e)}`);
      this.setState("down", "source did not answer");
    } finally {
      this.polling = false;
    }
  }

  // ------------------------------------------------------------------ upstream

  private setState(up: "up" | "connecting" | "down", why = "") {
    this.upState = up;
    this.why = why;
    const msg: ServerMsg = { op: "state", up, why: why || undefined, ts: Date.now() };
    for (const v of this.viewers()) this.send(v.ws, msg);
  }

  private async openUpstream() {
    const a = this.adapter!;
    this.setState("connecting");
    let ws: WorkerSocket | null = null;
    try {
      const res = await fetch(a.url.replace(/^ws/, "http"), { headers: { Upgrade: "websocket", "User-Agent": "parity-live (contact@paritytrading.ai)" } });
      ws = (res as Response & { webSocket?: WorkerSocket }).webSocket ?? null;
      if (!ws) throw new Error(`upstream answered ${res.status}`);
    } catch (e) {
      console.log(`[${this.src}] upstream connect failed: ${String(e)}`);
      this.setState("down", "source unreachable");
      this.later();
      return;
    }
    ws.accept();
    this.up = ws;
    this.retry = 0;
    this.stats.upstreamOpens += 1;
    this.upSubs.clear();
    this.lastUpMsg = Date.now();
    console.log(`[${this.src}] upstream open`);
    this.setState("up");
    ws.addEventListener("message", (e: MessageEvent) => this.onUpstream(typeof e.data === "string" ? e.data : ""));
    ws.addEventListener("close", () => { if (this.up === ws) this.lost("source closed the line"); });
    ws.addEventListener("error", () => { if (this.up === ws) this.lost("line error"); });
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = setInterval(() => {
      if (!this.up) return;
      if (Date.now() - this.lastUpMsg > STALL_MS) { this.lost("no data from source"); return; }
      const p = a.ping?.();
      if (p) try { this.up.send(p); } catch { /* the close handler retries */ }
    }, a.pingEvery ?? 20_000);
    this.reconcile();
  }

  private lost(why: string) {
    console.log(`[${this.src}] upstream lost: ${why}`);
    this.dropUpstream();
    this.setState("down", why);
    if (this.wanted().size) this.later();
  }

  private closeUpstream(why: string) {
    this.idle = null;
    if (this.wanted().size) return;
    console.log(`[${this.src}] upstream closed: ${why}`);
    this.dropUpstream();
    if (this.poller) { clearInterval(this.poller); this.poller = null; }
    this.upSubs.clear();
    this.upState = "down";
  }

  private dropUpstream() {
    const ws = this.up;
    this.up = null;
    this.upSubs.clear();
    if (this.pinger) { clearInterval(this.pinger); this.pinger = null; }
    try { ws?.close(1000); } catch { /* already gone */ }
  }

  private later() {
    const wait = Math.min(30_000, 1_000 * 2 ** this.retry) * (0.75 + Math.random() * 0.5);
    this.retry += 1;
    setTimeout(() => { if (!this.up && this.wanted().size) void this.openUpstream(); }, wait);
  }

  private onUpstream(data: string) {
    const now = Date.now();
    this.lastUpMsg = now;
    this.stats.upstreamMsgs += 1;
    this.relay(this.adapter!.parse(data), true);
  }

  /** Conflate and send trades; `live` drops a source's catch-up snapshot after a subscribe. */
  private relay(trades: Trade[], live: boolean) {
    if (!trades.length) return;
    const now = Date.now();
    const out: Tick[] = [];
    for (const t of trades) {
      if (!this.upSubs.has(t.s) || !Number.isFinite(t.te)) continue;
      if (live && t.te < (this.subAt.get(t.s) ?? 0) - SNAPSHOT_MS) continue;
      this.lastTe.set(t.s, Math.max(t.te, this.lastTe.get(t.s) ?? 0));
      this.stats.trades += 1;
      const lag = now - t.te;
      if (this.stats.feedLagMs.length < 2000) this.stats.feedLagMs.push(lag);
      else this.stats.feedLagMs[Math.floor(Math.random() * 2000)] = lag;
      out.push(...this.conflator.add(t, now));
    }
    if (out.length) this.broadcast(out);
    if (this.conflator.waiting && !this.timer) {
      this.timer = setInterval(() => {
        const due = this.conflator.due(Date.now());
        if (due.length) this.broadcast(due);
        if (!this.conflator.waiting && this.timer) { clearInterval(this.timer); this.timer = null; }
      }, 25);
    }
  }

  private broadcast(ticks: Tick[]) {
    for (const t of ticks) this.lastTick.set(t.s, t);
    for (const v of this.viewers()) {
      if (!v.subs.length) continue;
      const d = ticks.filter((t) => v.subs.includes(t.s));
      if (d.length) { this.send(v.ws, { op: "t", d }); this.stats.sent += d.length; }
    }
  }

  private send(ws: WorkerSocket, m: ServerMsg) {
    try { ws.send(JSON.stringify(m)); } catch { /* the close handler tidies up */ }
  }

  private status(): Response {
    const lag = [...this.stats.feedLagMs].sort((a, b) => a - b);
    const q = (p: number) => (lag.length ? lag[Math.min(lag.length - 1, Math.floor(p * lag.length))] : null);
    const v = this.viewers();
    const body = {
      ...this.stats,
      src: this.src, feed: this.adapter?.feed, upstream: this.upState, why: this.why || null,
      viewers: v.length, symbols: [...this.upSubs], lastUpstreamMsgAgoMs: this.lastUpMsg ? Date.now() - this.lastUpMsg : null,
      feedLagMs: { p50: q(0.5), p95: q(0.95), p99: q(0.99), n: lag.length },
      folded: this.conflator.folded, now: Date.now(),
    };
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
}
