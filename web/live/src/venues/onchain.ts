// The Parity price (DEC-0063, DEC-0065): our own public feed, built from public blockchain
// data. One line per chain (Base, Arbitrum, BNB Chain, Optimism, Polygon, Ethereum), each to
// a free public node, carries every swap in the pools of onchain-registry.json. Each swap
// moves its pool's price; each asset's price is the aggregate of its pools on every chain
// (parityPrice.ts: weighted median of votes, outliers and stale pools left out) with a
// confidence. Pools priced in ETH, BNB or POL are converted with those assets' own Parity
// price. Blockchain data carries no licence, so anyone may see it.
//
// Times: a swap's exchange time is its block's time, so the wait for a block (0.25 s on
// Arbitrum to 12 s on Ethereum) is not counted; the badge's card says so. Block times are
// whole seconds, so on chains with faster blocks the measured lag carries up to 1 s of
// rounding. GET /status shows block-to-edge lag per chain.
// Nodes limit by address and Cloudflare's addresses are shared: a chain whose node refuses
// the subscription, or goes quiet, moves to its next node by itself.
import { BARS, fromPrices, TF_MS, allowed, type AdapterDef, type BoardPatch, type Parsed, type Trade } from "../base";
import REGISTRY from "./onchain-registry.json";
import ENROLLED from "./onchain-enrolled.json";
import { CHAINS, chainDef, poolScore, quoteUsd, withEnrolled, type ChainDef, type EnrolledList, type PoolEntry, type Registry } from "./onchainRegistry";
import { aggregate, type Aggregate, type SourceQuote } from "./parityPrice";

// Pools the data registry enrolled since the last discovery refresh join here (DEC-0078).
const REG = withEnrolled(REGISTRY as unknown as Registry, ENROLLED as unknown as EnrolledList);
const SLOT0 = "0x3850c7bd";
/** Volume weights fade by half every 5 minutes, so the pools trading now count most. */
const HALF_LIFE_MS = 300_000;
const UA = "parity-live (contact@paritytrading.app)";

export const ONCHAIN_SYMBOLS = REG.tokens.map((t) => t.sym);

const word = (hex: string, i: number) => BigInt(`0x${hex.slice(2 + i * 64, 2 + (i + 1) * 64) || "0"}`);
const signed = (x: bigint) => (x >= 1n << 255n ? x - (1n << 256n) : x);
const Q96 = 2 ** 96;

/** Quote per base from a pool's sqrtPriceX96. */
export function poolPrice(sqrtX96: bigint, baseIs0: boolean, scale: number): number {
  const r = Number(sqrtX96) / Q96;
  const p10 = r * r * scale; // token1 per token0, in whole units
  return baseIs0 ? p10 : p10 > 0 ? 1 / p10 : Number.NaN;
}

/** The base amount of one swap (positive: into the pool) and the pool's new price. Uniswap,
 *  Aerodrome and PancakeSwap v3 all start with amount0, amount1, sqrtPriceX96. */
export function decodeSwap(data: string, baseIs0: boolean, scale: number, baseDec: number): { price: number; base: number } | null {
  if (typeof data !== "string" || data.length < 2 + 64 * 3) return null;
  const a0 = signed(word(data, 0)), a1 = signed(word(data, 1));
  const price = poolPrice(word(data, 2), baseIs0, scale);
  const base = Number(baseIs0 ? a0 : a1) / 10 ** baseDec;
  return Number.isFinite(price) && price > 0 ? { price, base } : null;
}

export interface LivePool { e: PoolEntry; key: string; baseIs0: boolean; scale: number; prior: number; slow: number; mid: number; midAt: number; vol: number; volAt: number }

