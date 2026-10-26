// Parity on-chain (DEC-0063): our own public feed, built from public blockchain data. Every
// swap in the deepest Uniswap v3 and Aerodrome pools on Base arrives over one log
// subscription; each swap moves that pool's price, and a symbol's price is the
// volume-weighted average of its pools' prices, in USDC. Pools priced in WETH are turned
// into USDC with the ETH composite. Blockchain data carries no licence, so anyone may see it.
//
// Times: a swap's exchange time is its block's timestamp. Base seals a block every 2 s, so a
// swap can wait up to 2 s before it is final; the badge counts from the block.
// History: the deepest pool's price read at past blocks (one batched request), so bars are
// built from closes, like CoinGecko's.
import { allowed, BARS, fromPrices, memo, TF_MS, type AdapterDef, type BoardPatch, type Parsed, type Trade } from "../base";

/** A free public Base node (PublicNode). No key, no account. */
const WSS = "wss://base-rpc.publicnode.com";
const RPC = "https://base-rpc.publicnode.com";
const SWAP = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
const SLOT0 = "0x3850c7bd";
/** Base makes one block every 2 s. */
const BLOCK_MS = 2_000;
/** Volume weights fade with a 5 minute half-life, so the pools trading now count most. */
const HALF_LIFE_MS = 300_000;

const TOKENS: Record<string, [address: string, decimals: number]> = {
  WETH: ["0x4200000000000000000000000000000000000006", 18],
  USDC: ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 6],
  CBBTC: ["0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf", 8],
  EURC: ["0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42", 6],
  AERO: ["0x940181a94a35a4569e4529a3cdfb74e38fd98631", 18],
  VIRTUAL: ["0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", 18],
  BRETT: ["0x532f27101965dd16442e59d40670faf5ebb142e4", 18],
  DEGEN: ["0x4ed4e862860bed51a9570b96d89af5e1b0efefed", 18],
  MORPHO: ["0xbaa5cc21fd487b8fcc2f632f3f4e8d37262a0842", 18],
  TOSHI: ["0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4", 18],
  UNI: ["0xc3de830ea07524a0761646a6a4e4be0e114a3c83", 18],
  CBETH: ["0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22", 18],
  WSTETH: ["0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452", 18],
  USDT: ["0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", 6],
  LINK: ["0x88fb150bdc53a65fe94dea0c9ba0a6daf8c6e196", 18],
};

/**
 * The pools, deepest first per token: [base token, quote token, pool address, venue and fee,
 * starting weight (quote side in thousands of USD on 26 Oct 2026)]. The starting weight only
 * matters until the pools trade. Refresh the list with web/scripts/onchain-pools.mjs.
 */
