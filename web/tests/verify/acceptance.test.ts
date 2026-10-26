// REF-0016 acceptance tests 1 to 4: the 99% bot, the honest small edge, the martingale
// and the peeking backtest, each run through the same path the page uses.
import { describe, expect, it } from "vitest";
import { checkFile } from "../../src/lib/verify/checks";
import { parseText } from "../../src/lib/verify/parse";
import type { PriceBook } from "../../src/lib/verify/prices";
import type { Answers } from "../../src/lib/verify/types";
import { bot99, honestEdge, martingaleLog, peekingLog } from "./fixtures";

const answers = (over: Partial<Answers> = {}): Answers => ({ kind: "backtest", balance: 10000, tries: 1, claim: {}, ...over });
const run = (text: string, a: Partial<Answers> = {}, prices: PriceBook | null = null) => checkFile({ parsed: parseText(text), answers: answers(a), prices });

describe("test 1: the 99% bot", () => {
  const r = run(bot99());
  it("does not hold up", () => expect(r.verdict.label).toBe("Does not hold up"));
  it("wins 99.0% of trades, loses 0.51 a trade, and needs 99.3% to break even", () => {
    expect(r.trades).toBe(1000);
    expect((r.card1!.winRate * 100).toFixed(1)).toBe("99.0");
    expect(r.card1!.expectancy.toFixed(2)).toBe("-0.51");
    expect((r.card1!.breakEven! * 100).toFixed(1)).toBe("99.3");
  });
  it("says so in a sentence built from those numbers", () => {
    expect(r.verdict.sentence).toContain("99.0%");
    expect(r.verdict.sentence).toContain("0.51");
    expect(r.verdict.sentence).toContain("99.3%");
    expect(r.verdict.sentence).toContain("150 times larger");
  });
  it("flags the tail risk too: one loss wipes out 150 wins", () => {
    expect(r.card2!.red).toBe(true);
    expect(r.card2!.winsWipedOut).toBeCloseTo(150, 6);
  });
});

describe("test 2: the honest small edge", () => {
  const one = run(honestEdge(), { tries: 1 });
  const many = run(honestEdge(), { tries: 1000 });
  it("has positive expectancy, 56% winners and a payoff ratio of 1.0 over 500 trades and 2 years", () => {
    expect(one.trades).toBe(500);
    expect(one.card1!.winRate).toBeCloseTo(0.56, 10);
    expect(one.card1!.payoff).toBeCloseTo(1, 10);
    expect(one.card1!.expectancy).toBeGreaterThan(0);
    expect(one.dateFrom).toBe("2023-01-02");
    expect(one.dateTo! >= "2024-12-25").toBe(true);
  });
  it("holds up at 1 try", () => expect(one.verdict.label).toBe("Holds up"));
  it("could be luck at 1,000 tries", () => expect(many.verdict.label).toBe("Could be luck"));
  it("prints the switch point as \"survives up to N tries\"", () => {
    const n = one.card3!.survives!;
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThan(1000);
    expect(one.verdict.sentence).toContain(`Survives up to ${n.toLocaleString("en-US")} tr`);
    expect(many.verdict.sentence).toContain(`survives up to ${n.toLocaleString("en-US")} tr`);
    // Just past the switch point the verdict flips.
    expect(run(honestEdge(), { tries: n }).verdict.label).toBe("Holds up");
    expect(run(honestEdge(), { tries: n + 1 }).verdict.label).toBe("Could be luck");
  });
});

describe("test 3: the martingale", () => {
  const r = run(martingaleLog());
  it("makes money overall", () => expect(r.card1!.expectancy).toBeGreaterThan(0));
  it("is flagged on card 2 and judged fragile", () => {
    expect(r.card2!.martingale.found).toBe(true);
    expect(r.card2!.martingale.grew).toBe(r.card2!.martingale.streaks);
    expect(r.card2!.red).toBe(true);
    expect(r.card2!.reasons.join(" ")).toContain("position size grew after losses");
    expect(r.verdict.label).toBe("Fragile");
  });
  it("is not flagged for a constant size", () => {
    const flat = martingaleLog().split("\n").map((line, i) => (i === 0 || !line ? line : line.replace(/,buy,\d+,/, ",buy,1,"))).join("\n");
    expect(run(flat).card2!.martingale.found).toBe(false);
  });
});

describe("test 4: the peeking backtest", () => {
  const { text, prices } = peekingLog();
  const r = run(text, {}, prices);
  const timing = r.card4.find((c) => c.id === "timing")!;
  it("flags perfect timing on card 4", () => {
    expect(timing.status).toBe("fail");
    expect(timing.detail).toContain("80%");
  });
  it("finds every fill inside the day's range", () => expect(r.card4.find((c) => c.id === "fills")!.status).toBe("pass"));
  it("says the check cannot be run when we hold no prices", () => {
    const none = run(text, {}, null).card4.find((c) => c.id === "timing")!;
    expect(none.status).toBe("na");
    expect(none.detail).toMatch(/^Cannot be checked from this input/);
  });
  it("says perfect timing cannot be checked when we hold one price a day, and flags a fill far from it", () => {
    const one = new Map<string, [number, number]>();
    for (const [d, [lo]] of prices.EURUSD.days) one.set(d, [lo, lo]);
    const r2 = run(text, {}, { EURUSD: { kind: "price", days: one, source: "test", bound: 0.02 } });
    expect(r2.card4.find((c) => c.id === "timing")!.status).toBe("na");
    expect(r2.card4.find((c) => c.id === "fills")!.status).toBe("pass");
    const bad = text.replace(/,1\.07\d*,/, ",1.30,");
    expect(run(bad, {}, { EURUSD: { kind: "price", days: one, source: "test", bound: 0.02 } }).card4.find((c) => c.id === "fills")!.status).toBe("fail");
  });
});

describe("other checks", () => {
  it("not enough data under 30 trades", () => {
    const r = run("close_time,pnl\n2024-01-02,10\n2024-01-03,-5\n2024-01-04,7\n");
    expect(r.verdict.label).toBe("Not enough data");
  });
  it("a claim the file contradicts does not hold up", () => {
    const r = run(honestEdge(), { claim: { winRate: 0.92 } });
    expect(r.verdict.label).toBe("Does not hold up");
    expect(r.verdict.sentence).toContain("92.0%");
  });
  it("a real-money label on a TradingView export fails card 4", () => {
    const tv = "Trade #,Type,Signal,Date/Time,Price USD,Contracts,Profit USD,Cum. Profit USD,Run-up USD,Drawdown USD\n1,Entry Long,L,2024-01-02 10:00,100,1,5,5,6,1\n1,Exit Long,X,2024-01-02 15:00,105,1,5,5,6,1\n";
    expect(run(tv, { kind: "real" }).card4.find((c) => c.id === "label")!.status).toBe("fail");
  });
  it("trade numbers that skip are flagged as edited history", () => {
    const lines = martingaleLog().split("\n").filter((_l, i) => i !== 40);
    expect(run(lines.join("\n")).card4.find((c) => c.id === "edited")!.status).toBe("fail");
  });
  it("without a balance the luck check uses each trade's profit", () => {
    const r = run(honestEdge(), { balance: null });
    expect(r.card3!.basis).toBe("trade");
    expect(r.card2!.maxDrawdown).toBeNull();
  });
});