export function livePool(e: PoolEntry, key: string): LivePool | null {
  const c = chainDef(e.chain), q = c?.quotes.find((x) => x.key === e.quote);
  if (!c || !q) return null;
  const baseIs0 = e.base.toLowerCase() < q.address.toLowerCase();
  const [d0, d1] = baseIs0 ? [e.decimals, q.decimals] : [q.decimals, e.decimals];
  const slow = c.blockMs > 5_000 ? 0.2 : 1;
  return { e, key, baseIs0, scale: 10 ** (d0 - d1), prior: e.liq * 0.01 * slow, slow, mid: Number.NaN, midAt: 0, vol: 0, volAt: 0 };
}

/** One pool as a source for the aggregate: USD price, confidence (half its fee, plus the
 *  anchor's own confidence when it is priced in ETH, BNB or POL) and weight. */
export function poolQuote(p: LivePool, anchor: (key: string) => Aggregate | null, now: number): SourceQuote | null {
  if (!Number.isFinite(p.mid) || p.mid <= 0) return null;
  const u = quoteUsd(p.e.chain, p.e.quote);
  let qp = 1, qc = 0;
  if (u !== "usd") { const a = u ? anchor(u) : null; if (!a) return null; qp = a.p; qc = a.c; }
  const price = p.mid * qp;
  const vol = p.vol * 0.5 ** ((now - p.volAt) / HALF_LIFE_MS) * p.slow;
  return { p: price, c: price * (p.e.fee / 2) + p.mid * qc, w: vol + p.prior, at: p.midAt };
}

interface Rpc { id: number; result?: unknown; error?: { message?: string }; method?: string; params?: { subscription?: string; result?: Record<string, unknown> } }

/** One chain's line: a socket to its first working node, the swap and block subscriptions,
 *  and calls (pool prices) over the same socket. Reconnects and moves node by itself. */
class ChainLine {
  ws: (WebSocket & { accept(): void }) | null = null;
  node = 0;
  alive = false;
  closed = false;
  retry = 0;
  lastMsg = 0;
  blockAt = new Map<number, number>();
  head = 0;
  /** Block time to our edge, ms, for the last few hundred swaps (the log, GET /status). */
  lags: number[] = [];
  swaps = 0;
  private calls = new Map<number, (r: unknown) => void>();
  private nextId = 10;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(public c: ChainDef, private pools: string[], private onLog: (log: Record<string, unknown>, line: ChainLine) => void, private note: (why: string) => void) {}