export const POOLS: [string, "USDC" | "WETH", string, string, number][] = [
  ["WETH", "USDC", "0xd0b53d9277642d899df5c87a3966a349a798f224", "Uniswap v3 0.05%", 2049],
  ["WETH", "USDC", "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59", "Aerodrome CL100", 964],
  ["WETH", "USDC", "0x6c561b446416e1a00e8e93e221854d6ea4171372", "Uniswap v3 0.3%", 500],
  ["WETH", "USDC", "0x0b1c2dcbbfa744ebd3fc17ff1a96a1e1eb4b2d69", "Uniswap v3 1%", 100],
  ["CBBTC", "USDC", "0xfbb6eed8e7aa03b138556eedaf5d271a5e1e43ef", "Uniswap v3 0.05%", 4703],
  ["CBBTC", "WETH", "0x7aea2e8a3843516afa07293a10ac8e49906dabd1", "Uniswap v3 0.05%", 4000],
  ["CBBTC", "WETH", "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1", "Aerodrome CL100", 2000],
  ["CBBTC", "USDC", "0x4e962bb3889bf030368f56810a9c96b83cb3e778", "Aerodrome CL100", 952],
  ["EURC", "USDC", "0xe846373c1a92b167b4e9cd5d8e4d6b1db9e90ec7", "Aerodrome CL50", 111],
  ["EURC", "USDC", "0xc5e51044eb7318950b1afb044fccfb25782c48c1", "Aerodrome CL1", 86],
  ["EURC", "USDC", "0x7279c08a36333e12c3fc81747963264c100d66fb", "Uniswap v3 0.05%", 45],
  ["AERO", "WETH", "0x3d5d143381916280ff91407febeb52f2b60f33cf", "Uniswap v3 0.3%", 1024],
  ["AERO", "WETH", "0x82321f3beb69f503380d6b233857d5c43562e2d0", "Aerodrome CL200", 182],
  ["AERO", "USDC", "0xbe00ff35af70e8415d0eb605a286d8a45466a4c1", "Aerodrome CL2000", 126],
  ["AERO", "USDC", "0xe5b5f522e98b5a2baae212d4da66b865b781db97", "Uniswap v3 0.05%", 65],
  ["VIRTUAL", "WETH", "0x9c087eb773291e50cf6c6a90ef0f4500e349b903", "Uniswap v3 0.05%", 196],
  ["VIRTUAL", "USDC", "0x529d2863a1521d0b57db028168fde2e97120017c", "Uniswap v3 0.3%", 190],
  ["VIRTUAL", "WETH", "0xc200f21efe67c7f41b81a854c26f9cda80593065", "Aerodrome CL200", 71],
  ["BRETT", "WETH", "0xba3f945812a83471d709bce9c3ca699a19fb46f7", "Uniswap v3 1%", 1185],
  ["BRETT", "WETH", "0x4e829f8a5213c42535ab84aa40bd4adcce9cba02", "Aerodrome CL200", 554],
  ["DEGEN", "WETH", "0xc9034c3e7f58003e6ae0c8438e7c8f4598d5acaa", "Uniswap v3 0.3%", 203],
  ["DEGEN", "WETH", "0x0ca6485b7e9cf814a3fd09d81672b07323535b64", "Uniswap v3 1%", 179],
  ["MORPHO", "WETH", "0x2f42df4af5312b492e9d7f7b2110d9c7bf2d9e4f", "Uniswap v3 0.3%", 208],
  ["MORPHO", "WETH", "0xb5f0b4ae66c14f7efaa9aa1468e8fc536a3e288c", "Aerodrome CL200", 134],
  ["MORPHO", "USDC", "0x2043b296ffc6b2d3bf4a3f3167d2afb3b0fbdbee", "Uniswap v3 1%", 123],
  ["TOSHI", "WETH", "0x4b0aaf3ebb163dd45f663b38b6d93f6093ebc2d3", "Uniswap v3 1%", 714],
  ["UNI", "WETH", "0xab365f161dd501473a1ff0d2ef0dce94e7398839", "Uniswap v3 1%", 337],
  ["CBETH", "WETH", "0x47ca96ea59c13f72745928887f84c9f52c3d7348", "Aerodrome CL1", 488],
  ["CBETH", "WETH", "0x10648ba41b8565907cfa1496765fa4d95390aa0d", "Uniswap v3 0.05%", 58],
  ["WSTETH", "WETH", "0x20e068d76f9e90b90604500b84c7e19dcb923e7e", "Uniswap v3 0.01%", 80],
  ["WSTETH", "WETH", "0x861a2922be165a5bd41b1e482b49216b465e1b5f", "Aerodrome CL1", 78],
  ["USDT", "USDC", "0xa41bc0affba7fd420d186b84899d7ab2ac57fcd1", "Aerodrome CL1", 105],
  ["USDT", "USDC", "0xd56da2b74ba826f19015e6b7dd9dae1903e85da1", "Uniswap v3 0.01%", 62],
  ["LINK", "WETH", "0x72be417afb0abea66913141c605d313bb389b59c", "Aerodrome CL100", 91],
];

/** Our symbol for a base token: ETH for WETH, the token's ticker otherwise, priced in USDC. */
export const symOf = (base: string) => `${base === "WETH" ? "ETH" : base}-USDC`;
export const ONCHAIN_SYMBOLS = [...new Set(POOLS.map((p) => symOf(p[0])))];
const ETH = symOf("WETH");

interface Pool { addr: string; sym: string; quote: "USDC" | "WETH"; baseIs0: boolean; scale: number; baseDec: number; w0: number; mid: number; vol: number; volAt: number }

const word = (hex: string, i: number) => BigInt(`0x${hex.slice(2 + i * 64, 2 + (i + 1) * 64) || "0"}`);
const signed = (x: bigint) => (x >= 1n << 255n ? x - (1n << 256n) : x);
const Q96 = 2 ** 96;

