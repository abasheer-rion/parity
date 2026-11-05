// The fill price check's arithmetic (DEC-0092) on hand-made bars: inside and outside the
// range with each source's tolerance, closed markets, the day's range as a fallback, the
// day's high and low, unknown clocks and fills with only a date.
import { describe, expect, it } from "vitest";
import { classify, merge, plan, type Bar, type Book, type SymData } from "../../src/lib/verify/range/engine";
import { clockOf, fromNy, nyClock, nyOffset, toUtc } from "../../src/lib/verify/range/clock";
import { SOURCE_INFO } from "../../src/lib/verify/range/info";
import { route } from "../../src/lib/verify/range/market";
import type { FillPoint } from "../../src/lib/verify/range/types";

const MIN = 60_000;
const at = (iso: string) => Date.parse(`${iso}Z`);
const stock = SOURCE_INFO["alpaca-iex"], chain = SOURCE_INFO["onchain-base"];

/** Minute bars from `from` for `n` minutes, each [p, p + 0.2]. */
function minutes(from: string, n: number, p = 100): Bar[] {
  return Array.from({ length: n }, (_, i) => [at(from) + i * MIN, p, p + 0.2] as Bar);
}

function bookOf(syms: Record<string, SymData | "sym">, calendar?: string[]): Book {
  return { syms: new Map(Object.entries(syms)), calendar: calendar ? new Set(calendar) : null, calFrom: calendar?.[0], calTo: calendar?.[calendar.length - 1] };
}

function stockData(bars: Bar[], days: Record<string, [number, number]> = {}, span: [string, string] = ["2026-03-03T00:00:00", "2026-03-04T00:00:00"]): SymData {
  return { src: stock, spans: [{ from: at(span[0]), to: at(span[1]), bars }], days: new Map(Object.entries(days)) };
}

describe("symbols and clocks", () => {
  it("routes a file's symbols to the market sent", () => {
    expect(route("AAPL")?.symbol).toBe("AAPL");
    expect(route("NASDAQ:AAPL")?.symbol).toBe("AAPL");
    expect(route("AAPL.US")?.symbol).toBe("AAPL");
    expect(route("BRK B")?.symbol).toBe("BRK.B");
    expect(route("BTCUSDT")).toMatchObject({ market: "crypto", symbol: "BTC-USDT" });
    expect(route("XBT/USD")).toMatchObject({ market: "crypto", symbol: "BTC-USD" });
    expect(route("XXBTZUSD")).toMatchObject({ market: "crypto", symbol: "BTC-USD" });
    expect(route("ETH")).toMatchObject({ market: "crypto", symbol: "ETH-USD" });
    expect(route("EURUSD.raw")).toMatchObject({ market: "fx", symbol: "EUR/USD" });
    expect(route("EURUSDm")).toMatchObject({ market: "fx", symbol: "EUR/USD" });
    expect(route("US500")).toBeNull();
    expect(route("AAPL 240119C150")).toBeNull();
    expect(route("ESZ4", "ninjatrader")).toBeNull();
  });

  it("knows New York's summer time", () => {
    expect(nyOffset(at("2026-01-15T12:00:00"))).toBe(-300);
    expect(nyOffset(at("2026-07-15T12:00:00"))).toBe(-240);
    expect(new Date(fromNy(at("2026-03-03T09:30:00"))).toISOString()).toBe("2026-03-03T14:30:00.000Z");
    expect(new Date(toUtc("2026-07-01T09:30:00", "new_york")).toISOString()).toBe("2026-07-01T13:30:00.000Z");
    expect(nyClock(at("2026-03-07T15:00:00")).weekday).toBe(6);
  });

  it("reads which clock a file uses", () => {
    const table = (h: string, cell: string) => ({ headers: [h], rows: [[cell]] });
    expect(clockOf({ format: "ibkr", table: table("DateTime", "x"), mapping: {} })).toBe("new_york");
    expect(clockOf({ format: "binance_spot", table: table("Date(UTC)", "x"), mapping: {} })).toBe("utc");
    expect(clockOf({ format: "trades", table: table("Close time (UTC+2)", "2026-03-03 10:00"), mapping: { closeTime: 0 } })).toBe("utc");
    expect(clockOf({ format: "trades", table: table("Closed", "2026-03-03T10:00:00Z"), mapping: { closeTime: 0 } })).toBe("utc");
    expect(clockOf({ format: "mt5", table: table("Time", "2026.03.03 10:00:00"), mapping: { closeTime: 0 } })).toBe("unknown");
  });

  it("plans one stretch per group of nearby fills, and none for an unknown clock on a source that needs exact times", () => {
    const fills: FillPoint[] = [{ s: "AAPL", t: "2026-03-03T14:31:00", p: 1 }, { s: "AAPL", t: "2026-03-03T14:33:00", p: 1 }, { s: "BTC-USD", t: "2026-03-03T14:31:00", p: 1 }];
    const reach = (s: string) => (s === "AAPL" ? { reach: 6 * MIN, exactTime: false } : { reach: 10 * MIN, exactTime: true });
    const p = plan("utc", fills, reach);
    expect(p.get("AAPL")!.spans).toEqual([[at("2026-03-03T14:25:00"), at("2026-03-03T14:39:00")]]);
    expect(plan("unknown", fills, reach).get("BTC-USD")!.spans).toEqual([]);
    expect(merge([[5, 9], [1, 3], [2, 6]])).toEqual([[1, 9]]);
  });
});

