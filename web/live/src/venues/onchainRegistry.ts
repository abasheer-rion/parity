// The on-chain registry (DEC-0063): which chains we read, their free nodes, the quote tokens
// we price against, the DEX factories that find pools, and the rule that turns proposed
// pools into the list the fan-out streams. The list itself is onchain-registry.json, written
// by web/scripts/onchain-discover.ts. proposePools() is the one entry point for adding pools:
// the discovery script calls it, and so can the data registry's enrolment step.
//
// Pure code, no network and no imports: safe in the worker, the site's functions, tests and
// Node scripts (node --experimental-strip-types).
/** Uniswap v3 style Swap (Uniswap, Aerodrome Slipstream) and PancakeSwap v3's longer one. */
export const SWAP_UNI = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
export const SWAP_PANCAKE = "0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83";

/** A quote token: priced at 1 USD ("usd"), or by an anchor coin on the same chain (its CoinGecko id). */
export interface QuoteDef { key: string; address: string; decimals: number; usd: "usd" | string }
/** A pool factory: Uniswap v3 style getPool(a, b, fee) or Slipstream getPool(a, b, tickSpacing). */
export interface FactoryDef { dex: string; address: string; kind: "fee" | "spacing"; params: number[]; topic: string }
export interface ChainDef { chain: string; nodes: string[]; quotes: QuoteDef[]; factories: FactoryDef[]; blockMs: number }

const UNI_FEES = [100, 500, 3000, 10000];
const uni = (address: string): FactoryDef => ({ dex: "Uniswap v3", address, kind: "fee", params: UNI_FEES, topic: SWAP_UNI });
const ETH = "ethereum";

