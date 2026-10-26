import { describe, expect, it } from "vitest";
import { ALERT_KINDS, dayOf, describeAlert, evaluateAlert, validateAlert, type AlertRule } from "../src/lib/alerts";
import { rsi, type Bar } from "../src/lib/indicators";

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const fromCloses = (cs: number[]): Bar[] =>
  cs.map((c, i) => ({ time: day(i), open: i ? cs[i - 1] : c, high: Math.max(c, i ? cs[i - 1] : c), low: Math.min(c, i ? cs[i - 1] : c), close: c, volume: null }));

const rule = (kind: AlertRule["kind"], value: number | null, param: number | null = null): AlertRule => ({ kind, value, param });

describe("price alerts", () => {
  const bars = fromCloses([10, 11, 12, 13, 12, 11, 10, 9]);

  it("checks only the latest bar when no bar is newer than the alert", () => {
    expect(evaluateAlert(rule("price_above", 12), bars)).toBeNull(); // last close is 9
    expect(evaluateAlert(rule("price_below", 9.5), bars)).toEqual({ bar: day(7), value: 9 });
    // An alert made after the last bar (the data is delayed) still looks at the latest close.
    expect(evaluateAlert(rule("price_below", 9.5), bars, "2027-01-01")).toEqual({ bar: day(7), value: 9 });
  });

  it("returns the first bar from the alert's date that meets the level", () => {
    expect(evaluateAlert(rule("price_above", 12), bars, day(0))).toEqual({ bar: day(3), value: 13 });
    expect(evaluateAlert(rule("price_above", 12), bars, day(4))).toBeNull();
    expect(evaluateAlert(rule("price_below", 11), bars, day(4))).toEqual({ bar: day(6), value: 10 });
  });

  it("is strict: touching the level is not crossing it", () => {
    expect(evaluateAlert(rule("price_above", 9), bars)).toBeNull();
    expect(evaluateAlert(rule("price_below", 9), bars)).toBeNull();
  });

  it("never fires on empty data or an invalid rule", () => {
    expect(evaluateAlert(rule("price_above", 1), [])).toBeNull();
    expect(evaluateAlert(rule("price_above", null), bars)).toBeNull();
  });
});

describe("RSI alerts", () => {
  it("compares the RSI line with the level and reports the RSI", () => {
    const rising = fromCloses(Array.from({ length: 30 }, (_, i) => 100 + i));
    const hit = evaluateAlert(rule("rsi_above", 70, 14), rising);
    expect(hit?.bar).toBe(day(29));
    expect(hit?.value).toBeCloseTo(100, 6); // only gains: RSI is 100
    expect(evaluateAlert(rule("rsi_below", 30, 14), rising)).toBeNull();
  });

  it("skips bars before the RSI has enough history", () => {
    const falling = fromCloses(Array.from({ length: 20 }, (_, i) => 100 - i));
    const hit = evaluateAlert(rule("rsi_below", 30, 14), falling, day(0));
    expect(hit?.bar).toBe(day(14)); // the first bar with an RSI value
    expect(hit?.value).toBe(rsi(falling, 14)[14]);
  });
});

describe("moving average crosses", () => {
  // Flat at 10, a dip below the 3-bar average, then a jump above it.
  const bars = fromCloses([10, 10, 10, 10, 8, 8, 8, 12, 12, 12]);

  it("fires on the bar where the close moves from at or below the average to above it", () => {
    expect(evaluateAlert(rule("cross_above_sma", null, 3), bars, day(0))).toEqual({ bar: day(7), value: 12 });
  });

  it("fires on the bar where the close moves from at or above the average to below it", () => {
    expect(evaluateAlert(rule("cross_below_sma", null, 3), bars, day(0))).toEqual({ bar: day(4), value: 8 });
  });

  it("does not fire while the close stays on one side", () => {
    expect(evaluateAlert(rule("cross_above_sma", null, 3), bars)).toBeNull(); // latest bar only: no cross
    expect(evaluateAlert(rule("cross_below_sma", null, 3), bars, day(5))).toBeNull();
  });

  it("checks the latest bar against the one before it", () => {
    const last = fromCloses([10, 10, 10, 9, 13]);
    expect(evaluateAlert(rule("cross_above_sma", null, 3), last)).toEqual({ bar: day(4), value: 13 });
  });
});

describe("validation and words", () => {
  it("matches the database checks", () => {
    expect(validateAlert(rule("price_above", 1.2))).toBeNull();
    expect(validateAlert(rule("price_above", null))).toMatch(/level/);
    expect(validateAlert(rule("rsi_above", 150, 14))).toMatch(/0 to 100/);
    expect(validateAlert(rule("rsi_above", 70, null))).toMatch(/look-back/);
    expect(validateAlert(rule("cross_above_sma", null, 1))).toMatch(/look-back/);
    expect(validateAlert(rule("cross_above_sma", null, 50))).toBeNull();
    expect(validateAlert({ kind: "buy" as never, value: 1, param: null })).toMatch(/condition/);
  });

  it("describes every kind in words", () => {
    for (const k of ALERT_KINDS) expect(describeAlert(rule(k.kind, 50, k.defaultParam)).length).toBeGreaterThan(5);
    expect(describeAlert(rule("rsi_below", 30, 14))).toBe("RSI(14) below 30");
    expect(dayOf("2026-10-23T12:00:00Z")).toBe("2026-10-23");
  });
});