describe("one answer per fill", () => {
  const bars = minutes("2026-03-03T14:30:00", 60);
  const days = { "2026-03-03": [99, 101] as [number, number] };

  it("inside the minutes around the fill, with the source's tolerance", () => {
    const b = bookOf({ AAPL: stockData(bars, days) });
    const r = classify("utc", [
      { s: "AAPL", t: "2026-03-03T14:45:00", p: 100.1 },
      { s: "AAPL", t: "2026-03-03T14:45:00", p: 100.6 }, // 0.5% above 100.2 is 100.701: inside
      { s: "AAPL", t: "2026-03-03T14:45:00", p: 101.5 }, // outside
      { s: "AAPL", t: "2026-03-03T14:45:00", p: 98 }, // outside
    ], b);
    expect(r.fills.map((f) => f.r)).toEqual(["in", "in", "out", "out"]);
    expect(r.fills[0]).toMatchObject({ b: "m", src: "alpaca-iex", e: "n" });
  });

  it("marks a fill at the day's high or low", () => {
    const b = bookOf({ AAPL: stockData([[at("2026-03-03T15:00:00"), 99, 99.3]], days) });
    const r = classify("utc", [{ s: "AAPL", t: "2026-03-03T15:00:00", p: 99.02 }, { s: "AAPL", t: "2026-03-03T15:00:00", p: 99.2 }], b);
    expect(r.fills.map((f) => f.e)).toEqual(["l", "n"]);
  });

  it("falls back to the day's range in the regular session only, and says when nothing traded", () => {
    const b = bookOf({ AAPL: stockData([], days) });
    const r = classify("utc", [
      { s: "AAPL", t: "2026-03-03T16:00:00", p: 100.5 }, // 11 a.m. New York: the day's range
      { s: "AAPL", t: "2026-03-03T16:00:00", p: 103 },
      { s: "AAPL", t: "2026-03-03T22:00:00", p: 100 }, // 5 p.m. New York: no fallback
    ], b);
    expect(r.fills).toEqual([
      { r: "in", b: "d", src: "alpaca-iex", e: "n" },
      { r: "out", b: "d", src: "alpaca-iex" },
      { r: "none", n: "data", src: "alpaca-iex" },
    ]);
  });

  it("calls a weekend or a holiday closed for US stocks, never for crypto", () => {
    const sat = stockData([], {}, ["2026-03-07T00:00:00", "2026-03-08T00:00:00"]);
    const b = bookOf({ AAPL: sat, "BTC-USD": { src: chain, spans: [{ from: at("2026-03-07T00:00:00"), to: at("2026-03-08T00:00:00"), bars: [[at("2026-03-07T15:00:00"), 80000, 80000]] }], days: null } }, ["2026-01-02", "2026-01-05", "2026-01-20"]);
    const r = classify("utc", [
      { s: "AAPL", t: "2026-03-07T15:00:00", p: 100 },
      { s: "BTC-USD", t: "2026-03-07T15:00:00", p: 80100 },
      { s: "AAPL", t: "2026-01-19", p: 100 }, // Martin Luther King Jr. Day
    ], b);
    expect(r.fills.map((f) => f.r)).toEqual(["closed", "in", "closed"]);
  });

  it("asks for a fill again when its stretch was not loaded, and says why a stretch failed", () => {
    const partial: SymData = { src: stock, spans: [{ from: at("2026-03-03T14:00:00"), to: at("2026-03-03T14:40:00"), bars }], days: null };
    const failed: SymData = { src: stock, spans: [{ from: at("2026-03-03T00:00:00"), to: at("2026-03-04T00:00:00"), why: "busy" }], days: null };
    const b = bookOf({ AAPL: partial, SPY: failed });
    const r = classify("utc", [{ s: "AAPL", t: "2026-03-03T14:38:00", p: 100 }, { s: "SPY", t: "2026-03-03T15:00:00", p: 100 }, { s: "QQQ", t: "2026-03-03T15:00:00", p: 1 }], b);
    expect(r.fills).toEqual([{ r: "none", n: "more", src: "alpaca-iex" }, { r: "none", n: "busy", src: "alpaca-iex" }, { r: "none", n: "sym" }]);
    expect(r.unsupported).toEqual(["QQQ"]);
  });

  it("says a fill is too recent when the source is not complete yet", () => {
    const sd = stockData(bars, days);
    sd.until = at("2026-03-03T14:40:00");
    expect(classify("utc", [{ s: "AAPL", t: "2026-03-03T14:45:00", p: 100 }], bookOf({ AAPL: sd })).fills[0]).toMatchObject({ r: "none", n: "late" });
  });

  it("finds the time zone of an unknown clock from the fills, an hour either way", () => {
    // The price is 100 from 14:30 to 15:30 UTC, and 120 from 15:30 to 16:30.
    const two = [...minutes("2026-03-03T14:30:00", 60, 100), ...minutes("2026-03-03T15:30:00", 60, 120)];
    const b = bookOf({ AAPL: stockData(two, days, ["2026-03-02T00:00:00", "2026-03-05T00:00:00"]) });
    // Written in UTC+2: 16:40 there is 14:40 UTC.
    const fills: FillPoint[] = ["16:40", "16:50", "17:00", "17:10", "17:20"].map((t) => ({ s: "AAPL", t: `2026-03-03T${t}:00`, p: 100.1 }));
    fills.push({ s: "AAPL", t: "2026-03-03T17:50:00", p: 120.1 }, { s: "AAPL", t: "2026-03-03T17:55:00", p: 150 });
    const r = classify("unknown", fills, b);
    expect(r.offset).toBe(120);
    expect(r.fills.map((f) => f.r)).toEqual(["in", "in", "in", "in", "in", "in", "out"]);
  });

  it("with too few fills to tell, counts a fill inside when any time zone puts it inside", () => {
    const b = bookOf({ AAPL: stockData(minutes("2026-03-03T14:30:00", 60), days, ["2026-03-02T00:00:00", "2026-03-05T00:00:00"]) });
    const r = classify("unknown", [{ s: "AAPL", t: "2026-03-03T23:40:00", p: 100.1 }, { s: "AAPL", t: "2026-03-03T23:40:00", p: 300 }], b);
    expect(r.offset).toBeNull();
    expect(r.fills.map((f) => f.r)).toEqual(["in", "out"]);
    expect(r.fills[0].e).toBeUndefined();
  });

  it("a fill with only a date uses the day's range, and the on-chain source needs a time", () => {
    const b = bookOf({ AAPL: stockData([], days), "BTC-USD": { src: chain, spans: [], days: null } });
    const r = classify("utc", [{ s: "AAPL", t: "2026-03-03", p: 100 }, { s: "AAPL", t: "2026-03-03", p: 90 }, { s: "BTC-USD", t: "2026-03-03", p: 1 }], b);
    expect(r.fills.map((f) => f.r)).toEqual(["in", "out", "none"]);
    expect(r.fills[2].n).toBe("time");
    expect(classify("unknown", [{ s: "BTC-USD", t: "2026-03-03T10:00:00", p: 1 }], b).fills[0]).toMatchObject({ r: "none", n: "time" });
  });
});
