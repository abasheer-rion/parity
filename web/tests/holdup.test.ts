// The web port of the "how it holds up" numbers (src/lib/holdup.ts) against the engine's
// Python (engine/src/parity/metrics/holdup.py), on the fixture written by
// scripts/holdup_fixture.py.
//
// Everything is compared to the Python's own rounding except the bootstrap: the two
// languages draw their random blocks from different generators, so its ranges are
// checked within a tolerance (a tenth of the range's width) and its settings exactly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { holdup, holm, returnsFromEquity, type HoldupInput, type Series } from "../src/lib/holdup";
import type { Holdup } from "../src/lib/types";

interface Case {
  inputs: {
    returns: Series; excess?: Series; benchmark?: Series; stocks?: Series; bonds?: Series; rates?: Series;
    n_trials: number; test_p_values?: Record<string, number>; breakeven_bps?: number; cost_bps?: number;
    names?: HoldupInput["names"];
  };
  expected: Holdup;
}

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/holdup-python.json"), "utf8")) as Record<"full" | "bare", Case>;

function run(c: Case): Holdup {
  const i = c.inputs;
  const out = holdup({
    returns: i.returns, excess: i.excess, benchmark: i.benchmark, stocks: i.stocks, bonds: i.bonds, rates: i.rates,
    nTrials: i.n_trials, testPValues: i.test_p_values, breakevenBps: i.breakeven_bps, costBps: i.cost_bps, names: i.names,
  });
  expect(out).not.toBeNull();
  return out!;
}

/** Deep comparison where numbers may differ by one unit in their last rounded digit. */
function close(actual: unknown, expected: unknown, path = "$"): void {
  if (typeof expected === "number" && typeof actual === "number") {
    expect(Math.abs(actual - expected), `${path}: ts ${actual} py ${expected}`).toBeLessThanOrEqual(Math.max(2e-6, Math.abs(expected) * 1e-6) + 1.01e-4 * (Number.isInteger(expected) ? 0 : 1));
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    expect((actual as unknown[]).length, `${path} length`).toBe(expected.length);
    expected.forEach((v, k) => close((actual as unknown[])[k], v, `${path}[${k}]`));
    return;
  }
  if (expected && typeof expected === "object") {
    expect(actual && typeof actual === "object", path).toBeTruthy();
    expect(Object.keys(actual as object).sort(), `${path} keys`).toEqual(Object.keys(expected).sort());
    for (const k of Object.keys(expected)) close((actual as Record<string, unknown>)[k], (expected as Record<string, unknown>)[k], `${path}.${k}`);
    return;
  }
  expect(actual, path).toEqual(expected);
}

describe.each(["full", "bare"] as const)("holdup parity with the Python engine: %s case", (name) => {
  const c = fixture[name];
  const got = run(c);
  const exp = c.expected;

  for (const key of ["equity_vs_benchmark", "luck", "p_values", "rolling_correlation", "regimes", "worst_periods", "must_be_true", "sources"] as const) {
    it(`${key} matches`, () => close(got[key], exp[key], key));
  }

  it("bootstrap settings match and ranges agree within a tenth of their width", () => {
    const g = got.bootstrap!, e = exp.bootstrap!;
    expect(g.n).toBe(e.n);
    expect(g.block_days).toBe(e.block_days);
    expect(g.days).toBe(e.days);
    expect(g.sharpe.point).toBeCloseTo(e.sharpe.point!, 3);
    expect(g.cagr.point).toBeCloseTo(e.cagr.point!, 4);
    for (const k of ["sharpe", "cagr"] as const) {
      const width = e[k].ci95![1]! - e[k].ci95![0]!;
      for (const band of ["ci95", "ci80"] as const) {
        for (const j of [0, 1]) expect(Math.abs(g[k][band]![j]! - e[k][band]![j]!), `${k}.${band}[${j}]`).toBeLessThan(width * 0.1);
      }
      expect(Math.abs(g[k].median! - e[k].median!)).toBeLessThan(width * 0.1);
    }
    expect(Math.abs(g.prob_sharpe_above_zero! - e.prob_sharpe_above_zero!)).toBeLessThan(0.03);
    expect(g.histogram.counts.reduce((s, v) => s + v, 0)).toBe(g.n);
    expect(g.histogram.edges).toHaveLength(31);
  });
});

describe("holdup edge cases", () => {
  it("is null under 30 days", () => {
    expect(holdup({ returns: { dates: ["2024-01-02", "2024-01-03"], values: [0.01, -0.01] } })).toBeNull();
  });

  it("Holm keeps the input order and never lowers a later p-value below an earlier one", () => {
    const out = holm({ a: 0.04, b: 0.01, c: 0.03 });
    expect(out.map((x) => x.name)).toEqual(["a", "b", "c"]);
    expect(out.map((x) => x.adjusted)).toEqual([0.06, 0.03, 0.06]);
  });

  it("turns an equity curve into returns", () => {
    expect(returnsFromEquity([["2024-01-01", 100], ["2024-01-02", 110], ["2024-01-03", 99]]).values.map((v) => +v.toFixed(6))).toEqual([0.1, -0.1]);
  });

  it("names a missing source and why", () => {
    const h = run(fixture.bare);
    expect(h.sources.benchmark).toEqual({ name: null, available: false, reason: "not_provided" });
    expect(h.regimes.find((x) => x.family === "volatility")?.reason).toBe("no_benchmark");
  });
});