  async open() {
    if (this.closed) return;
    this.alive = false;
    const url = this.c.nodes[this.node];
    try {
      const res = await fetch(url.replace(/^wss/, "https"), { headers: { Upgrade: "websocket", "User-Agent": UA } });
      const ws = (res as Response & { webSocket?: WebSocket & { accept(): void } }).webSocket;
      if (!ws) throw new Error(`answered ${res.status}`);
      ws.accept();
      this.ws = ws;
      this.lastMsg = Date.now();
      ws.addEventListener("message", (e: MessageEvent) => this.onMessage(String(e.data)));
      ws.addEventListener("close", () => { if (this.ws === ws) this.fail("closed"); });
      ws.addEventListener("error", () => { if (this.ws === ws) this.fail("error"); });
      const topics = [[...new Set(this.c.factories.map((f) => f.topic))]];
      // Nodes cap addresses per filter; 400 a subscription is safe on all three.
      for (let i = 0; i < this.pools.length; i += 400) ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["logs", { address: this.pools.slice(i, i + 400), topics }] }));
      ws.send(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "eth_subscribe", params: ["newHeads"] }));
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (Date.now() - this.lastMsg > 60_000) { this.fail("no data"); return; }
        try { this.ws?.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] })); } catch { /* close handler */ }
      }, 20_000);
    } catch (e) { this.fail(String(e)); }
  }

  private onMessage(data: string) {
    this.lastMsg = Date.now();
    let m: Rpc;
    try { m = JSON.parse(data) as Rpc; } catch { return; }
    if (m.id != null && this.calls.has(m.id)) { const f = this.calls.get(m.id)!; this.calls.delete(m.id); f(m.error ? null : m.result); return; }
    if (m.error) { if (m.id === 1 || m.id === 3) this.fail(`refused: ${m.error.message ?? "error"}`); return; }
    const r = m.method === "eth_subscription" ? m.params?.result : undefined;
    if (!r) return;
    if (typeof r.timestamp === "string" && typeof r.number === "string") {
      this.alive = true;
      this.retry = 0;
      this.head = Number(BigInt(r.number));
      this.blockAt.set(this.head, Number(BigInt(r.timestamp)) * 1000);
      if (this.blockAt.size > 64) this.blockAt.delete(this.blockAt.keys().next().value!);
      return;
    }
    this.alive = true;
    this.onLog(r, this);
  }

  /** One call over the line; null when refused, unanswered in 10 s, or the line is down. */
  call(method: string, params: unknown[]): Promise<unknown> {
    const ws = this.ws;
    if (!ws) return Promise.resolve(null);
    const id = this.nextId++;
    return new Promise((ok) => {
      const t = setTimeout(() => { this.calls.delete(id); ok(null); }, 10_000);
      this.calls.set(id, (r) => { clearTimeout(t); ok(r); });
      try { ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params })); } catch { clearTimeout(t); this.calls.delete(id); ok(null); }
    });
  }

  private fail(why: string) {
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(1000); } catch { /* gone */ }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    for (const f of this.calls.values()) f(null);
    this.calls.clear();
    if (this.closed) return;
    // A line that never carried anything: the next node. Then back off and try again.
    if (!this.alive) this.node = (this.node + 1) % this.c.nodes.length;
    this.note(`${this.c.chain}: ${why}; next ${this.c.nodes[this.node]}`);
    const wait = Math.min(30_000, 1_000 * 2 ** this.retry++);
    setTimeout(() => void this.open(), wait);
  }

  close() { this.closed = true; this.fail("closed by us"); }
}

/** A chain's block number about `ms` ago, from two block times. */
async function blockAgo(line: ChainLine, ms: number): Promise<number | null> {
  if (!line.head) return null;
  const back = 100_000;
  const old = (await line.call("eth_getBlockByNumber", [`0x${Math.max(1, line.head - back).toString(16)}`, false])) as { timestamp?: string } | null;
  const nowTs = line.blockAt.get(line.head);
  if (!old?.timestamp || !nowTs) return Math.max(1, line.head - Math.round(ms / line.c.blockMs));
  const per = (nowTs - Number(BigInt(old.timestamp)) * 1000) / back;
  return per > 0 ? Math.max(1, line.head - Math.round(ms / per)) : null;
}

