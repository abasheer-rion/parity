// The product home's rules (DEC-0075): widget order and folding, the treemap, the greeting name and the setup reminder's timing.
import { describe, expect, it } from "vitest";
import { arrange, countSession, DEFAULT_ORDER, dropOn, emptyLayout, IGNORED_LIMIT, move, normalize, segmentOf, WIDGETS } from "../src/home/registry";
import { squarify } from "../src/home/treemap";
import { cleanFirstName, firstNameFrom, greeting } from "../src/lib/firstName";
import { nudgeDue } from "../src/onboarding/SetupButton";

describe("widget layout", () => {
  it("every segment's default order holds every widget once", () => {
    for (const order of Object.values(DEFAULT_ORDER)) expect([...order].sort()).toEqual(WIDGETS.map((w) => w.id).sort());
  });
  it("normalize drops unknown ids and adds missing widgets", () => {
    const l = normalize({ order: ["news", "nope", "news"], hidden: ["heatmap", 3] }, "trader");
    expect(l.order[0]).toBe("news");
    expect(l.order).toHaveLength(WIDGETS.length);
    expect(l.hidden).toEqual(["heatmap"]);
  });
  it("hidden widgets are left out and the person's order beats a planner once custom", () => {
    const l = { ...emptyLayout("new"), hidden: ["sims" as const] };
    expect(arrange(l, null).shown).not.toContain("sims");
    expect(arrange(l, { order: ["news"] }).shown[0]).toBe("news");
    expect(arrange({ ...l, custom: true }, { order: ["news"] }).shown[0]).toBe("ticker");
  });
  it("a widget ignored for IGNORED_LIMIT sessions folds, unless kept", () => {
    let l = emptyLayout("new");
    for (let i = 0; i < IGNORED_LIMIT; i++) l = countSession(l, new Set(["news"]), new Set());
    expect(arrange(l, null).auto.has("news")).toBe(true);
    expect(arrange({ ...l, kept: ["news"] }, null).collapsed.has("news")).toBe(false);
    l = countSession(l, new Set(["news"]), new Set(["news"]));
    expect(arrange(l, null).collapsed.has("news")).toBe(false);
  });
  it("move and drop reorder and mark the layout custom", () => {
    const l = emptyLayout("new");
    const shown = arrange(l, null).shown;
    const m = move(l, shown[1], -1, shown);
    expect(m.order[0]).toBe(shown[1]);
    expect(m.custom).toBe(true);
    expect(move(l, shown[0], -1, shown)).toBe(l);
    const d = dropOn(l, shown[0], shown[2], shown);
    expect(d.order.indexOf(shown[0])).toBe(2);
  });
  it("segments come from picks and done items", () => {
    expect(segmentOf([], {})).toBe("new");
    expect(segmentOf(["trade"], { lesson: true })).toBe("both");
    expect(segmentOf([], { verify: true })).toBe("browser");
    expect(segmentOf(["learn"], {})).toBe("learner");
  });
});

describe("treemap", () => {
  it("fills the space with areas in proportion to values", () => {
    const vals = [60, 25, 10, 5];
    const boxes = squarify(vals, (v) => v, 200, 100);
    expect(boxes).toHaveLength(4);
    const area = boxes.reduce((s, b) => s + b.w * b.h, 0);
    expect(area).toBeCloseTo(20000, 6);
    for (const b of boxes) expect(b.w * b.h).toBeCloseTo((b.item / 100) * 20000, 6);
    for (const b of boxes) { expect(b.x + b.w).toBeLessThanOrEqual(200 + 1e-6); expect(b.y + b.h).toBeLessThanOrEqual(100 + 1e-6); }
  });
  it("returns nothing for no space or no values", () => {
    expect(squarify([1, 2], (v) => v, 0, 100)).toEqual([]);
    expect(squarify([], (v: number) => v, 10, 10)).toEqual([]);
  });
});

describe("greeting", () => {
  it("uses a first name only, never an email or a one-word username", () => {
    expect(firstNameFrom({ full_name: "Ayan Basheer" })).toBe("Ayan");
    expect(firstNameFrom({ name: "ayanbasheer" })).toBeNull();
    expect(firstNameFrom({ given_name: "ayan" })).toBe("Ayan");
    expect(cleanFirstName("a@b.com")).toBeNull();
    expect(cleanFirstName("user123")).toBeNull();
    expect(greeting("Ayan")).toBe("Hi Ayan");
    expect(greeting(null)).toBe("Hi");
  });
});

describe("setup reminder", () => {
  it("shows at most once every three days", () => {
    const now = 1_000_000_000_000;
    expect(nudgeDue(null, now)).toBe(true);
    expect(nudgeDue(String(now - 3600_000), now)).toBe(false);
    expect(nudgeDue(String(now - 4 * 24 * 3600_000), now)).toBe(true);
  });
});

import { monthlyCandles } from "../src/home/candles";
describe("strategy candles", () => {
  it("builds joined-up monthly candles from daily values", () => {
    const pts: [string, number][] = [["2026-01-30", 100], ["2026-02-02", 104], ["2026-02-15", 97], ["2026-02-27", 102], ["2026-03-03", 101], ["2026-03-31", 110]];
    const c = monthlyCandles(pts, 12);
    expect(c.candles).toEqual([[100, 104, 97, 102], [102, 110, 101, 110]]);
    expect(c.labels).toEqual(["2026-02", "2026-03"]);
    expect(c.change).toBeCloseTo(0.1, 9);
  });
});
