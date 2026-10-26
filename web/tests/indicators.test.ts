import { describe, expect, it } from "vitest";
import { barAtOrBefore, barsFromCloses, resample } from "../src/lib/bars";
import { adx, atr, bollinger, compute, ema, emaOf, heikinAshi, macd, obv, rsi, sma, smaOf, stochastic, vwap, type Bar } from "../src/lib/indicators";

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const fromCloses = (cs: number[], vol?: number[]): Bar[] =>
  cs.map((c, i) => ({ time: day(i), open: i ? cs[i - 1] : c, high: Math.max(c, i ? cs[i - 1] : c), low: Math.min(c, i ? cs[i - 1] : c), close: c, volume: vol ? vol[i] : null }));

// The worked example on StockCharts' RSI page (Wilder's method, 14 bars).
const RSI_CLOSES = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];

describe("moving averages", () => {
  it("SMA averages the last n values and is null before that", () => {
    expect(smaOf([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
    expect(sma(fromCloses([10, 20, 30]), 2)).toEqual([null, 15, 25]);
  });

  it("EMA is seeded by the SMA and weights recent values by 2/(n+1)", () => {
    const e = emaOf([1, 2, 3, 4, 5], 3);
    expect(e[2]).toBe(2);
    expect(e[3]).toBeCloseTo(3, 10); // 4*0.5 + 2*0.5
    expect(e[4]).toBeCloseTo(4, 10);
    expect(ema(fromCloses(Array(30).fill(7)), 10).slice(9).every((v) => Math.abs((v as number) - 7) < 1e-9)).toBe(true);
  });
});

describe("oscillators", () => {
  it("RSI matches the StockCharts worked example", () => {
    const r = rsi(fromCloses(RSI_CLOSES), 14);
    expect(r[13]).toBeNull();
    expect(r[14]).toBeCloseTo(70.53, 0);
    expect(r[15]).toBeCloseTo(66.32, 0);
    expect(r[19]).toBeLessThan(r[18] as number);
  });

  it("RSI is 100 when prices only rise and 0 when they only fall", () => {
    expect(rsi(fromCloses(Array.from({ length: 30 }, (_, i) => 10 + i)), 14).at(-1)).toBe(100);
    expect(rsi(fromCloses(Array.from({ length: 30 }, (_, i) => 50 - i)), 14).at(-1)).toBe(0);
  });

  it("MACD is the fast EMA minus the slow EMA, and the histogram is MACD minus its signal", () => {
    const bars = fromCloses(Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 10));
    const m = macd(bars, 12, 26, 9);
    const f = ema(bars, 12), s = ema(bars, 26);
    expect(m.macd[24]).toBeNull();
    expect(m.macd[40]).toBeCloseTo((f[40] as number) - (s[40] as number), 10);
    expect(m.hist[60]).toBeCloseTo((m.macd[60] as number) - (m.signal[60] as number), 10);
  });

  it("stochastic is 100 at a new high and 0 at a new low", () => {
    const up = stochastic(fromCloses(Array.from({ length: 30 }, (_, i) => 10 + i)), 14, 1, 3);
    expect(up.k.at(-1)).toBe(100);
    const down = stochastic(fromCloses(Array.from({ length: 30 }, (_, i) => 50 - i)), 14, 3, 3);
    expect(down.k.at(-1)).toBe(0);
    expect(down.d.at(-1)).toBe(0);
  });
});

describe("volatility and trend", () => {
  it("Bollinger bands collapse onto the average when prices do not move", () => {
    const b = bollinger(fromCloses(Array(30).fill(5)), 20, 2);
    expect(b.mid.at(-1)).toBe(5);
    expect(b.upper.at(-1)).toBe(5);
    expect(b.lower.at(-1)).toBe(5);
  });

  it("Bollinger width uses the population standard deviation", () => {
    const b = bollinger(fromCloses([2, 4, 4, 4, 5, 5, 7, 9]), 8, 2);
    expect(b.mid.at(-1)).toBe(5);
    expect(b.upper.at(-1)).toBeCloseTo(9, 10); // sd = 2
  });

  it("ATR equals the range when every bar has the same range and no gaps", () => {
    const bars: Bar[] = Array.from({ length: 30 }, (_, i) => ({ time: day(i), open: 10, high: 11, low: 9, close: 10 }));
    expect(atr(bars, 14).at(-1)).toBeCloseTo(2, 10);
  });

  it("ADX is high and +DI leads in a steady uptrend", () => {
    const bars: Bar[] = Array.from({ length: 60 }, (_, i) => ({ time: day(i), open: 10 + i, high: 11 + i, low: 9.5 + i, close: 10.8 + i }));
    const a = adx(bars, 14);
    expect(a.adx[26]).toBeNull();
    expect(a.adx.at(-1) as number).toBeGreaterThan(50);
    expect(a.plusDI.at(-1) as number).toBeGreaterThan(a.minusDI.at(-1) as number);
  });
});

describe("volume indicators", () => {
  it("OBV adds volume on up days and takes it away on down days", () => {
    expect(obv(fromCloses([10, 11, 10.5, 10.5, 12], [100, 200, 50, 70, 30]))).toEqual([0, 200, 150, 150, 180]);
  });

  it("VWAP with equal volumes is the average typical price, and null without volume", () => {
    const bars = fromCloses([10, 12, 11], [5, 5, 5]);
    const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
    expect(vwap(bars, 3)[2]).toBeCloseTo((tp[0] + tp[1] + tp[2]) / 3, 10);
    expect(vwap(fromCloses([10, 12, 11]), 3)).toEqual([null, null, null]);
    expect(compute({ id: "v", type: "volume", params: {} }, fromCloses([1, 2])).volume).toEqual([null, null]);
  });
});

describe("bars", () => {
  it("builds daily bars from closes, opening at the previous close", () => {
    const b = barsFromCloses([["2026-01-05", 10], ["2026-01-06", 12], ["2026-01-07", 11]], new Map([["2026-01-06", 500]]));
    expect(b[1]).toEqual({ time: "2026-01-06", open: 10, high: 12, low: 10, close: 12, volume: 500 });
    expect(b[2]).toMatchObject({ open: 12, high: 12, low: 11, close: 11, volume: null });
  });

  it("resamples to weekly bars of first, highest, lowest and last close", () => {
    const daily = barsFromCloses([["2026-01-05", 10], ["2026-01-06", 14], ["2026-01-07", 9], ["2026-01-09", 11], ["2026-01-12", 12]]);
    const w = resample(daily, "W");
    expect(w).toHaveLength(2);
    expect(w[0]).toMatchObject({ time: "2026-01-09", open: 10, high: 14, low: 9, close: 11 });
    expect(w[1]).toMatchObject({ time: "2026-01-12", open: 11, close: 12 });
    expect(resample(daily, "M")).toHaveLength(1);
  });

  it("finds the bar on or before a date", () => {
    const b = fromCloses([1, 2, 3]);
    expect(barAtOrBefore(b, day(1))).toBe(1);
    expect(barAtOrBefore(b, "2025-01-01")).toBe(-1);
    expect(barAtOrBefore(b, "2030-01-01")).toBe(2);
  });

  it("Heikin-Ashi averages each bar and opens at the middle of the last one", () => {
    const ha = heikinAshi([{ time: day(0), open: 10, high: 12, low: 9, close: 11 }, { time: day(1), open: 11, high: 13, low: 10, close: 12 }]);
    expect(ha[0].close).toBe(10.5);
    expect(ha[0].open).toBe(10.5);
    expect(ha[1].open).toBe(10.5);
    expect(ha[1].close).toBe(11.5);
  });
});
