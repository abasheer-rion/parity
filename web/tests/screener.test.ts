import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, activeCount, passes, runPool, screenMetrics } from "../src/lib/screener";
import type { Bar } from "../src/lib/indicators";

const day = (i: number) => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const fromCloses = (cs: number[]): Bar[] =>
  cs.map((c, i) => ({ time: day(i), open: i ? cs[i - 1] : c, high: Math.max(c, i ? cs[i - 1] : c), low: Math.min(c, i ? cs[i - 1] : c), close: c, volume: null }));

describe("screener measures", () => {
  it("measures RSI, averages, distance from the one-year high and ADX from bars", () => {
    const m = screenMetrics(fromCloses(Array.from({ length: 260 }, (_, i) => 100 + i)));
    expect(m.close).toBe(359);
    expect(m.sma50).toBeCloseTo(334.5, 9);
    expect(m.sma200).toBeCloseTo(259.5, 9);
    expect(m.fromHigh).toBe(0);
    expect(m.rsi14).toBeCloseTo(100, 6);
    expect(m.adx14).toBeGreaterThan(50);
  });

  it("measures the one-year high over the past 365 days only", () => {
    const old = Array.from({ length: 400 }, (_, i) => (i < 10 ? 500 : 100));
    expect(screenMetrics(fromCloses(old)).fromHigh).toBe(0); // the 500s are more than a year back
    const dip = screenMetrics(fromCloses([100, 120, 90]));
    expect(dip.fromHigh).toBeCloseTo(-0.25, 9);
    expect(dip.sma50).toBeNull();
    expect(screenMetrics([]).bars).toBe(0);
  });
});

describe("screener filters", () => {
  const m = { close: 110, rsi14: 55, sma50: 100, sma200: 120, fromHigh: -0.04, adx14: 30, bars: 300 };
  const row = { class: "fx", m1: 1.5, ytd: -3, m };

  it("keeps rows that pass every set filter", () => {
    expect(passes(row, EMPTY_FILTER)).toBe(true);
    expect(activeCount(EMPTY_FILTER)).toBe(0);
    expect(passes(row, { ...EMPTY_FILTER, classes: ["crypto"] })).toBe(false);
    expect(passes(row, { ...EMPTY_FILTER, classes: ["crypto", "fx"] })).toBe(true);
    expect(passes(row, { ...EMPTY_FILTER, rsiMin: 50, rsiMax: 60 })).toBe(true);
    expect(passes(row, { ...EMPTY_FILTER, rsiMax: 50 })).toBe(false);
    expect(passes(row, { ...EMPTY_FILTER, sma50: "above", sma200: "below" })).toBe(true);
    expect(passes(row, { ...EMPTY_FILTER, sma200: "above" })).toBe(false);
    expect(passes(row, { ...EMPTY_FILTER, m1Min: 1, m1Max: 2 })).toBe(true);
    expect(passes(row, { ...EMPTY_FILTER, ytdMin: 0 })).toBe(false);
    expect(passes(row, { ...EMPTY_FILTER, nearHigh: 5 })).toBe(true);
    expect(passes(row, { ...EMPTY_FILTER, nearHigh: 3 })).toBe(false);
    expect(passes(row, { ...EMPTY_FILTER, adxMin: 25 })).toBe(true);
    expect(passes(row, { ...EMPTY_FILTER, adxMin: 35 })).toBe(false);
  });

  it("drops a row that lacks a value a filter needs", () => {
    expect(passes({ ...row, m: { ...m, rsi14: null } }, { ...EMPTY_FILTER, rsiMin: 10 })).toBe(false);
    expect(passes({ ...row, m: { ...m, sma200: null } }, { ...EMPTY_FILTER, sma200: "below" })).toBe(false);
    expect(passes({ ...row, ytd: null }, { ...EMPTY_FILTER, ytdMax: 100 })).toBe(false);
    expect(activeCount({ ...EMPTY_FILTER, classes: ["fx"], rsiMin: 1, sma50: "above" })).toBe(3);
  });
});

describe("runPool", () => {
  it("keeps order, respects the limit and counts progress", async () => {
    let running = 0, peak = 0;
    const seen: number[] = [];
    const out = await runPool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async (x) => {
      running++; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 2));
      running--;
      return x * 2;
    }, (d) => seen.push(d));
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(peak).toBe(3);
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
