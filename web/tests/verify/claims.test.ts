// Claim arithmetic (REF-0016) and the rule-based extractor for input B.
import { describe, expect, it } from "vitest";
import { breakEvenLoss, checkDescription, claimRows, ruleBreakEven, ruleDrawdown, ruleMonthly, ruleUncapped, ruleWinRateAlone } from "../../src/lib/verify/checks";
import { closest, extract, type Candidate } from "../../src/lib/verify/describe";

describe("claim arithmetic", () => {
  it("rule 1: 92% wins at a 5% take-profit break even with losses under 57.5% of a position", () => {
    expect(breakEvenLoss(0.05, 0.92)).toBeCloseTo(0.575, 10);
    expect(ruleBreakEven({ winRate: 0.92, takeProfit: 0.05 })!.text).toContain("57.5%");
    expect(ruleBreakEven({ winRate: 0.92, takeProfit: 0.05, stopLoss: 0.6 })!.status).toBe("fail");
    expect(ruleBreakEven({ winRate: 0.92, takeProfit: 0.05, stopLoss: 0.3 })!.status).toBe("info");
  });
  it("rule 2: a largest fall smaller than one loss is impossible", () => {
    expect(ruleDrawdown({ maxDrawdown: 0.05, maxLoss: 0.08 })!.status).toBe("fail");
    expect(ruleDrawdown({ maxDrawdown: 0.1, maxLoss: 0.08 })).toBeNull();
  });
  it("rule 3: over 10% a month is shown as a yearly figure", () => {
    const r = ruleMonthly({ monthlyReturn: 0.15 })!;
    expect(r.text).toContain("435% a year");
    expect(ruleMonthly({ monthlyReturn: 0.15, months: 6 })).toBeNull();
    expect(ruleMonthly({ monthlyReturn: 0.05 })).toBeNull();
  });
  it("rule 4: a grid or martingale with no stated maximum loss is not capped", () => {
    expect(ruleUncapped({ grid: true })!.text).toMatch(/^Loss is not capped/);
    expect(ruleUncapped({ martingale: true, maxLossCapped: true })).toBeNull();
  });
  it("rule 5: a win rate above 90% with no stated loss says nothing about profit", () => {
    expect(ruleWinRateAlone({ winRate: 0.95 })!.text).toMatch(/^The win rate alone says nothing about profit/);
    expect(ruleWinRateAlone({ winRate: 0.95, avgLoss: 0.02 })).toBeNull();
    expect(ruleWinRateAlone({ winRate: 0.8 })).toBeNull();
  });
});

describe("describing a bot (input B)", () => {
  const text = "Buys Bitcoin when RSI goes under 30 and sells at 5% profit, 50 trades a month, claims 92% win rate.";
  const x = extract(text);
  it("pulls out the claim", () => {
    expect(x.claim.winRate).toBeCloseTo(0.92, 10);
    expect(x.claim.takeProfit).toBeCloseTo(0.05, 10);
    expect(x.claim.tradesPerMonth).toBe(50);
    expect(x.asset).toBe("crypto");
    expect(x.family).toBe("value");
    expect(x.settings).toBe(2);
  });
  it("finds the arithmetic the spec describes and checks the description, not the bot", () => {
    const rows = claimRows(x.claim);
    expect(rows.map((r) => r.id)).toEqual(["breakeven", "winrate"]);
    const r = checkDescription({ text, claim: x.claim, settings: x.settings, trades: x.trades });
    expect(r.verdict.sentence).toContain("57.5%");
    expect(r.notes.join(" ")).toContain("not of the bot");
  });
  it("reads martingale, stops, drawdown and loss words", () => {
    const y = extract("Grid bot on EUR/USD that doubles the lot size after a loss. Max drawdown 5%, largest loss 8%, stop loss 2%.");
    expect(y.claim.grid && y.claim.martingale).toBe(true);
    expect(y.claim.maxDrawdown).toBeCloseTo(0.05, 10);
    expect(y.claim.maxLoss).toBeCloseTo(0.08, 10);
    expect(y.claim.stopLoss).toBeCloseTo(0.02, 10);
    expect(checkDescription({ text: "", claim: y.claim, settings: y.settings, trades: y.trades }).verdict.label).toBe("Does not hold up");
    const z = extract("Martingale bot on gold, 15% a month for 2 years.");
    expect(z.claim.monthlyReturn).toBeCloseTo(0.15, 10);
    expect(z.claim.months).toBe(24);
    expect(checkDescription({ text: "", claim: z.claim, settings: z.settings, trades: z.trades }).verdict.label).toBe("Fragile");
  });
  it("matches the closest tested strategies by kind and market", () => {
    const c = (id: string, family: string, asset: string): Candidate => ({ id, name: id, line: "", family, asset, style: "", from: "search", verdict: "", deflated: 0.5, sharpe: 0.3 });
    const m = closest(extract("Buys EUR/USD when RSI is oversold"), [c("trend-fx", "trend", "fx"), c("value-fx", "value", "fx"), c("value-stocks", "value", "stocks"), c("carry", "carry", "mixed")]);
    expect(m[0].c.id).toBe("value-fx");
    expect(m).toHaveLength(3);
  });
});
