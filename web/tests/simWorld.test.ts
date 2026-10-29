// Sim World additions (DEC-0066): the event words, the example scenarios and the library.
import { describe, expect, it } from "vitest";
import { parseEvent } from "../src/lib/eventText";
import { PRESETS, resemblance } from "../src/lib/scenarios";
import { drawdown, findEpisodes, medianInterval, simulate, summarise, weeklySimple } from "../src/lib/stress";

// The engine's list (engine/src/parity/scenarios.py TYPES). A preset with any other type
// matches no past event at all, which is how two presets used to show nothing.
const TYPES = ["war", "military_strike", "terrorist_attack", "oil_supply_shock", "sanctions", "trade_war", "supply_chain_shock", "pandemic",
  "financial_crisis", "sovereign_default", "currency_crisis", "bank_run", "rate_shock", "central_bank_surprise", "crypto_crash", "election",
  "political_crisis", "natural_disaster"];

describe("example scenarios", () => {
  it("every preset uses a kind the engine knows", () => {
    for (const p of PRESETS) expect(TYPES, p.label).toContain(p.spec.type);
  });
});

describe("reading a typed event", () => {
  it.each([
    ["A run on a big US bank", "bank_run"],
    ["Italy cannot pay its debts", "sovereign_default"],
    ["Turkish lira plunges", "currency_crisis"],
    ["China devalues the yuan", "currency_crisis"],
    ["Bitcoin crashes after an exchange fails", "crypto_crash"],
    ["US bond yields spike on an inflation surprise", "rate_shock"],
    ["A container ship blocks the Suez canal", "supply_chain_shock"],
    ["Russia invades Poland", "war"],
    ["Iran bombs a Chinese port", "military_strike"],
    ["A stock market crash in Japan", "financial_crisis"],
  ])("%s", (text, type) => {
    expect(parseEvent(text).type).toBe(type);
  });

  it("finds the new countries and their regions", () => {
    const p = parseEvent("Sri Lanka and Ireland default");
    expect(p.actors).toEqual(expect.arrayContaining(["sri_lanka", "ireland"]));
    expect(p.regions).toEqual(expect.arrayContaining(["south_asia", "europe"]));
  });
});


describe("stress maths (same rules as engine/src/parity/stress.py)", () => {
  it("median interval matches the engine's order statistics", () => {
    expect(medianInterval([1, 2, 3, 4])).toBeNull();
    expect(medianInterval([5, 1, 4, 2, 3])).toEqual([1, 5]);
    expect(medianInterval(Array.from({ length: 12 }, (_, i) => i))).toEqual([2, 9]);
    expect(medianInterval(Array.from({ length: 20 }, (_, i) => i))).toEqual([5, 14]);
  });

  it("drawdown and recovery by hand", () => {
    expect(drawdown([1, 1.2, 0.9, 1, 1.25, 1.3])).toEqual({ worst: 0.9 / 1.2 - 1, recover: 3 });
    expect(drawdown([1, 1.1, 1.2])).toEqual({ worst: 0, recover: 0 });
    expect(drawdown([1, 0.8, 0.7, 0.9]).recover).toBe(-1);
  });

  const dates = Array.from({ length: 300 }, (_, i) => new Date(Date.UTC(1990, 0, 5 + 7 * i)).toISOString().slice(0, 10));
  const grid = { dates, series: { a: dates.map((_, i) => 100 * 1.001 ** i * (1 + 0.02 * Math.sin(i))), b: dates.map((_, i) => 100 + i * 0.1) } };

  it("same seed, same paths; every mix shares the draws", () => {
    const w = weeklySimple(grid, ["a", "b"]);
    const one = simulate(w, [{ a: 1 }, { a: 1 }], 30, 20, 9);
    expect(Array.from(one[0][3])).toEqual(Array.from(one[1][3]));
    expect(Array.from(simulate(w, [{ a: 1 }], 30, 20, 9)[0][5])).toEqual(Array.from(one[0][5]));
    const s = summarise(one[0]);
    expect(s.n).toBe(20);
    expect([...s.final]).toEqual([...s.final].sort((x, y) => x - y));
  });

  it("a crash splices the same weeks into every path", () => {
    const w = weeklySimple(grid, ["a"]);
    const crash = { from: w.dates[100], to: w.dates[109] };
    const sims = simulate(w, [{ a: 1 }], 30, 10, 3, crash, 5)[0];
    const want = w.rows.slice(100, 110).reduce((v, r) => v * (1 + r[0]), 1);
    for (const p of sims) expect(p[15] / p[5]).toBeCloseTo(want, 10);
  });

  it("episodes do not overlap and need every shock", () => {
    const g = { dates: dates.slice(0, 20), series: { x: [100, 110, 121, 121, 121, 121, 133, 146, 146, 146, 146, 146, 146, 146, 146, 146, 146, 146, 146, 146] } };
    const eps = findEpisodes(g, [{ key: "x", size: 15 }], { x: "pct" }, 2, 1);
    expect(eps.map((e) => e.start)).toEqual([0, 5]);
    expect(findEpisodes(g, [{ key: "x", size: -15 }], { x: "pct" }, 2, 1)).toEqual([]);
  });
});

describe("echoes", () => {
  it("resemblance is cosine over shared markets", () => {
    const a = { a: 2, b: -1, c: 0.5, d: 1, e: 0.1, f: 3 };
    expect(resemblance(a, Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v * 2])), 6)?.sim).toBeCloseTo(1);
    expect(resemblance(a, { a: 1, b: 1 }, 6)).toBeNull();
  });
});
