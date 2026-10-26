// Our on-chain feed (DEC-0063): swap decoding, the volume-weighted composite, the symbol list
// shared with the browser, and the badge's plain words. No network.
import { describe, expect, it } from "vitest";
import { composite, decodeSwap, NODES, ONCHAIN_SYMBOLS, onchain, POOLS, poolPrice } from "../live/src/venues/onchain";
import { ONCHAIN_SYMBOLS as BROWSER_SYMBOLS } from "../src/lib/live/onchainSymbols";
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

describe("on-chain feed", () => {
  it("reads the pool's new price and the base amount from a swap", () => {
    const sw = decodeSwap(DATA, true, 1e12, 18)!;
    expect(sw.price).toBeCloseTo(2319.756, 2);
    expect(sw.base).toBeCloseTo(-0.1394, 4);
    // The same pool seen the other way round gives the inverse.
    expect(poolPrice(BigInt("0x3280e254cb6023fc3e2ee"), false, 1e12)).toBeCloseTo(1 / 2319.756, 9);
    expect(decodeSwap("0x12", true, 1, 18)).toBeNull();
  });

  it("turns a swap log into a trade (a purchase: base left the pool) and an overview row", () => {
    const a = onchain.make({});
    const msg = JSON.stringify({ jsonrpc: "2.0", method: "eth_subscription", params: { result: { address: "0xD0B53D9277642D899DF5C87A3966A349A798F224", data: DATA, blockTimestamp: "0x6adee62d", removed: false } } });
    const p = a.parse(msg);
    expect(p.t?.[0]).toMatchObject({ s: "ETH-USDC", side: 1, te: 0x6adee62d * 1000 });
    expect(p.t?.[0].p).toBeCloseTo(2319.756, 2);
    expect(p.r?.[0].s).toBe("ETH-USDC");
    expect(a.parse(JSON.stringify({ jsonrpc: "2.0", method: "eth_subscription", params: { result: { address: "0xd0b53d9277642d899df5c87a3966a349a798f224", data: DATA, removed: true } } }))).toEqual({});
    expect(a.parse(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: "limit" } })).fail).toContain("limit");
    expect(a.parse(JSON.stringify({ jsonrpc: "2.0", id: 2, error: { message: "limit" } }))).toEqual({});
  });

  it("reads a newly wanted symbol's price over the line, so a viewer sees one at once", () => {
    const a = onchain.make({});
    const msgs = a.subscribe(["ETH-USDC"]);
    expect(msgs).toHaveLength(1);
    const call = JSON.parse(msgs[0]) as { id: number; method: string };
    expect(call.method).toBe("eth_call");
    const slot0 = "0x00000000000000000000000000000000000000000003280e254cb6023fc3e2ee" + "0".repeat(64 * 6);
    const p = a.parse(JSON.stringify({ jsonrpc: "2.0", id: call.id, result: slot0 }));
    expect(p.t?.find((t) => t.s === "ETH-USDC")?.p).toBeCloseTo(2319.756, 2);
  });

  it("drops a line whose subscription the node refused, and tries the next node", async () => {
    const a = onchain.make({});
    await a.prepare!();
    const firstUrl = a.url;
    const p = a.parse(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32005, message: "Rate limit exceeded" } }));
    expect(p.drop).toBe(true);
    await a.prepare!();
    expect(a.url).not.toBe(firstUrl);
    expect(NODES).toContain(a.url);
  });

  it("takes a swap's time from the block when the log leaves it out", () => {
    const a = onchain.make({});
    a.parse(JSON.stringify({ jsonrpc: "2.0", method: "eth_subscription", params: { result: { number: "0x10", timestamp: "0x6adee62d" } } }));
    const p = a.parse(JSON.stringify({ jsonrpc: "2.0", method: "eth_subscription", params: { result: { address: "0xd0b53d9277642d899df5c87a3966a349a798f224", data: DATA, blockNumber: "0x10" } } }));
    expect(p.t?.[0].te).toBe(0x6adee62d * 1000);
  });

  it("weights pools by recent volume, and by depth before any trades", () => {
    const pool = (mid: number, vol: number, w0: number, quote: "USDC" | "WETH" = "USDC") => ({ addr: "", sym: "X-USDC", quote, baseIs0: true, scale: 1, baseDec: 18, w0, mid, vol, volAt: 0 });
    expect(composite([pool(100, 0, 1000), pool(102, 0, 1000)], 1, 0)).toBeCloseTo(101, 6);
    expect(composite([pool(100, 1_000_000, 1), pool(110, 0, 1)], 1, 0)).toBeCloseTo(100, 3);
    // A WETH-priced pool is turned into USDC with the ETH price.
    expect(composite([pool(0.01, 0, 1, "WETH")], 2000, 0)).toBeCloseTo(20, 6);
    expect(Number.isNaN(composite([pool(Number.NaN, 0, 1)], 1, 0))).toBe(true);
  });

  it("offers the same symbols to the browser, and every pool names a known symbol", () => {
    expect(BROWSER_SYMBOLS).toEqual(ONCHAIN_SYMBOLS);
    expect(new Set(POOLS.map((p) => p[2])).size).toBe(POOLS.length);
    const meta = sourceById("onchain")!;
    expect(meta.licence).toBe("display");
    expect(meta.feed).toBe("rt");
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
