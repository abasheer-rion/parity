// The Parity price (DEC-0063, DEC-0065): swap decoding, the Pyth-style aggregate, pool
// picking across chains, the registry, and the badge's plain words. No network.
import { describe, expect, it } from "vitest";
import { decodeSwap, livePool, onchain, ONCHAIN_SYMBOLS, poolPrice, poolQuote } from "../live/src/venues/onchain";
import { CHAINS, proposePools, type PoolEntry, type Proposal } from "../live/src/venues/onchainRegistry";
import { aggregate, weightedQuantile } from "../live/src/venues/parityPrice";
import REG from "../live/src/venues/onchain-registry.json";
import { sourceById } from "../src/lib/live/sources";
import { badgeText, secText } from "../src/components/LiveBadge";

// A real swap in the Uniswap v3 WETH/USDC 0.05% pool on Base (block 53101765): 0.1394 WETH
// out of the pool for 323.53 USDC in.
const DATA = "0x" +
  "fffffffffffffffffffffffffffffffffffffffffffffffffe10c0beb5d98be9" +
  "000000000000000000000000000000000000000000000000000000001348b690" +
  "00000000000000000000000000000000000000000003280e254cb6023fc3e2ee" +
  "0000000000000000000000000000000000000000000000000bca2e2423d7d14a" +
  "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffcf754";

const pool = (over: Partial<PoolEntry> = {}): PoolEntry => ({ chain: "base", pool: "0xd0b53d9277642d899df5c87a3966a349a798f224", base: "0x4200000000000000000000000000000000000006", decimals: 18, quote: "USDC", dex: "Uniswap v3 0.05%", fee: 0.0005, liq: 2_000_000, swaps: 10, topic: CHAINS[0].factories[0].topic, ...over });

describe("swaps", () => {
  it("reads the pool's new price and the base amount from a swap", () => {
    const sw = decodeSwap(DATA, true, 1e12, 18)!;
    expect(sw.price).toBeCloseTo(2319.756, 2);
    expect(sw.base).toBeCloseTo(-0.1394, 4);
    expect(poolPrice(BigInt("0x3280e254cb6023fc3e2ee"), false, 1e12)).toBeCloseTo(1 / 2319.756, 9);
    expect(decodeSwap("0x12", true, 1, 18)).toBeNull();
  });

  it("orders tokens and decimals from the chain's quote list", () => {
    const p = livePool(pool(), "ethereum")!;
    expect(p.baseIs0).toBe(true); // WETH 0x42.. sorts before USDC 0x83..
    expect(p.scale).toBe(1e12);
    p.mid = 2319.756; p.midAt = 1;
    const q = poolQuote(p, () => null, 1)!;
    expect(q.p).toBeCloseTo(2319.756, 3);
    expect(q.c).toBeCloseTo(2319.756 * 0.00025, 6);
  });

  it("converts a pool priced in ETH with ETH's own aggregate, adding its confidence", () => {
    const p = livePool(pool({ quote: "WETH", base: "0x940181a94a35a4569e4529a3cdfb74e38fd98631" }), "aerodrome-finance")!;
    p.mid = 0.0003; p.midAt = 5;
    expect(poolQuote(p, () => null, 5)).toBeNull();
    const q = poolQuote(p, (k) => (k === "ethereum" ? { p: 2000, c: 1, n: 3, at: 5, stale: false } : null), 5)!;
    expect(q.p).toBeCloseTo(0.6, 9);
    expect(q.c).toBeCloseTo(0.6 * 0.00025 + 0.0003, 9);
  });
});

describe("the aggregate, Pyth's way", () => {
  it("takes the weighted median of three votes per source and a quartile confidence", () => {
    expect(weightedQuantile([[1, 1], [2, 1], [3, 1]], 0.5)).toBe(2);
    expect(weightedQuantile([[1, 1], [2, 1]], 0.5)).toBe(1.5);
    const a = aggregate([{ p: 100, c: 1, w: 1, at: 0 }, { p: 101, c: 1, w: 1, at: 0 }, { p: 102, c: 1, w: 1, at: 0 }], 0)!;
    expect(a.p).toBe(101);
    expect(a.c).toBeCloseTo(1, 6);
    expect(a.n).toBe(3);
  });

  it("follows the heavier source", () => {
    const a = aggregate([{ p: 100, c: 0.1, w: 10, at: 0 }, { p: 110, c: 0.1, w: 1, at: 0 }], 0)!;
    expect(a.p).toBeCloseTo(100, 6);
  });

  it("drops an outlier and stale sources, and says when everything is stale", () => {
    const a = aggregate([{ p: 100, c: 0.1, w: 1, at: 0 }, { p: 100.2, c: 0.1, w: 1, at: 0 }, { p: 150, c: 0.1, w: 1, at: 0 }], 0)!;
    expect(a.n).toBe(2);
    expect(a.p).toBeLessThan(101);
    const now = 1_000_000;
    const b = aggregate([{ p: 100, c: 0.1, w: 1, at: now }, { p: 200, c: 0.1, w: 50, at: 0 }], now)!;
    expect(b.p).toBeCloseTo(100, 6);
    expect(b.stale).toBe(false);
    const c = aggregate([{ p: 100, c: 0.1, w: 1, at: 0 }], now)!;
    expect(c.stale).toBe(true);
    expect(aggregate([], now)).toBeNull();
  });
});

