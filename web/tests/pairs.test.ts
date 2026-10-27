// Pairs (src/lib/pairs.ts, src/components/pairs/PairsReport.tsx): the committed snapshot
// parses, every field may be null, a file with a price field is refused before anything
// draws, and the page reads the engine's dev file first, then the snapshot.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assertNoPrices, costGrid, isPriceField, loadPairs, PAIRS_FILE, PAIRS_LOCAL_FILE, parsePairs, positionSpans, PriceFieldError, priceFields, points, timeInMarket,
} from "../src/lib/pairs";
import { PairsReport } from "../src/components/pairs/PairsReport";

const SNAPSHOT = resolve(import.meta.dirname, "../public/data/pairs.json");
const raw = () => JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Record<string, unknown>;

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
  }
});
afterEach(() => { cleanup(); window.location.hash = ""; });

describe("the committed snapshot", () => {
  it("parses, with weekly points and derived fields only", () => {
    const doc = parsePairs(raw());
    expect(doc.version).toBe(1);
    expect(doc.leaderboard.length).toBeGreaterThan(0);
    expect(doc.pairs.length).toBeGreaterThan(0);
    for (const p of doc.pairs) {
      const len = p.series.dates.length;
      expect(len).toBeGreaterThan(100);
      for (const k of ["z", "hedge", "pvalue", "halflife", "position"] as const) expect(p.series[k]).toHaveLength(len);
      expect(doc.leaderboard.some((r) => r.id === p.recipe)).toBe(true);
    }
    expect(priceFields(raw())).toEqual([]);
  });

  it("labels every pair with display rights the guard knows", () => {
    expect(parsePairs(raw()).pairs.every((p) => ["public", "internal", "research"].includes(p.rights))).toBe(true);
  });
});

describe("the no-prices guard", () => {
  it.each(["price", "close", "level", "prices", "closes", "levels", "price_a", "close_b", "adj_close", "levelA", "closePrice", "midprice", "spread_level", "Close"])("refuses a field named %s", (k) => {
    expect(isPriceField(k)).toBe(true);
  });

  it.each(["z", "hedge", "pvalue", "pvalue_now", "halflife", "position", "sharpe", "total_return", "closed_trades", "enclosure", "johansen_trace", "label_a", "relevel"])("allows %s", (k) => {
    expect(isPriceField(k)).toBe(false);
  });

  it("finds a price field anywhere in the file", () => {
    const doc = raw();
    (doc.pairs as Record<string, Record<string, unknown>>[])[1].series.close = [1, 2, 3];
    expect(priceFields(doc)).toEqual(["pairs[1].series.close"]);
    expect(() => parsePairs(doc)).toThrow(PriceFieldError);
  });

  it("refuses a price field even when the pair is public and its value is null", () => {
    expect(() => assertNoPrices({ pairs: [{ rights: "public", price: null }] })).toThrow(/price fields \(pairs\[0\]\.price\)/);
  });

  it("refuses to draw a document that carries prices", () => {
    const doc = { ...parsePairs(raw()), extra: { level: [100] } } as unknown as ReturnType<typeof parsePairs>;
    render(createElement(PairsReport, { doc }));
    expect(screen.getByRole("alert")).toHaveTextContent("These results cannot be shown");
    expect(screen.queryByText("Recipes, best first")).toBeNull();
  });
});

