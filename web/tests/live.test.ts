// Live data pieces (DEC-0049): conflation, candles from updates, the clock offset, hop
// times, freshness and the wire checks. No network.
import { describe, expect, it } from "vitest";
import { Conflator } from "../src/lib/live/conflate";
import { barKey, CandleBuilder } from "../src/lib/live/candles";
import { ClockOffset, freshness, hops, msText, Reservoir } from "../src/lib/live/latency";
import { parseClient, parseServer, type Tick } from "../src/lib/live/protocol";
import { liveOrigin } from "../src/lib/live/client";

describe("conflation", () => {
  it("sends a trade after a quiet spell at once, and folds a burst into one update", () => {
    const c = new Conflator(250);
    const t0 = 1_000_000;
    expect(c.add({ s: "BTC-USD", p: 100, v: 1, te: t0 }, t0 + 5)).toHaveLength(1);
    expect(c.add({ s: "BTC-USD", p: 101, v: 1, te: t0 + 10 }, t0 + 15)).toHaveLength(0);
    expect(c.add({ s: "BTC-USD", p: 99, v: 2, te: t0 + 20 }, t0 + 25)).toHaveLength(0);
    expect(c.due(t0 + 100)).toHaveLength(0);
    const [u] = c.due(t0 + 260);
    expect(u).toMatchObject({ s: "BTC-USD", o: 101, p: 99, h: 101, l: 99, v: 3, n: 2, te: t0 + 20, tr: t0 + 25, ts: t0 + 260, q: 2 });
    expect(c.folded).toBe(1);
  });

  it("never folds trades from two different minutes", () => {
    const c = new Conflator(250);
    const m = 60_000 * 1000;
    c.add({ s: "X", p: 1, v: 0, te: m - 100 }, m - 90); // sent
    c.add({ s: "X", p: 2, v: 0, te: m - 50 }, m - 40); // waits
    const out = c.add({ s: "X", p: 3, v: 0, te: m + 10 }, m + 20); // new minute: flush the wait
    expect(out.map((t) => t.p)).toEqual([2]);
    expect(c.due(m + 300).map((t) => t.p)).toEqual([3]);
  });

  it("drops bad prices", () => {
    expect(new Conflator().add({ s: "X", p: Number.NaN, v: 0, te: 1 }, 2)).toEqual([]);
  });
});

const tick = (p: number, te: number, extra: Partial<Tick> = {}): Tick => ({ s: "X", o: p, p, h: p, l: p, v: 1, n: 1, te, tr: te + 5, ts: te + 6, q: 1, ...extra });

describe("candles", () => {
  it("keys bars by period", () => {
    expect(barKey(Date.parse("2026-10-25T14:07:31Z"), "5m")).toBe("2026-10-25T14:05:00Z");
    expect(barKey(Date.parse("2026-10-25T14:07:31Z"), "1d")).toBe("2026-10-25");
  });

  it("updates the forming bar, starts a new one in a new period and ignores old updates", () => {
    const start = Date.parse("2026-10-25T14:00:00Z");
    const b = new CandleBuilder([{ time: "2026-10-25T14:00:00Z", open: 10, high: 11, low: 9, close: 10, volume: 5 }], "1m");
    const seen: string[] = [];
    b.on((c) => seen.push(c));
    expect(b.apply(tick(12, start + 30_000))).toBe("last");
    expect(b.bars[0]).toMatchObject({ high: 12, close: 12, volume: 6 });
    expect(b.apply(tick(13, start + 61_000, { o: 12.5, h: 13.2, l: 12.4 }))).toBe("new");
    expect(b.bars[1]).toMatchObject({ time: "2026-10-25T14:01:00Z", open: 12.5, high: 13.2, low: 12.4, close: 13 });
    expect(b.apply(tick(1, start + 1_000))).toBeNull();
    expect(seen).toEqual(["last", "new"]);
  });
});