/** Quote per base from a pool's sqrtPriceX96. */
export function poolPrice(sqrtX96: bigint, baseIs0: boolean, scale: number): number {
  const r = Number(sqrtX96) / Q96;
  const p10 = r * r * scale; // token1 per token0, in whole units
  return baseIs0 ? p10 : p10 > 0 ? 1 / p10 : Number.NaN;
}

/** The base and quote amounts of one swap (positive: into the pool) and its new price. */
export function decodeSwap(data: string, baseIs0: boolean, scale: number, baseDec: number): { price: number; base: number } | null {
  if (typeof data !== "string" || data.length < 2 + 64 * 3) return null;
  const a0 = signed(word(data, 0)), a1 = signed(word(data, 1));
  const price = poolPrice(word(data, 2), baseIs0, scale);
  const base = Number(baseIs0 ? a0 : a1) / 10 ** baseDec;
  return Number.isFinite(price) && price > 0 ? { price, base } : null;
}

function makePools(): Map<string, Pool> {
  const out = new Map<string, Pool>();
  for (const [base, quote, addr, , w0] of POOLS) {
    const [ba, bd] = TOKENS[base], [qa, qd] = TOKENS[quote];
    const baseIs0 = ba.toLowerCase() < qa.toLowerCase();
    const [d0, d1] = baseIs0 ? [bd, qd] : [qd, bd];
    out.set(addr, { addr, sym: symOf(base), quote, baseIs0, scale: 10 ** (d0 - d1), baseDec: bd, w0, mid: Number.NaN, vol: 0, volAt: 0 });
  }
  return out;
}

interface RpcReply { id: number; result?: string; error?: { message?: string } }
type Call = { method: string; params: unknown[] };
const UA = "parity-live (contact@paritytrading.ai)";

/** One batch over a short-lived WebSocket. The node limits plain HTTP from Cloudflare's shared
 *  addresses (429) far sooner than it limits sockets, so sockets go first. */
async function wsBatch(part: (Call & { jsonrpc: string; id: number })[]): Promise<RpcReply[]> {
  const res = await fetch(RPC, { headers: { Upgrade: "websocket", "User-Agent": UA } });
  const ws = (res as Response & { webSocket?: WebSocket & { accept(): void } }).webSocket;
  if (!ws) throw new Error(`base node ${res.status}`);
  ws.accept();
  return new Promise<RpcReply[]>((ok, fail) => {
    const done = (f: () => void) => { clearTimeout(t); try { ws.close(1000); } catch { /* gone */ } f(); };
    const t = setTimeout(() => done(() => fail(new Error("base node timed out"))), 15_000);
    ws.addEventListener("message", (e: MessageEvent) => {
      try { const body = JSON.parse(String(e.data)) as RpcReply[] | RpcReply; done(() => ok(Array.isArray(body) ? body : [body])); } catch (err) { done(() => fail(err as Error)); }
    });
    ws.addEventListener("close", () => done(() => fail(new Error("base node closed the line"))));
    ws.send(JSON.stringify(part));
  });
}

async function httpBatch(part: (Call & { jsonrpc: string; id: number })[]): Promise<RpcReply[]> {
  const res = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA }, body: JSON.stringify(part) });
  if (!res.ok) throw new Error(`base node ${res.status}`);
  const body = (await res.json()) as RpcReply[] | RpcReply;
  return Array.isArray(body) ? body : [body];
}

/** Calls in batches of 10. Cloudflare's addresses are shared, so the free node often refuses
 *  part of a batch (rate limit); refused calls are retried after a pause, for up to 20 s.
 *  A call still refused then reads as null, and history simply has fewer points. */