describe("parsing", () => {
  it("refuses another version", () => {
    expect(() => parsePairs({ ...raw(), version: 2 })).toThrow(/version 2/);
  });

  it("turns every missing or bad value into null and drops rows without their key", () => {
    const doc = parsePairs({
      version: 1, data: null, trials: null, methods: null,
      leaderboard: [{ id: "x", sharpe: "high", deflated_sharpe: Number.NaN }, { name: "no id" }],
      pairs: [{ id: "a~b", series: { dates: ["2020-01-03", "2020-01-10"], z: [1.5] }, stats: null, results: null }],
      by_year: [{ recipe: "x", year: null }], by_regime: null, breakdowns: [{ recipe: "x", date: "2020-01-10" }], cost_sensitivity: [], decay: null,
    });
    expect(doc.leaderboard).toHaveLength(1);
    expect(doc.leaderboard[0].sharpe).toBeNull();
    expect(doc.leaderboard[0].deflated_sharpe).toBeNull();
    expect(doc.pairs[0].series.z).toEqual([1.5, null]);
    expect(doc.pairs[0].series.hedge).toEqual([null, null]);
    expect(doc.pairs[0].stats.pvalue_now).toBeNull();
    expect(doc.by_year).toEqual([]);
    expect(doc.breakdowns[0].z_at_exit).toBeNull();
    expect(doc.data.sources).toEqual([]);
  });

  it("draws an empty or all-null file with plain states, never NaN", () => {
    const doc = parsePairs({
      version: 1, leaderboard: [{ id: "r1", name: "Empty recipe" }],
      pairs: [{ id: "a~b", recipe: "r1", label_a: "A", label_b: "B", series: { dates: [] } }],
    });
    const { container } = render(createElement(PairsReport, { doc }));
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/NaN|undefined|Infinity/);
    expect(screen.getAllByText("Not enough data.").length).toBeGreaterThan(3);
    expect(text).toContain("No breakdowns recorded.");
  });

  it("draws the snapshot with every section", () => {
    const { container } = render(createElement(PairsReport, { doc: parsePairs(raw()) }));
    for (const h of ["Recipes, best first", "Wins and losses by year", "By market mood", "Costs", "Decay", "Breakdowns", "The gap, in standard deviations", "Hedge ratio", "Fluke chance (p-value)", "Half-life", "Data sources"]) {
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    }
    expect(container.textContent ?? "").not.toMatch(/NaN|undefined|Infinity|\u2014|\u2013/);
    // Every chart has a written version (WCAG 1.1.1).
    for (const svg of container.querySelectorAll("svg[role='img']")) expect(svg.getAttribute("aria-describedby")).toBeTruthy();
  });
});

describe("helpers", () => {
  it("finds the stretches with a position open", () => {
    const d = ["w1", "w2", "w3", "w4", "w5", "w6"];
    expect(positionSpans(d, [0, 1, 1, 0, -1, null])).toEqual([{ from: "w2", to: "w3", side: 1 }, { from: "w5", to: "w5", side: -1 }]);
    expect(timeInMarket([0, 1, 1, 0, -1, null])).toBeCloseTo(0.6);
    expect(timeInMarket([])).toBeNull();
    expect(points(d, [1, null, 3, null, null, null])).toEqual([["w1", 1], ["w3", 3]]);
  });

  it("lays cost sensitivity out as a grid", () => {
    const g = costGrid([{ recipe: "r", cost_bps: 10, borrow_bps: 50, sharpe: 0.2 }, { recipe: "r", cost_bps: 0, borrow_bps: 0, sharpe: 0.5 }, { recipe: "q", cost_bps: 5, borrow_bps: 5, sharpe: 1 }], "r");
    expect(g.costs).toEqual([0, 10]);
    expect(g.borrows).toEqual([0, 50]);
    expect(g.at(10, 50)).toBe(0.2);
    expect(g.at(10, 0)).toBeNull();
  });
});

describe("loading", () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("in development reads the engine's file first, then the committed snapshot", async () => {
    const f = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("no", { status: 404 }))
      .mockResolvedValueOnce(json(raw()));
    const doc = await loadPairs();
    expect(doc.pairs.length).toBeGreaterThan(0);
    expect(f.mock.calls.map((c) => String(c[0]))).toEqual([PAIRS_LOCAL_FILE, PAIRS_FILE]);
  });

  it("says so calmly when the file is not there", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }));
    await expect(loadPairs()).rejects.toThrow("No pairs results have been published yet.");
  });

  it("refuses a file with prices", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ ...raw(), close: [1] }));
    await expect(loadPairs()).rejects.toThrow(PriceFieldError);
  });
});