describe("latency", () => {
  it("measures the clock offset from the fastest ping", () => {
    const c = new ClockOffset();
    c.add(1000, 1600, 1200); // rtt 200, offset 500
    c.add(2000, 2550, 2100); // rtt 100, offset 500
    c.add(3000, 3900, 3400); // rtt 400 (worse), ignored for the offset
    expect(c.rtt).toBe(100);
    expect(c.offset).toBe(500);
    expect(c.now(10)).toBe(510);
  });

  it("splits a trip into hops", () => {
    expect(hops({ te: 1000, tr: 1080, ts: 1090 }, 1130, 1140)).toEqual({ feed: 80, edge: 10, net: 40, screen: 10, e2e: 140 });
  });

  it("turns amber and red when data gets old or the line drops", () => {
    expect(freshness("rt", 800, 120, true)).toBe("ok");
    expect(freshness("rt", 8_000, 120, true)).toBe("late");
    expect(freshness("rt", 800, 1_500, true)).toBe("late");
    expect(freshness("rt", 120_000, 120, true)).toBe("stale");
    expect(freshness("rt", 800, 120, false)).toBe("stale");
    expect(freshness("delayed", 16 * 60_000, null, true, 15)).toBe("ok");
    expect(freshness("delayed", 4 * 60_000, null, true, 1)).toBe("late");
    expect(freshness("eod", 2 * 86_400_000, null, true)).toBe("ok");
  });

  it("writes durations briefly", () => {
    expect([msText(84), msText(3200), msText(240_000), msText(7_200_000), msText(3 * 86_400_000)]).toEqual(["84 ms", "3.2 s", "4 min", "2 h", "3 d"]);
  });

  it("keeps a fixed-size sample per key", () => {
    const r = new Reservoir(4, () => 0.99);
    for (let i = 0; i < 100; i++) r.add("a", i);
    r.add("b", 7);
    const out = r.drain();
    expect(out.filter((x) => x.key === "a")).toHaveLength(4);
    expect(out.filter((x) => x.key === "b")).toEqual([{ key: "b", v: 7 }]);
    expect(r.drain()).toEqual([]);
  });
});

describe("wire", () => {
  it("accepts only known client messages", () => {
    expect(parseClient(JSON.stringify({ op: "sub", s: ["BTC-USD", "bad symbol", "BTC-USD"] }))).toEqual({ op: "sub", s: ["BTC-USD"] });
    expect(parseClient(JSON.stringify({ op: "ping", c: 5 }))).toEqual({ op: "ping", c: 5 });
    expect(parseClient(JSON.stringify({ op: "drop", s: [] }))).toBeNull();
    expect(parseClient("x".repeat(3000))).toBeNull();
  });

  it("drops malformed updates from the server", () => {
    const good = tick(5, 1);
    const m = parseServer(JSON.stringify({ op: "t", d: [good, { s: "X", p: "nope" }] }));
    expect(m).toEqual({ op: "t", d: [good] });
    expect(parseServer("{")).toBeNull();
  });

  it("connects to this site, or to the main address from the desktop app and local dev", () => {
    expect(liveOrigin({ protocol: "https:", host: "trade.endyland.com", hostname: "trade.endyland.com" })).toBe("wss://trade.endyland.com");
    expect(liveOrigin({ protocol: "app:", host: "x", hostname: "x" })).toBe("wss://trade.endyland.com");
    expect(liveOrigin({ protocol: "http:", host: "localhost:5173", hostname: "localhost" })).toBe("wss://trade.endyland.com");
  });
});

describe("latency page, live feeds", () => {
  it("groups browser samples by feed and hop", async () => {
    const { liveFeeds, percentile } = await import("../src/lib/latency");
    const bins = (k: number) => { const b = new Array(64).fill(0); b[k] = 3; return b; };
    const row = (endpoint: string, k: number, metric = "lag") => ({ hour: "", app: "trade", metric, endpoint, region: "NA", n: 3, hits: 0, total: 0, bins: bins(k) });
    const out = liveFeeds([row("trade:live/coingecko/e2e", 30), row("trade:live/coingecko/e2e", 30), row("trade:live/coingecko/net", 12), row("trade/alerts", 5), row("trade:live/coingecko/e2e", 1, "age")]);
    expect(out).toHaveLength(1);
    expect(out[0].src).toBe("coingecko");
    expect(out[0].hops.e2e?.n).toBe(6);
    expect(percentile(out[0].hops.net!.bins, 0.5)).toBeCloseTo(10 ** (11.5 / 8));
  });
});