export const onchain: AdapterDef = {
  id: "onchain",
  enabled: (env) => allowed("onchain", env),
  make: () => {
    // Every pool of every asset, by chain and address.
    const pools = new Map<string, LivePool>();
    const byKey = new Map<string, LivePool[]>();
    const symOf = new Map<string, string>(), keyOf = new Map<string, string>();
    for (const t of REG.tokens) {
      symOf.set(t.key, t.sym); keyOf.set(t.sym, t.key);
      for (const e of t.pools) {
        const p = livePool(e, t.key);
        if (!p) continue;
        pools.set(`${e.chain}:${e.pool}`, p);
        byKey.set(t.key, [...(byKey.get(t.key) ?? []), p]);
      }
    }
    const aggs = new Map<string, Aggregate>();
    const dayAgo = new Map<string, number>();
    const anchor = (key: string) => aggs.get(key) ?? null;
    const recompute = (key: string, now: number): Aggregate | null => {
      const qs = (byKey.get(key) ?? []).map((p) => poolQuote(p, anchor, now)).filter((q): q is SourceQuote => !!q);
      const a = aggregate(qs, now);
      if (a) aggs.set(key, a); else aggs.delete(key);
      return a;
    };
    let lines: ChainLine[] = [];
    const lineOf = (chain: string) => lines.find((l) => l.c.chain === chain);

    /** Each wanted asset's deepest pool per chain, read now, so a viewer sees a price at once. */
    const seed = async (syms: string[], emit: (p: Parsed) => void) => {
      const now = () => Date.now();
      await Promise.all(syms.map(async (s) => {
        const key = keyOf.get(s);
        if (!key) return;
        const mine = byKey.get(key) ?? [];
        const firstPerChain = [...new Map(mine.map((p) => [p.e.chain, p])).values()].slice(0, 3);
        // Anchors first, so ETH-priced pools can be converted.
        const anchorsNeeded = new Set(firstPerChain.map((p) => quoteUsd(p.e.chain, p.e.quote)).filter((u): u is string => !!u && u !== "usd" && !aggs.has(u)));
        for (const a of anchorsNeeded) await seed([symOf.get(a) ?? ""], () => {});
        await Promise.all(firstPerChain.map(async (p) => {
          const r = await lineOf(p.e.chain)?.call("eth_call", [{ to: p.e.pool, data: SLOT0 }, "latest"]);
          if (typeof r !== "string" || r.length < 66) return;
          const px = poolPrice(word(r, 0), p.baseIs0, p.scale);
          if (Number.isFinite(px) && px > 0 && !p.midAt) { p.mid = px; p.midAt = now(); }
        }));
        const a = recompute(key, now());
        if (a) emit({ t: [{ s, p: a.p, v: 0, te: a.at, c: a.c }], r: [{ s, p: a.p, te: a.at }] });
      }));
    };

    /** About-24-hour-old prices for the overview: each asset's deepest pool, a few calls at a time. */
    const refreshDayAgo = async () => {
      const at = new Map<string, number | null>();
      for (const l of lines) at.set(l.c.chain, await blockAgo(l, 86_400_000));
      const anchorsFirst = [...byKey.keys()].sort((a, b) => Number(!CHAINS.some((c) => c.quotes.some((q) => q.usd === a))) - Number(!CHAINS.some((c) => c.quotes.some((q) => q.usd === b))));
      for (const key of anchorsFirst) {
        const p = (byKey.get(key) ?? [])[0];
        const b = p ? at.get(p.e.chain) : null;
        if (!p || !b) continue;
        const r = await lineOf(p.e.chain)?.call("eth_call", [{ to: p.e.pool, data: SLOT0 }, `0x${b.toString(16)}`]);
        if (typeof r !== "string" || r.length < 66) continue;
        const u = quoteUsd(p.e.chain, p.e.quote);
        const qp = u === "usd" ? 1 : u ? dayAgo.get(u) : undefined;
        const px = poolPrice(word(r, 0), p.baseIs0, p.scale) * (qp ?? Number.NaN);
        if (Number.isFinite(px) && px > 0) dayAgo.set(key, px);
        await new Promise((ok) => setTimeout(ok, 200));
      }
    };

    return {
      id: "onchain", feed: "rt", internal: false, url: "", maxUpstream: 600, stallMs: 90_000,
      connect(emit, note) {
        const byChain = new Map<string, string[]>();
        for (const p of pools.values()) byChain.set(p.e.chain, [...(byChain.get(p.e.chain) ?? []), p.e.pool]);
        const onLog = (log: Record<string, unknown>, line: ChainLine) => {
          const addr = typeof log.address === "string" ? log.address.toLowerCase() : "";
          const p = pools.get(`${line.c.chain}:${addr}`);
          if (!p || log.removed === true || typeof log.data !== "string") { emit({}); return; }
          const sw = decodeSwap(log.data, p.baseIs0, p.scale, p.e.decimals);
          if (!sw) { emit({}); return; }
          const now = Date.now();
          const ts = typeof log.blockTimestamp === "string" ? Number(BigInt(log.blockTimestamp)) * 1000 : typeof log.blockNumber === "string" ? line.blockAt.get(Number(BigInt(log.blockNumber))) : undefined;
          const te = ts ?? now;
          if (ts != null) { line.swaps += 1; if (line.lags.length < 500) line.lags.push(now - ts); else line.lags[line.swaps % 500] = now - ts; }
          p.mid = sw.price;
          p.midAt = te;
          const q = poolQuote(p, anchor, now);
          const usd = q ? Math.abs(sw.base) * q.p : 0;
          p.vol = p.vol * 0.5 ** ((now - p.volAt) / HALF_LIFE_MS) + (Number.isFinite(usd) ? usd : 0);
          p.volAt = now;
          const a = recompute(p.key, now);
          const s = symOf.get(p.key);
          if (!a || !s) { emit({}); return; }
          // Base into the pool is a sale (2); out of the pool, a purchase (1).
          const t: Trade = { s, p: a.p, v: Math.abs(sw.base), te, side: sw.base > 0 ? 2 : 1, c: a.c };
          emit({ t: [t], r: [{ s, p: a.p, te }] });
        };
        lines = CHAINS.filter((c) => byChain.has(c.chain)).map((c) => new ChainLine(c, byChain.get(c.chain)!, onLog, note));
        for (const l of lines) void l.open();
        // The 24 hour change: once the lines have heads, then every 30 minutes.
        const day = setTimeout(function run() { void refreshDayAgo(); dayTimer = setTimeout(run, 1_800_000); }, 15_000);
        let dayTimer: ReturnType<typeof setTimeout> = day;
        return {
          send(m: string) {
            let msg: { seed?: string[] };
            try { msg = JSON.parse(m); } catch { return; }
            if (Array.isArray(msg.seed)) void seed(msg.seed, emit);
          },
          close() { clearTimeout(dayTimer); for (const l of lines) l.close(); lines = []; },
          state: () => lines.map((l) => {
            const s = [...l.lags].sort((x, y) => x - y);
            const q = (f: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : null);
            return `${l.c.chain}:${l.ws ? (l.alive ? "up" : "connecting") : "down"}@${new URL(l.c.nodes[l.node]).hostname} swaps=${l.swaps} lag50=${q(0.5)} lag95=${q(0.95)}`;
          }).join(" | "),
        };
      },
      allows: (s) => keyOf.has(s),
      subscribe: (ss) => [JSON.stringify({ seed: ss })],
      unsubscribe: () => [],
      board: {
        subscribe: () => [JSON.stringify({ seed: ONCHAIN_SYMBOLS })],
        poll: {
          every: 60_000,
          async run() {
            const out: BoardPatch[] = [];
            for (const [key, a] of aggs) { const s = symOf.get(key); const o = dayAgo.get(key); if (s) out.push({ s, p: a.p, ...(o ? { o } : {}), te: a.at }); }
            return out;
          },
        },
      },
      parse: () => ({}),
    };
  },
  async history(symbol, tf) {
    const ms = TF_MS[tf];
    const t = REG.tokens.find((x) => x.sym === symbol);
    if (!ms || !t) return null;
    // The deepest pool, sampled once per bar, read over a short-lived socket to its chain.
    const e = [...t.pools].sort((a, b) => poolScore(b) - poolScore(a))[0];
    const p = livePool(e, t.key);
    const c = chainDef(e.chain);
    if (!p || !c) return null;
    const u = quoteUsd(e.chain, e.quote);
    const anchorTok = u && u !== "usd" ? REG.tokens.find((x) => x.key === u) : null;
    const anchorEntry = anchorTok?.pools.find((x) => x.chain === e.chain && quoteUsd(x.chain, x.quote) === "usd");
    const ap = anchorEntry ? livePool(anchorEntry, anchorTok!.key) : null;
    if (u !== "usd" && !ap) return null;
    const n = Math.min(tf === "1d" ? 30 : 60, BARS);
    const head = await headOf(c);
    if (!head) throw new Error("base node 429");
    const times = Array.from({ length: n }, (_, i) => Math.floor(head.at / ms) * ms - (n - 1 - i) * ms).concat(head.at);
    const blocks = times.map((x) => Math.max(1, head.n - Math.round((head.at - x) / c.blockMs)));
    const calls = blocks.flatMap((b) => [p, ...(ap ? [ap] : [])].map((q) => ({ method: "eth_call", params: [{ to: q.e.pool, data: SLOT0 }, `0x${b.toString(16)}`] })));
    const res = await rpcBatch(c, calls);
    const k = ap ? 2 : 1;
    const points: [number, number][] = [];
    times.forEach((x, i) => {
      const r = res[i * k], ra = ap ? res[i * k + 1] : null;
      if (typeof r !== "string" || r.length < 66) return;
      let px = poolPrice(word(r, 0), p.baseIs0, p.scale);
      if (ap) px = typeof ra === "string" && ra.length >= 66 ? px * poolPrice(word(ra, 0), ap.baseIs0, ap.scale) : Number.NaN;
      if (Number.isFinite(px) && px > 0) points.push([x, px]);
    });
    if (!points.length) throw new Error("base node 429");
    return fromPrices(points, tf);
  },
  symbols: async () => ONCHAIN_SYMBOLS,
};