async function rpcBatch(calls: Call[]): Promise<(string | null)[]> {
  const out: (string | null)[] = calls.map(() => null);
  let todo = calls.map((_, i) => i);
  const until = Date.now() + 20_000;
  for (let round = 0; todo.length && Date.now() < until; round += 1) {
    if (round) await new Promise((ok) => setTimeout(ok, 600 * round));
    const left: number[] = [];
    for (let i = 0; i < todo.length; i += 10) {
      const ids = todo.slice(i, i + 10);
      const part = ids.map((k) => ({ jsonrpc: "2.0", id: k, ...calls[k] }));
      let body: RpcReply[] = [];
      try { body = await wsBatch(part); } catch (e) {
        try { body = await httpBatch(part); } catch (e2) { console.log(`[onchain] node did not answer: ${String(e)}; ${String(e2)}`); }
      }
      const byId = new Map(body.map((r) => [r.id, r.result ?? null]));
      for (const k of ids) { const r = byId.get(k); if (r != null) out[k] = r; else left.push(k); }
    }
    todo = left;
  }
  if (todo.length) console.log(`[onchain] node refused ${todo.length} of ${calls.length} calls`);
  return out;
}
const headBlock = async () => {
  const [h] = await rpcBatch([{ method: "eth_blockNumber", params: [] }]);
  if (!h) throw new Error("base node gave no block");
  return { n: Number(BigInt(h)), at: Date.now() };
};
/** Every pool's price at one block ("latest" or a number). */
async function midsAt(pools: Pool[], block: string): Promise<Map<string, number>> {
  const res = await rpcBatch(pools.map((p) => ({ method: "eth_call", params: [{ to: p.addr, data: SLOT0 }, block] })));
  const out = new Map<string, number>();
  pools.forEach((p, i) => { const r = res[i]; if (r && r.length >= 66) out.set(p.addr, poolPrice(word(r, 0), p.baseIs0, p.scale)); });
  return out;
}

/** Starting prices, shared for a minute by every caller in this isolate. */
const startMids = memo(60_000, () => midsAt([...makePools().values()], "latest"));
/** Prices 24 hours ago, for the overview's change column; kept ten minutes. */
const dayAgoMids = memo(600_000, async () => {
  const head = await headBlock();
  return midsAt([...makePools().values()], `0x${(head.n - 86_400_000 / BLOCK_MS).toString(16)}`);
});

/** A symbol's price: its pools' prices in USDC, weighted by recent volume (or depth before any trades). */
export function composite(pools: Pool[], ethUsd: number, now: number): number {
  let sw = 0, sp = 0;
  for (const p of pools) {
    const px = p.quote === "WETH" ? p.mid * ethUsd : p.mid;
    if (!Number.isFinite(px) || px <= 0) continue;
    const vol = p.vol * 0.5 ** ((now - p.volAt) / HALF_LIFE_MS);
    const w = vol + p.w0 * 0.01;
    sw += w; sp += w * px;
  }
  return sw > 0 ? sp / sw : Number.NaN;
}

