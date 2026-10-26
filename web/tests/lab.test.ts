// Parity Workbench (DEC-0043): old product and research links land on the same view with
// the same filters, the address helpers point at lab.paritytrading.app, and Try settings reads
// and writes its strategy and settings in the address.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { appLink, labHashFor, labUrl, LAB_ROUTES } from "../src/lib/space";
import type { Report } from "../src/lib/types";
import { TryView } from "../src/lab/TryView";
import { CompareView } from "../src/lab/CompareView";

// jsdom has no matchMedia; the UI library asks it about reduced motion.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
  }
});

afterEach(cleanup);

describe("old links", () => {
  it.each([
    ["#/lab", "try"],
    ["#/compare", "compare"],
    ["#/compare?x=1", "compare"],
    ["#/scenarios", "whatif"],
    ["#/scenarios?type=war&r=middle_east", "whatif?type=war&r=middle_east"],
    ["#/search", "search"],
    ["#/search?asset=fx&q=carry", "search?asset=fx&q=carry"],
    ["#/edges", "edges"],
    ["#/edges/multiple-testing", "edges/multiple-testing"],
    ["#/edges/<x>", "edges"],
    ["#/strategies", ""],
  ])("%s opens %s", (from, to) => {
    expect(labHashFor(from)).toBe(to);
  });

  it("covers every moved route", () => {
    expect([...LAB_ROUTES].sort()).toEqual(["compare", "edges", "lab", "scenarios", "search"]);
  });

  it("opens lab.paritytrading.app on paritytrading.app and /lab/ elsewhere", () => {
    const onSite = /(^|\.)paritytrading\.app$/.test(window.location.hostname);
    expect(labUrl()).toBe(onSite ? "https://lab.paritytrading.app/" : "/lab/");
    expect(labUrl("search?q=carry")).toBe(onSite ? "https://lab.paritytrading.app/#/search?q=carry" : "/lab/#/search?q=carry");
    expect(appLink("research", "#/edges/multiple-testing")).toBe(labUrl("edges/multiple-testing"));
    expect(appLink("product", "#/scenarios")).toBe(labUrl("whatif"));
  });
});

const eq: [string, number][] = [["2020-01-01", 1], ["2021-01-01", 1.1]];
const run = (strategy: string, variants: { params: Record<string, number>; sharpe: number }[], extra: Partial<Report["runs"][number]> = {}) => ({
  strategy, params: variants[0]?.params ?? {}, is_benchmark: false, equity: eq,
  metrics: { sharpe: 0.5, cagr: 0.05, max_drawdown: -0.2, ann_vol: 0.1, deflated_sharpe: 0.3, correlation: 0.2 },
  gauntlet: { passed: 3, total: 11, verdict: "Some tests passed", sensitivity: { variants: variants.map((v) => ({ ...v, cagr: 0.04, max_drawdown: -0.1 })) } },
  ...extra,
});
const report = {
  generated_at: "2026-10-24T00:00:00Z",
  runs: [
    run("alpha", [{ params: { n: 10 }, sharpe: 0.4 }, { params: { n: 20 }, sharpe: 0.6 }, { params: { n: 30 }, sharpe: -0.1 }]),
    run("beta", [{ params: { k: 1 }, sharpe: 0.2 }, { params: { k: 2 }, sharpe: 0.3 }]),
    { ...run("spx", []), is_benchmark: true, gauntlet: undefined },
  ],
} as unknown as Report;

describe("Try settings", () => {
  beforeEach(() => { window.history.replaceState(null, "", "/lab/#/try"); });

  it("opens the strategy and version from the address", () => {
    window.history.replaceState(null, "", "/lab/#/try?s=alpha&p.n=30");
    render(createElement(TryView, { report }));
    expect(screen.getByText("Version 3 of 3. All 3 count as", { exact: false })).toBeTruthy();
  });

  it("writes a picked version and strategy back to the address", () => {
    render(createElement(TryView, { report }));
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    expect(window.location.hash).toBe("#/try?p.n=20");
    fireEvent.click(screen.getAllByRole("button", { pressed: false }).find((b) => b.getAttribute("title") === "beta")!);
    expect(window.location.hash).toBe("#/try?s=beta");
  });
});

describe("Compare", () => {
  it("keeps the table and sort in the address", () => {
    window.history.replaceState(null, "", "/lab/#/compare");
    render(createElement(CompareView, { report }));
    fireEvent.click(screen.getByRole("button", { name: "Sharpe" }));
    expect(window.location.hash).toBe("#/compare?sort=sharpe");
    fireEvent.click(screen.getByRole("radio", { name: "Crises" }));
    expect(window.location.hash).toBe("#/compare?sort=sharpe&t=crisis");
  });
});
