// The key hints match the views they switch: Shift and a number reaches every view, and
// the tours and key lists say how many there are (Trade's tour once said 1 to 8 of 9).
import { describe, expect, it } from "vitest";
import { TOURS } from "../src/onboarding/tours";
import { KEYS as LAB_KEYS, VIEWS as LAB_VIEWS } from "../src/lab/state";
import { VIEWS as TRADE_VIEWS } from "../src/trade/state";

describe("view keys", () => {
  it("Trade's tour counts every Trade view", () => {
    const step = TOURS.trade.steps.find((s) => /Shift\+1 to \d/.test(String(s.body)));
    expect(String(step?.body)).toContain(`Shift+1 to ${TRADE_VIEWS.length}`);
  });
  it("Workbench's key list counts and names every Workbench view", () => {
    const row = LAB_KEYS.find(([k]) => k.startsWith("Shift+1 to"));
    expect(row?.[0]).toBe(`Shift+1 to ${LAB_VIEWS.length}`);
    expect(row?.[1].split(", ")).toHaveLength(LAB_VIEWS.length);
  });
});
