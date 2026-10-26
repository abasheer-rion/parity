// Parity Trade (DEC-0040): the layout read back from storage or the database is checked
// field by field, and old product app links land on the right view.
import { describe, expect, it } from "vitest";
import { cleanLayout, freshLayout, SIDE_MAX, timeIn } from "../src/trade/state";
import { tradeHashFor, tradeUrl } from "../src/lib/space";

describe("cleanLayout", () => {
  it("falls back to a fresh layout for anything that is not an object", () => {
    for (const raw of [null, undefined, 42, "x", []]) expect(cleanLayout(raw).grid).toBe(1);
  });

  it("keeps good fields and drops or clamps bad ones", () => {
    const l = cleanLayout({
      grid: 4, active: 9, max: 2, type: "nope", log: true,
      cells: [{ symbol: "fx.EUR", tf: "W" }, { symbol: 5, tf: "Z" }],
      indicators: [{ id: "a", type: "rsi", params: { n: 7, bad: "x" } }, { id: "b", type: "evil" }],
      side: { width: 99999, dock: "left", split: 2 }, bottom: { height: -5, tab: "fills" },
    });
    expect(l.grid).toBe(4);
    expect(l.active).toBe(3);
    expect(l.max).toBe(2);
    expect(l.type).toBe(freshLayout().type);
    expect(l.log).toBe(true);
    expect(l.cells[0]).toEqual({ symbol: "fx.EUR", tf: "W" });
    expect(l.cells[1].symbol).toBe(freshLayout().cells[1].symbol);
    expect(l.cells[1].tf).toBe("D");
    expect(l.cells).toHaveLength(4);
    expect(l.indicators).toEqual([{ id: "a", type: "rsi", params: { n: 7 } }]);
    expect(l.side.width).toBe(SIDE_MAX);
    expect(l.side.dock).toBe("left");
    expect(l.side.split).toBe(0.85);
    expect(l.bottom.tab).toBe("fills");
    expect(l.bottom.height).toBeGreaterThanOrEqual(120);
  });
});

describe("old #/trade links", () => {
  it.each([
    ["#/trade", "chart"],
    ["#/trade?s=fx.EUR", "chart?s=fx.EUR"],
    ["#/trade/watchlists", "watchlists"],
    ["#/trade/screener", "screener"],
    ["#/trade/demo", "portfolio"],
    ["#/trade/demo?s=cmd.WTI", "portfolio?s=cmd.WTI"],
    ["#/trade?s=fx.EUR&tf=W&x=1", "chart?s=fx.EUR&tf=W"],
    ["#/trade/unknown", "chart"],
  ])("%s opens %s", (from, to) => {
    expect(tradeHashFor(from)).toBe(to);
  });

  it("opens trade.endyland.com on endyland.com and /trade/ elsewhere", () => {
    const onSite = /(^|\.)endyland\.com$/.test(window.location.hostname);
    expect(tradeUrl()).toBe(onSite ? "https://trade.endyland.com/" : "/trade/");
    expect(tradeUrl("portfolio")).toBe(onSite ? "https://trade.endyland.com/#/portfolio" : "/trade/#/portfolio");
  });
});

describe("timeIn", () => {
  it("formats in the chosen zone", () => {
    expect(timeIn("2026-10-24T14:05:00Z", "UTC")).toMatch(/24 Oct.*14:05/);
    expect(timeIn(null, "UTC")).toBe("");
  });
});
