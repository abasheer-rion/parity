// Crypto for the fill price check: the swaps in our on-chain pools (DEC-0063, DEC-0065), read
// from Base. Every swap moves its pool to a price someone actually traded at, so the swaps
// around a fill's time give the range the market traded in. Blockchain data carries no
// licence; we read it through the same free nodes as the live feed. Exchanges' own candles
// are not used: their terms forbid this use (DEC-0092).
//
// Base makes a block every 2 seconds since its first one, so a time gives its block exactly
// and no lookups are needed. The free node (PublicNode) keeps about the last eight weeks of
// swaps; older ones need a node with full history, which the owner can set as BASE_RPC_URL
// (a secret, as it carries a key). Tenderly's free gateway is not used: its terms allow
// personal use only. Pools priced in WETH are turned into dollars with the swaps of
// ETH's own dollar pools in the same minute.
import REGISTRY from "../../../../live/src/venues/onchain-registry.json" with { type: "json" };
import ENROLLED from "../../../../live/src/venues/onchain-enrolled.json" with { type: "json" };
import { chainDef, SWAP_UNI, withEnrolled, type EnrolledList, type PoolEntry, type Registry } from "../../../../live/src/venues/onchainRegistry";
import type { Bar } from "./engine";
import { SOURCE_INFO } from "./info";
import { USD_LIKE } from "./market";
import type { Ctx, SpanSource } from "./sources";

const REG = withEnrolled(REGISTRY as unknown as Registry, ENROLLED as unknown as EnrolledList);
const CHAIN = "base";
/** Base's first block, in seconds since 1970, and its block time. */
export const BASE_GENESIS = 1_686_789_347;
const BLOCK_S = 2;
const FREE_NODE = "https://base-rpc.publicnode.com";
const MIN = 60_000;
const Q96 = 2 ** 96;

export const blockAt = (ms: number) => Math.max(0, Math.floor((ms / 1000 - BASE_GENESIS) / BLOCK_S));
export const timeOf = (block: number) => (BASE_GENESIS + block * BLOCK_S) * 1000;

export interface Pool { address: string; baseIs0: boolean; scale: number; decimals: number; usd: boolean }

function poolOf(e: PoolEntry): Pool | null {
  const q = chainDef(CHAIN)?.quotes.find((x) => x.key === e.quote);
  if (!q) return null;
  const baseIs0 = e.base.toLowerCase() < q.address.toLowerCase();
  const [d0, d1] = baseIs0 ? [e.decimals, q.decimals] : [q.decimals, e.decimals];
  return { address: e.pool.toLowerCase(), baseIs0, scale: 10 ** (d0 - d1), decimals: e.decimals, usd: q.usd === "usd" };
}

/** A token's Base pools ("ETH-USD"), each with how to read its price. */
export const basePools = (sym: string): Pool[] => (REG.tokens.find((t) => t.sym === sym)?.pools ?? []).filter((p) => p.chain === CHAIN).map(poolOf).filter((p): p is Pool => !!p);

/** The price a swap left its pool at, quote per base. Uniswap v3 and Aerodrome Slipstream share the layout. */
export function swapPrice(data: string, p: Pool): number | null {
  if (typeof data !== "string" || data.length < 2 + 64 * 3) return null;
  const sqrt = BigInt(`0x${data.slice(2 + 128, 2 + 192)}`);
  const r = Number(sqrt) / Q96;
  const v = r * r * p.scale;
  const price = p.baseIs0 ? v : v > 0 ? 1 / v : Number.NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
}

interface Log { address: string; blockNumber: string; blockTimestamp?: string; data: string; topics?: string[] }

export const ONCHAIN: SpanSource = {
  // A pool is another venue: its price can sit up to its fee (0.05% to 1%) away from an
  // exchange's, and fewer trades happen there, so ten minutes either side and 1%.
  ...SOURCE_INFO["onchain-base"],
  exactTime: true,
  terms: "https://www.publicnode.com/terms",
  lag: MIN,
  gap: 250,
  // 900 blocks a call: the fallback node reads at most 1,000 blocks at a time without a key.
  maxSpan: 30 * MIN,
  enabled: () => true,
  get coins() { return ONCHAIN_COINS; },
  async venueSymbol(sym) {
    const [base, quote] = sym.split("-");
    if (!base || !USD_LIKE.has(quote)) return null;
    const key = `${base}-USD`;
    return basePools(key).length ? key : null;
  },
  async spanBars(vsym, from, to, ctx: Ctx): Promise<Bar[]> {
    const pools = basePools(vsym);
    const needEth = pools.some((p) => !p.usd);
    const eth = needEth ? basePools("ETH-USD").filter((p) => p.usd) : [];
    if (!pools.length || (needEth && !eth.length)) return [];
    const all = [...pools, ...eth.filter((e) => !pools.some((p) => p.address === e.address))];
    const byAddr = new Map(all.map((p) => [p.address, p]));
    const params = [{ address: all.map((p) => p.address), fromBlock: `0x${blockAt(from).toString(16)}`, toBlock: `0x${blockAt(to).toString(16)}`, topics: [[SWAP_UNI]] }];
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params });
    const node = ctx.env.BASE_RPC_URL || FREE_NODE;
    let res: { result?: Log[]; error?: { message?: string } };
    try {
      res = (await ctx.get(ONCHAIN, node, { body, headers: { "Content-Type": "application/json" } })) as typeof res;
    } catch (e) {
      // The free node answers 403 for blocks older than the history it keeps.
      if ((e as { status?: number }).status === 403) throw Object.assign(new Error("older than the node keeps"), { why: "old" });
      throw e;
    }
    if (!Array.isArray(res.result)) throw new Error(res.error?.message ?? "no result");
    const logs = res.result;
    // ETH's dollar price from its own pools, by time.
    const ethPts: [number, number][] = [];
    const raw: [number, number, Pool][] = [];
    for (const l of logs) {
      const p = byAddr.get(String(l.address).toLowerCase());
      const price = p ? swapPrice(l.data, p) : null;
      if (!p || price == null) continue;
      // The node's block time when it gives one; Base's fixed 2 seconds a block otherwise.
      const t = l.blockTimestamp ? parseInt(l.blockTimestamp, 16) * 1000 : timeOf(parseInt(l.blockNumber, 16));
      if (eth.some((e) => e.address === p.address)) ethPts.push([t, price]);
      if (pools.includes(p)) raw.push([t, price, p]);
    }
    ethPts.sort((a, b) => a[0] - b[0]);
    const bars: Bar[] = [];
    for (const [t, price, p] of raw) {
      if (p.usd) { bars.push([t, price, price]); continue; }
      // ETH's low and high within a minute of the swap, or the nearest ETH swap.
      const near = ethPts.filter(([x]) => Math.abs(x - t) <= MIN).map(([, v]) => v);
      if (!near.length && ethPts.length) near.push(ethPts.reduce((a, b) => (Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a))[1]);
      if (!near.length) continue;
      bars.push([t, price * Math.min(...near), price * Math.max(...near)]);
    }
    return bars.sort((a, b) => a[0] - b[0]);
  },
};

/** Coins the on-chain source covers ("BTC", "ETH"). */
export const ONCHAIN_COINS = REG.tokens.filter((t) => basePools(t.sym).length).map((t) => t.sym.replace(/-USD$/, ""));
