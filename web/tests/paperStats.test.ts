import { describe, expect, it } from "vitest";
import { cagr, equityCurve, hitRate, maxDrawdown, periodsPerYear, profitFactor, returnsOf, scaleBefore, scaleFrom, sharpe, statsFor, stdev, winRate } from "../src/lib/paper/stats";
import type { Point } from "../src/lib/types";
import type { Bar } from "../src/lib/indicators";
import type { PaperFill } from "../src/lib/paper/matching";

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const curve = (vals: number[], step = 1): Point[] => vals.map((v, i) => [day(i * step), v]);

// Expected values come from the engine itself (engine/src/parity/metrics/performance.py)
// run on the same equity: pd.Series(EQ).pct_change().dropna().
const EQ = [100, 102, 101, 105, 103, 108, 107, 110];

describe("engine definitions", () => {
  const r = returnsOf(curve(EQ));
  it("matches the engine's Sharpe (mean / sample std * sqrt(252))", () => {
    expect(sharpe(r)).toBeCloseTo(8.325831610045956, 10);
  });
  it("matches the engine's max drawdown", () => {
    expect(maxDrawdown(r)).toBeCloseTo(-0.01904761904761909, 12);
  });
  it("matches the engine's hit rate and CAGR", () => {
    expect(hitRate(r)).toBeCloseTo(0.5714285714285714, 12);
    expect(cagr(r)).toBeCloseTo(29.91268053287054, 8);
  });
  it("uses the sample standard deviation", () => {
    expect(stdev([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(5 / 3));
  });
  it("has no Sharpe for a flat curve or a single return", () => {
    expect(sharpe([0, 0, 0])).toBeNull();
    expect(sharpe([0.01])).toBeNull();
    expect(maxDrawdown([])).toBeNull();
  });
});

describe("trade stats", () => {
  it("win rate and profit factor per closed trade", () => {
    const closed = [100, -50, 30, -10];
    expect(winRate(closed)).toBe(0.5);
    expect(profitFactor(closed)).toBeCloseTo(130 / 60);
    expect(profitFactor([10, 20])).toBeNull();
    expect(winRate([])).toBeNull();
  });
  it("statsFor puts it together", () => {
    const s = statsFor(curve([100_000, 101_000, 99_000, 103_000]), [500, -200]);
    expect(s.total_return).toBeCloseTo(0.03);
    expect(s.max_drawdown).toBeCloseTo(99 / 101 - 1);
    expect(s.win_rate).toBe(0.5);
    expect(s.profit_factor).toBeCloseTo(2.5);
    expect(s.closed_trades).toBe(2);
    expect(s.periods).toBe(3);
    expect(s.cagr).toBeNull(); // too short to annualise honestly
  });
  it("detects weekly curves", () => {
    expect(periodsPerYear(curve([1, 2, 3, 4], 7))).toBe(52);
    expect(periodsPerYear(curve([1, 2, 3, 4], 1))).toBe(252);
    expect(periodsPerYear(curve([1, 2, 3, 4], 30))).toBe(12);
  });
});

describe("equity curve", () => {
  const bars: Record<string, Bar[]> = {
    X: [0, 1, 2, 3].map((i) => ({ time: day(i), open: 100 + i, high: 100 + i, low: 100 + i, close: [100, 110, 90, 120][i] })),
  };
  const fills: PaperFill[] = [
    { order_id: "a", symbol: "X", side: "buy", qty: 10, price: 100, fee: 1, bar_date: day(0), realized_pnl: null },
    { order_id: "b", symbol: "X", side: "sell", qty: 10, price: 90, fee: 1, bar_date: day(2), realized_pnl: -102 },
  ];
  it("values cash plus holdings at each day's close", () => {
    const e = equityCurve(10_000, fills, bars, [0, 1, 2, 3].map(day));
    expect(e.map((p) => p[1])).toEqual([10_000 - 1001 + 1000, 10_000 - 1001 + 1100, 10_000 - 1001 + 900 - 1, 10_000 - 1001 + 900 - 1]);
  });
  it("is flat at the starting cash with no fills", () => {
    expect(equityCurve(5000, [], bars, [day(0), day(1)])).toEqual([[day(0), 5000], [day(1), 5000]]);
  });
});

describe("forward test scaling", () => {
  const c = curve([1, 1.1, 1.21, 1.1, 1.32]);
  it("scales the part from the attach date to the capital", () => {
    const f = scaleFrom(c, day(2), 10_000);
    expect(f[0]).toEqual([day(2), 10_000]);
    expect(f[f.length - 1][1]).toBeCloseTo(10_000 * 1.32 / 1.21);
    expect(f).toHaveLength(3);
  });
  it("has nothing forward when the attach date is at or after the last point", () => {
    expect(scaleFrom(c, day(4), 10_000)).toEqual([]);
    expect(scaleFrom(c, day(9), 10_000)).toEqual([]);
  });
  it("scales the backtest so it ends at the capital on the attach date", () => {
    const b = scaleBefore(c, day(2), 10_000);
    expect(b).toHaveLength(3);
    expect(b[2][1]).toBeCloseTo(10_000);
    expect(b[0][1]).toBeCloseTo(10_000 / 1.21);
  });
});