export const onchain: AdapterDef = {
  id: "onchain",
  enabled: (env) => allowed("onchain", env),
  make: () => {
    const pools = makePools();
    const bySym = new Map<string, Pool[]>();
    for (const p of pools.values()) bySym.set(p.sym, [...(bySym.get(p.sym) ?? []), p]);
    const priceOf = (sym: string, now: number) => composite(bySym.get(sym) ?? [], sym === ETH ? 1 : composite(bySym.get(ETH) ?? [], 1, now), now);
    let dayAgo = new Map<string, number>();
    const openOf = (sym: string): number => composite((bySym.get(sym) ?? []).map((p) => ({ ...p, mid: dayAgo.get(p.addr) ?? Number.NaN, vol: 0 })), sym === ETH ? 1 : openOf(ETH), 0);
    return {
      id: "onchain", feed: "rt", internal: false, url: WSS, maxUpstream: 60, stallMs: 60_000,
      async prepare() {
        // Starting prices are a head start only: without them, prices fill in from the swaps.
        try {
          const mids = await startMids();
          for (const p of pools.values()) { const m = mids.get(p.addr); if (m != null && Number.isFinite(m)) p.mid = m; }
        } catch (e) { console.log(`[onchain] starting prices failed: ${String(e)}`); }
        try { dayAgo = await dayAgoMids(); } catch (e) { console.log(`[onchain] day-ago prices failed: ${String(e)}`); }
      },
      // One subscription for every pool's swaps; the fan-out keeps only what viewers want.
      hello: () => [JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["logs", { address: [...pools.keys()], topics: [SWAP] }] })],
      allows: (s) => bySym.has(s),
      subscribe: () => [],
      unsubscribe: () => [],
      board: {
        subscribe: () => [],
        poll: {
          every: 60_000,
          async run() {
            try { dayAgo = await dayAgoMids(); } catch { /* keep the last */ }
            const now = Date.now();
            const out: BoardPatch[] = [];
            for (const s of bySym.keys()) { const p = priceOf(s, now), o = openOf(s); if (Number.isFinite(p)) out.push({ s, p, ...(Number.isFinite(o) ? { o } : {}), te: now }); }
            return out;
          },
        },
      },
      parse(data): Parsed {
        let m: { id?: number; error?: { message?: string }; method?: string; params?: { result?: { address?: string; data?: string; blockTimestamp?: string; removed?: boolean } } };
        try { m = JSON.parse(data); } catch { return {}; }
        if (m.error) return { fail: `Base node: ${m.error.message ?? "error"}` };
        const log = m.method === "eth_subscription" ? m.params?.result : undefined;
        if (!log?.address || !log.data || log.removed) return {};
        const pool = pools.get(log.address.toLowerCase());
        if (!pool) return {};
        const sw = decodeSwap(log.data, pool.baseIs0, pool.scale, pool.baseDec);
        if (!sw) return {};
        const now = Date.now();
        const te = log.blockTimestamp ? Number(BigInt(log.blockTimestamp)) * 1000 : now;
        pool.mid = sw.price;
        const ethUsd = pool.sym === ETH ? 1 : composite(bySym.get(ETH) ?? [], 1, now);
        const usd = Math.abs(sw.base) * (pool.quote === "WETH" ? sw.price * ethUsd : sw.price);
        pool.vol = pool.vol * 0.5 ** ((now - pool.volAt) / HALF_LIFE_MS) + (Number.isFinite(usd) ? usd : 0);
        pool.volAt = now;
        const p = priceOf(pool.sym, now);
        if (!Number.isFinite(p)) return {};
        // Base into the pool is a sale (2); out of the pool, a purchase (1).
        const t: Trade = { s: pool.sym, p, v: Math.abs(sw.base), te, side: sw.base > 0 ? 2 : 1 };
        return { t: [t], r: [{ s: pool.sym, p, te }] };
      },
      ping: () => JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] }),
      pingEvery: 20_000,
    };
  },
  async history(symbol, tf) {
    const ms = TF_MS[tf];
    const all = [...makePools().values()].filter((p) => p.sym === symbol);
    if (!ms || !all.length) return null;
    // The deepest pool, sampled once per bar; the archive reaches back about 30 days.
    const pool = all[0];
    const n = Math.min(tf === "1d" ? 30 : tf === "4h" ? 90 : tf === "1h" ? 168 : 120, BARS);
    const head = await headBlock();
    const times = Array.from({ length: n }, (_, i) => Math.floor(head.at / ms) * ms - (n - 1 - i) * ms).concat(head.at);
    const blocks = times.map((t) => Math.max(1, head.n - Math.round((head.at - t) / BLOCK_MS)));
    const calls = blocks.map((b) => ({ method: "eth_call", params: [{ to: pool.addr, data: SLOT0 }, `0x${b.toString(16)}`] }));
    if (pool.quote === "WETH") {
      const eth = makePools().get(POOLS[0][2])!;
      calls.push(...blocks.map((b) => ({ method: "eth_call", params: [{ to: eth.addr, data: SLOT0 }, `0x${b.toString(16)}`] })));
    }
    const res = await rpcBatch(calls);
    const eth = makePools().get(POOLS[0][2])!;
    const points: [number, number][] = [];
    times.forEach((t, i) => {
      const r = res[i];
      if (!r || r.length < 66) return;
      let p = poolPrice(word(r, 0), pool.baseIs0, pool.scale);
      if (pool.quote === "WETH") { const e = res[n + 1 + i]; p = e && e.length >= 66 ? p * poolPrice(word(e, 0), eth.baseIs0, eth.scale) : Number.NaN; }
      if (Number.isFinite(p) && p > 0) points.push([t, p]);
    });
    // Nothing read: fail, so the edge serves its last good copy instead of an empty chart.
    if (!points.length) throw new Error("base node 429");
    return fromPrices(points, tf);
  },
  symbols: async () => ONCHAIN_SYMBOLS,
};