describe("picking pools", () => {
  const eth = (chain: string, liq: number, extra: Partial<PoolEntry> = {}) => pool({ chain, pool: `0x${chain.padEnd(40, "0").slice(0, 40)}`, liq, ...extra });
  const prop = (key: string, sym: string, pools: PoolEntry[], rank = 1): Proposal => ({ key, sym, name: key, rank, pools });

  it("keeps the deepest pools across chains, discounting Ethereum's slow blocks", () => {
    const reg = proposePools(null, [prop("ethereum", "eth", [eth("ethereum", 10_000_000, { quote: "USDC", base: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" }), eth("base", 3_000_000), eth("arbitrum", 40_000, { base: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" })])], { minLiqUsd: 50_000 });
    const t = reg.tokens[0];
    expect(t.sym).toBe("ETH-USD");
    expect(t.pools.map((p) => p.chain)).toEqual(["base", "ethereum"]);
  });

  it("drops pools priced in an anchor that has no dollar pool, and keeps one asset per ticker", () => {
    const anchorless = prop("aero", "aero", [eth("base", 500_000, { quote: "WETH", base: "0x940181a94a35a4569e4529a3cdfb74e38fd98631" })], 50);
    expect(proposePools(null, [anchorless]).tokens).toHaveLength(0);
    const reg = proposePools(null, [prop("ethereum", "eth", [eth("base", 3_000_000)]), anchorless, prop("aero-copy", "aero", [eth("arbitrum", 900_000)], 900)]);
    expect(reg.tokens.map((t) => t.sym)).toEqual(["ETH-USD", "AERO-USD"]);
    expect(reg.tokens[1].key).toBe("aero");
  });

  it("merges a later proposal into an existing registry without losing pools", () => {
    const first = proposePools(null, [prop("ethereum", "eth", [eth("base", 3_000_000)])]);
    const next = proposePools(first, [prop("ethereum", "eth", [eth("arbitrum", 2_000_000, { base: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" })])]);
    expect(next.tokens[0].pools).toHaveLength(2);
    expect(first.tokens[0].pools).toHaveLength(1);
  });
});

describe("the registry and the source", () => {
  it("lists real assets with pools on known chains", () => {
    expect(REG.tokens.length).toBeGreaterThan(50);
    const syms = new Set<string>();
    for (const t of REG.tokens) {
      expect(syms.has(t.sym)).toBe(false);
      syms.add(t.sym);
      for (const p of t.pools) expect(CHAINS.some((c) => c.chain === p.chain && c.quotes.some((q) => q.key === p.quote))).toBe(true);
    }
    expect(ONCHAIN_SYMBOLS).toContain("ETH-USD");
    expect(ONCHAIN_SYMBOLS).toContain("BTC-USD");
  });

  it("is a public, real-time source that runs its own lines and seeds new symbols", () => {
    const a = onchain.make({});
    expect(typeof a.connect).toBe("function");
    expect(JSON.parse(a.subscribe(["ETH-USD"])[0])).toEqual({ seed: ["ETH-USD"] });
    expect(a.allows("ETH-USD")).toBe(true);
    expect(a.allows("NOPE-USD")).toBe(false);
    const meta = sourceById("onchain")!;
    expect(meta.licence).toBe("display");
    expect(meta.name).toBe("Parity price");
    expect(sourceById("pyth")!.licence).toBe("no");
  });
});

describe("badge words", () => {
  const base = { feed: "rt" as const, internal: false, refused: false, e2e: 412, up: true, down: false, connecting: false };
  it("says the feed type plainly", () => {
    expect(badgeText(base)).toBe("Live, 0.4 s");
    expect(badgeText({ ...base, feed: "delayed", delay: 1 })).toBe("Delayed 1 min");
    expect(badgeText({ ...base, internal: true, e2e: 84 })).toBe("Team live, 0.08 s");
    expect(badgeText({ ...base, e2e: null })).toBe("Live, waiting");
    expect(badgeText({ ...base, down: true })).toBe("Source down");
    expect(badgeText({ ...base, refused: true })).toBe("Team only");
    expect(badgeText({ ...base, up: false, e2e: null, connecting: true })).toBe("Connecting");
    expect(secText(2140)).toBe("2.1 s");
  });
});