// ------------------------------------------------------------------ calls for history

interface RpcReply { id: number; result?: string; error?: { message?: string } }
type Call = { method: string; params: unknown[] };

async function wsBatch(c: ChainDef, part: (Call & { jsonrpc: string; id: number })[]): Promise<RpcReply[]> {
  const res = await fetch(c.nodes[0].replace(/^wss/, "https"), { headers: { Upgrade: "websocket", "User-Agent": UA } });
  const ws = (res as Response & { webSocket?: WebSocket & { accept(): void } }).webSocket;
  if (!ws) throw new Error(`node ${res.status}`);
  ws.accept();
  return new Promise<RpcReply[]>((ok, fail) => {
    const got: RpcReply[] = [];
    const done = (f: () => void) => { clearTimeout(t); try { ws.close(1000); } catch { /* gone */ } f(); };
    const t = setTimeout(() => done(() => ok(got)), 10_000);
    ws.addEventListener("message", (e: MessageEvent) => {
      try { got.push(JSON.parse(String(e.data)) as RpcReply); } catch { /* skip */ }
      if (got.length >= part.length) done(() => ok(got));
    });
    ws.addEventListener("close", () => done(() => (got.length ? ok(got) : fail(new Error("node closed the line")))));
    // One call per message: some free nodes refuse batches.
    for (const x of part) ws.send(JSON.stringify(x));
  });
}

/** Calls over one short-lived socket, retrying refused ones a few times. Missing results are null. */
async function rpcBatch(c: ChainDef, calls: Call[]): Promise<(string | null)[]> {
  const out: (string | null)[] = calls.map(() => null);
  let todo = calls.map((_, i) => i);
  for (let round = 0; round < 3 && todo.length; round += 1) {
    if (round) await new Promise((ok) => setTimeout(ok, 800 * round));
    let body: RpcReply[] = [];
    try { body = await wsBatch(c, todo.map((k) => ({ jsonrpc: "2.0", id: k, ...calls[k] }))); } catch (e) { console.log(`[onchain] ${c.chain} history: ${String(e)}`); break; }
    const byId = new Map(body.map((r) => [r.id, r.result ?? null]));
    todo = todo.filter((k) => { const r = byId.get(k); if (typeof r === "string") { out[k] = r; return false; } return true; });
  }
  return out;
}

async function headOf(c: ChainDef): Promise<{ n: number; at: number } | null> {
  const [h] = await rpcBatch(c, [{ method: "eth_blockNumber", params: [] }]);
  return h ? { n: Number(BigInt(h)), at: Date.now() } : null;
}