export const CHAINS: ChainDef[] = [
  { chain: "base", nodes: ["wss://base-rpc.publicnode.com", "wss://base.gateway.tenderly.co", "wss://base.drpc.org"],
    quotes: [
      { key: "USDC", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6, usd: "usd" },
      { key: "USDT", address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", decimals: 6, usd: "usd" },
      { key: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18, usd: ETH },
    ],
    factories: [uni("0x33128a8fc17869897dce68ed026d694621f6fdfd"), { dex: "Aerodrome", address: "0x5e7bb104d84c7cb9b682aac2f3d509f5f406809a", kind: "spacing", params: [1, 50, 100, 200, 2000], topic: SWAP_UNI }],
    blockMs: 2_000 },
  { chain: "arbitrum", nodes: ["wss://arbitrum-one-rpc.publicnode.com", "wss://arbitrum.gateway.tenderly.co", "wss://arbitrum.drpc.org"],
    quotes: [
      { key: "USDC", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6, usd: "usd" },
      { key: "USDT", address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6, usd: "usd" },
      { key: "WETH", address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", decimals: 18, usd: ETH },
    ],
    factories: [uni("0x1f98431c8ad98523631ae4a59f267346ea31f984")], blockMs: 250 },
  { chain: "bnb", nodes: ["wss://bsc-rpc.publicnode.com", "wss://bsc.drpc.org"],
    quotes: [
      { key: "USDT", address: "0x55d398326f99059ff775485246999027b3197955", decimals: 18, usd: "usd" },
      { key: "USDC", address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18, usd: "usd" },
      { key: "WBNB", address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", decimals: 18, usd: "binancecoin" },
    ],
    factories: [{ dex: "PancakeSwap v3", address: "0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865", kind: "fee", params: [100, 500, 2500, 10000], topic: SWAP_PANCAKE }, uni("0xdb1d10011ad0ff90774d0c6bb92e5c5c8b4461f7")],
    blockMs: 450 },
  { chain: "optimism", nodes: ["wss://optimism-rpc.publicnode.com", "wss://optimism.gateway.tenderly.co", "wss://optimism.drpc.org"],
    quotes: [
      { key: "USDC", address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", decimals: 6, usd: "usd" },
      { key: "USDT", address: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", decimals: 6, usd: "usd" },
      { key: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18, usd: ETH },
    ],
    factories: [uni("0x1f98431c8ad98523631ae4a59f267346ea31f984")], blockMs: 2_000 },
  { chain: "polygon", nodes: ["wss://polygon-bor-rpc.publicnode.com", "wss://polygon.gateway.tenderly.co", "wss://polygon.drpc.org"],
    quotes: [
      { key: "USDC", address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", decimals: 6, usd: "usd" },
      { key: "USDC.e", address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", decimals: 6, usd: "usd" },
      { key: "USDT", address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", decimals: 6, usd: "usd" },
      { key: "WETH", address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", decimals: 18, usd: ETH },
      { key: "WPOL", address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", decimals: 18, usd: "polygon-ecosystem-token" },
    ],
    factories: [uni("0x1f98431c8ad98523631ae4a59f267346ea31f984")], blockMs: 2_000 },
  { chain: "ethereum", nodes: ["wss://ethereum-rpc.publicnode.com", "wss://mainnet.gateway.tenderly.co", "wss://eth.drpc.org"],
    quotes: [
      { key: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6, usd: "usd" },
      { key: "USDT", address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6, usd: "usd" },
      { key: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", decimals: 18, usd: ETH },
    ],
    factories: [uni("0x1f98431c8ad98523631ae4a59f267346ea31f984")], blockMs: 12_000 },
];
export const chainDef = (chain: string) => CHAINS.find((c) => c.chain === chain);

/** One pool: chain, address, the base token's address and decimals on that chain, the quote
 *  token's key, venue, fee (a fraction), quote-side depth in USD, swaps seen in the discovery
 *  window (null when not measured) and the Swap event it emits. */
export interface PoolEntry { chain: string; pool: string; base: string; decimals: number; quote: string; dex: string; fee: number; liq: number; swaps: number | null; topic: string; /** The wrapped or pegged form this pool trades ("cbBTC"), when not the asset itself. */ via?: string }
/** One asset. key: the CoinGecko id (or our own key). via: the wrapped or pegged forms its
 *  pools trade ("WBTC, cbBTC"), from the pools kept. Its pools may sit on several chains. */
export interface TokenEntry { key: string; sym: string; name: string; rank: number | null; via?: string; pools: PoolEntry[] }
export interface Registry { at: string; minLiqUsd: number; tokens: TokenEntry[] }

/** A proposal: an asset and pools found for it (any chains). Same shape as an entry. */
export type Proposal = TokenEntry;

export interface ProposeOptions {
  /** Pools shallower than this (quote side, USD) are left out. */
  minLiqUsd?: number;
  /** Pools kept per asset, and per chain. */
  maxPools?: number;
  maxPerChain?: number;
  /** A slow chain's pools count this much less (Ethereum's 12 s blocks: 5 times less). */
  slowDiscount?: number;
  now?: string;
}

/** What a quote token is priced in: "usd", or an anchor asset's key (ETH, BNB, POL). */
export const quoteUsd = (chain: string, quote: string) => chainDef(chain)?.quotes.find((q) => q.key === quote)?.usd;
/** A pool's weight before any swaps: depth, a quarter for a pool that did not trade in the
 *  discovery window, discounted on slow chains. */
export function poolScore(p: PoolEntry, slowDiscount = 5): number {
  const slow = (chainDef(p.chain)?.blockMs ?? 2_000) > 5_000 ? 1 / slowDiscount : 1;
  return p.liq * (p.swaps === 0 ? 0.25 : 1) * slow;
}

/**
 * Merge proposals into a registry. Per asset: every known pool on every chain, old and new
 * (a new proposal for the same pool replaces the old), keeping the deepest few (by
 * poolScore) at or above minLiqUsd, at most maxPerChain per chain and within 2% of the best.
 * Assets that price nothing are dropped, as are pools quoted in an anchor (ETH, BNB, POL)
 * that has no dollar pool of its own. Symbols are BASE-USD; when two assets share a ticker,
 * the higher ranked keeps it. Returns a new registry; the input is not changed. This is the
 * entry point for anyone adding pools (the discovery script, the data registry's enrolment).
 */
export function proposePools(reg: Registry | null, proposals: Proposal[], opts: ProposeOptions = {}): Registry {
  const minLiq = opts.minLiqUsd ?? reg?.minLiqUsd ?? 50_000;
  const maxPools = opts.maxPools ?? 8, maxPerChain = opts.maxPerChain ?? 3;
  const merged = new Map<string, TokenEntry>();
  for (const t of [...(reg?.tokens ?? []), ...proposals]) {
    const old = merged.get(t.key);
    const pools = new Map((old?.pools ?? []).map((x) => [`${x.chain}:${x.pool}`, x]));
    for (const x of t.pools) { const pool = x.pool.toLowerCase(); pools.set(`${x.chain}:${pool}`, { ...x, pool, base: x.base.toLowerCase() }); }
    merged.set(t.key, { ...(old ?? t), ...t, pools: [...pools.values()] });
  }
  const pick = (t: TokenEntry, ok: (x: PoolEntry) => boolean): PoolEntry[] => {
    const cands = t.pools.filter((x) => x.liq >= minLiq && quoteUsd(x.chain, x.quote) != null && ok(x)).sort((a, b) => poolScore(b, opts.slowDiscount) - poolScore(a, opts.slowDiscount));
    const best = cands[0] ? poolScore(cands[0], opts.slowDiscount) : 0;
    const perChain = new Map<string, number>();
    const out: PoolEntry[] = [];
    for (const x of cands) {
      if (out.length >= maxPools || poolScore(x, opts.slowDiscount) < best * 0.02) break;
      const n = perChain.get(x.chain) ?? 0;
      if (n >= maxPerChain) continue;
      perChain.set(x.chain, n + 1);
      out.push(x);
    }
    return out;
  };
  // Anchors first: priced only from dollar pools, so no asset is priced in a circle.
  const anchors = new Set(CHAINS.flatMap((c) => c.quotes.map((q) => q.usd)).filter((u) => u !== "usd"));
  const priced = new Map<string, TokenEntry>();
  for (const key of anchors) {
    const t = merged.get(key);
    const pools = t ? pick(t, (x) => quoteUsd(x.chain, x.quote) === "usd") : [];
    if (t && pools.length) priced.set(key, { ...t, pools });
  }
  for (const t of merged.values()) {
    if (anchors.has(t.key)) continue;
    const pools = pick(t, (x) => { const u = quoteUsd(x.chain, x.quote); return u === "usd" || priced.has(u!); });
    if (pools.length) priced.set(t.key, { ...t, pools });
  }
  // One ticker, one asset: the higher ranked keeps it.
  const seen = new Set<string>();
  const tokens: TokenEntry[] = [];
  for (const t of [...priced.values()].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.key.localeCompare(b.key))) {
    const sym = `${t.sym.toUpperCase().replace(/-USD$/, "").replace(/[^A-Z0-9]/g, "")}-USD`;
    if (!/^[A-Z0-9]{1,15}-USD$/.test(sym) || seen.has(sym)) continue;
    seen.add(sym);
    const via = [...new Set(t.pools.map((x) => x.via).filter((v): v is string => !!v))].join(", ");
    const { via: _drop, ...rest } = t;
    void _drop;
    tokens.push({ ...rest, sym, ...(via ? { via } : {}) });
  }
  return { at: opts.now ?? new Date().toISOString(), minLiqUsd: minLiq, tokens };
}

/** One pool the data registry's gate enrolled (DEC-0078), with the asset it prices. */
export interface EnrolledPool extends PoolEntry { token: string; series: string; enrolledAt: string }
/** onchain-enrolled.json, written only by engine/src/parity/registry/feed.py (pool-enrol.yml). */
export interface EnrolledList { at: string | null; pools: EnrolledPool[] }

/** The same caps proposePools keeps: pools per asset and per chain. */
export const ENROLL_MAX_POOLS = 8;
export const ENROLL_MAX_PER_CHAIN = 3;

/**
 * Add the enrolled pools to the registry the fan-out streams. A pool joins only an asset the
 * registry already prices, only when it is as deep as the registry's bar, quoted in a token we
 * can price, not already listed, and while the asset stays within ENROLL_MAX_POOLS pools and
 * ENROLL_MAX_PER_CHAIN per chain. Returns a new registry; neither input is changed.
 */
export function withEnrolled(reg: Registry, list: EnrolledList | null | undefined): Registry {
  if (!list?.pools?.length) return reg;
  const tokens = reg.tokens.map((t) => ({ ...t, pools: [...t.pools] }));
  for (const e of list.pools) {
    const t = tokens.find((x) => x.key === e.token);
    if (!t || e.liq < reg.minLiqUsd || quoteUsd(e.chain, e.quote) == null) continue;
    const pool = e.pool.toLowerCase();
    if (t.pools.some((x) => x.chain === e.chain && x.pool.toLowerCase() === pool)) continue;
    if (t.pools.length >= ENROLL_MAX_POOLS) continue;
    if (t.pools.filter((x) => x.chain === e.chain).length >= ENROLL_MAX_PER_CHAIN) continue;
    const { token: _t, series: _s, enrolledAt: _a, ...entry } = e;
    void _t; void _s; void _a;
    t.pools.push({ ...entry, pool, base: e.base.toLowerCase() });
  }
  return { ...reg, tokens };
}
