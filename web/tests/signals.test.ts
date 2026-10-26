// The chart's strategy rules must match the research engine's, bar for bar, on the same
// prices (fixture written by scripts/signals_fixture.py from the engine's own code).
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/signals.json";
import { rawSides, RULES, signals, type Rule } from "../src/lib/signals";

const closes = fixture.closes as number[];
const want = fixture.sides as Record<string, number[]>;

function keyOf(r: Rule): string {
  const p = r.params;
  if (r.kind === "trend") return `trend:${p.lookback}`;
  if (r.kind === "breakout") return `breakout:${p.entry}:${p.exit}`;
  if (r.kind === "bollinger") return `bollinger:${p.window}:${p.band}`;
  return r.kind;
}

describe("strategy rules match the engine", () => {
  for (const rule of RULES) {
    it(rule.id, () => {
      const exp = want[keyOf(rule)];
      expect(exp, `fixture has ${keyOf(rule)}`).toBeTruthy();
      const got = rawSides(rule, closes);
      // The engine's breakout sizes by volatility from bar 31, so compare from there for it.
      const from = rule.kind === "breakout" ? 31 : 0;
      expect(got.slice(from)).toEqual(exp.slice(from).map((v) => (v === 0 ? 0 : v)));
    });
  }
});

describe("signals", () => {
  const bars = closes.map((close, i) => ({ time: `2020-01-${String(i).padStart(4, "0")}`, close }));
  const macd = RULES.find((r) => r.id === "fx_macd")!;

  it("never use a bar after the ones marked closed", () => {
    const all = signals(macd, bars, 300);
    expect(all.every((s) => s.index < 300)).toBe(true);
    // Adding later bars never changes an earlier signal (no look-ahead).
    const more = signals(macd, bars, 420).filter((s) => s.index < 300);
    expect(more.map((s) => [s.index, s.action])).toEqual(all.map((s) => [s.index, s.action]));
  });

  it("long-only rules step to cash instead of selling short", () => {
    const rule = RULES.find((r) => r.id === "stocks_macd")!;
    const s = signals(rule, bars);
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.action !== "sell")).toBe(true);
  });

  it("explain each signal with its numbers", () => {
    const s = signals(macd, bars)[0];
    expect(s.why).toMatch(/MACD \(12, 26\) is/);
  });
});
