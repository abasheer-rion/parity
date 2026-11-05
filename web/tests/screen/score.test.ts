// The batch screen's scoring math (DEC-0087): verdict rules, the numbers behind them, the
// firm summary, the back-test's intervals, and the CSV export.
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { backtest, newcombe, wilson } from "../../src/lib/screen/backtest";
import { cell, resultsCsv } from "../../src/lib/screen/export";
import { bestDayShare, DEFAULT_OPTIONS, passedByRule, scoreAccount, screenBatch, screenSync, summarise, top5Share, type AccountInput } from "../../src/lib/screen/score";
import { deflatedSharpe } from "../../src/lib/verify/dsr";
import type { Trade } from "../../src/lib/verify/types";

/** Trades on consecutive weekdays from 1 July 2026, several a day. */
function trades(pnls: number[], perDay = 3, sizes?: number[]): Trade[] {
  const out: Trade[] = [];
  let d = Date.UTC(2026, 6, 1);
  pnls.forEach((pnl, i) => {
    if (i && i % perDay === 0) { d += 86_400_000; while ([0, 6].includes(new Date(d).getUTCDay())) d += 86_400_000; }
    const t = new Date(d + (9 * 60 + (i % perDay) * 30) * 60_000).toISOString().slice(0, 19);
    out.push({ closeTime: t, pnl, fees: 0, ...(sizes ? { size: sizes[i] } : {}) });
  });
  return out;
}

/** A steady edge: wins of 300 and losses of 200, alternating in a fixed, mixed pattern. */
const STEADY = Array.from({ length: 60 }, (_, i) => ([0, 1, 3, 4].includes(i % 6) ? 300 : -200));

describe("one account", () => {
  it("says not enough trades under 30, with the count in the reason", () => {
    const r = scoreAccount({ id: "a", trades: trades([100, -50, 80]) });
    expect(r.verdict).toBe("not_enough");
    expect(r.reason).toMatch(/^Only 3 trades/);
    expect(r.dsr).toBeNull();
  });

  it("holds up with a steady edge, and the luck check is Verify's deflated Sharpe on the trades", () => {
    const r = scoreAccount({ id: "a", trades: trades(STEADY), balance: 100_000 });
    expect(r.verdict).toBe("holds_up");
    expect(r.dsr).toBeCloseTo(deflatedSharpe(STEADY, 1)!, 10);
    expect(r.expectancy).toBeCloseTo((40 * 300 - 20 * 200) / 60, 10);
    expect(r.winRate).toBeCloseTo(40 / 60, 10);
    expect(r.survives).toBeGreaterThan(1);
    expect(r.reason).toMatch(/^Makes 133\.33 a trade over 60 trades\. Luck check 1\.00 after 1 try/);
  });

  it("counts tries: the same record at many attempts can turn into likely luck", () => {
    const weak = Array.from({ length: 40 }, (_, i) => (i % 2 ? 260 : -200));
    const one = scoreAccount({ id: "a", trades: trades(weak), tries: 1 });
    const many = scoreAccount({ id: "a", trades: trades(weak), tries: 5000 });
    expect(many.dsr!).toBeLessThan(one.dsr!);
    expect(many.tries).toBe(5000);
    expect(one.survives).not.toBeNull();
    // At its "tries survived" it still passes, one more and it would not.
    expect(deflatedSharpe(weak, one.survives!)! >= 0.95 || one.survives === 0).toBe(true);
  });

  it("flags losing money per trade first", () => {
    const r = scoreAccount({ id: "a", trades: trades(Array.from({ length: 40 }, (_, i) => (i % 3 ? 100 : -260))) });
    expect(r.verdict).toBe("likely_luck");
    expect(r.flags[0]).toBe("loses");
    expect(r.reason).toMatch(/^Loses 26\.00 a trade on average after fees/);
  });

  it("flags size growing after losses as fragile", () => {
    // Doubling after each loss, back to 1 after a win: a martingale.
    const pnls: number[] = [], sizes: number[] = [];
    let size = 1;
    for (let i = 0; i < 48; i++) {
      const win = i % 4 === 3;
      pnls.push(win ? 400 * size : -100 * size);
      sizes.push(size);
      size = win ? 1 : size * 2;
    }
    const r = scoreAccount({ id: "a", trades: trades(pnls, 4, sizes) });
    expect(r.sizeGrowth).toBe(true);
    expect(r.flags).toContain("fragile");
    expect(r.verdict).toBe("likely_luck");
    expect(r.rules.sizeGrowth).toBe(true);
  });

  it("works out passing from the target and the loss limit, in trade order", () => {
    expect(passedByRule(trades([5000, 4000]), 100_000, 0.08, 0.1)).toBe(true);
    expect(passedByRule(trades([-10_000, 30_000]), 100_000, 0.08, 0.1)).toBe(false);
    expect(passedByRule(trades([3000]), 100_000, 0.08, 0.1)).toBe(false);
    const r = scoreAccount({ id: "a", trades: trades([5000, 4000]), balance: 100_000 });
    expect(r.passed).toBe(true);
    expect(r.passedFrom).toBe("rule");
    expect(scoreAccount({ id: "a", trades: trades([5000, 4000]), passed: false }).passedFrom).toBe("file");
  });

  it("measures the best day and the best 5 trades as shares of the profit", () => {
    const t = trades([100, 100, 100, 50, 50, 50, -30, 20, 20, 20, 20], 3);
    const total = 500;
    expect(bestDayShare(t)).toBeCloseTo(300 / total, 10);
    expect(top5Share(t)).toBeCloseTo((100 * 3 + 50 * 2) / total, 10);
    expect(bestDayShare(trades([-10, -20]))).toBeNull();
    expect(top5Share(trades([10, 20]))).toBeNull();
  });

  it("measures the worst fall from a high on the trade-by-trade balance", () => {
    const r = scoreAccount({ id: "a", trades: trades([1000, -2200, 500]), balance: 10_000 });
    expect(r.maxDrawdown).toBeCloseTo(2200 / 11_000, 10);
  });

  it("multiplies tries by the batch size when asked", () => {
    const r = scoreAccount({ id: "a", trades: trades(STEADY), tries: 2 }, { ...DEFAULT_OPTIONS, countBatchAsTries: true }, 250);
    expect(r.tries).toBe(500);
  });
});

describe("the batch", () => {
  const accounts: AccountInput[] = [
    { id: "good", trades: trades(STEADY), passed: true, outcome: "payout" },
    { id: "loser", trades: trades(Array.from({ length: 40 }, (_, i) => (i % 3 ? 100 : -260))), passed: true, outcome: "blowup" },
    { id: "thin", trades: trades([4000, 4500]), passed: true, outcome: "blowup" },
    { id: "failed", trades: trades([-3000, -8000]), passed: false },
  ];

  it("summarises passers by verdict and the firm rules", async () => {
    const results = await screenBatch(accounts);
    expect(results).toEqual(screenSync(accounts));
    const s = summarise(results);
    expect(s.accounts).toBe(4);
    expect(s.passers).toBe(3);
    expect(s.passersByVerdict).toEqual({ holds_up: 1, likely_luck: 1, not_enough: 1 });
    expect(s.luckyPasserShare).toBeCloseTo(0.5, 10);
    expect(s.passedFrom).toBe("file");
    expect(s.rules.map((r) => r.id)).toEqual(["consistency", "minDays", "sizeGrowth", "concentration"]);
    // The losing passer makes no profit, so the profit-share rules cannot be told for it.
    expect(s.rules.find((r) => r.id === "consistency")!.unknown).toBe(1);
    expect(s.flagCounts.loses).toBe(1);
  });

  it("back-tests the verdict against outcomes", () => {
    const bt = backtest(screenSync(accounts))!;
    expect([bt.tp, bt.fp, bt.fn, bt.tn]).toEqual([1, 0, 0, 1]);
    expect(bt.n).toBe(2);
    expect(bt.notEnough).toMatchObject({ k: 1, n: 1 });
    expect(bt.small).toBe(true);
    expect(backtest(screenSync([{ id: "x", trades: trades(STEADY) }]))).toBeNull();
  });
});

describe("intervals", () => {
  it("gives Wilson's interval", () => {
    const r = wilson(5, 10);
    expect(r.p).toBe(0.5);
    expect(r.lo).toBeCloseTo(0.2366, 4);
    expect(r.hi).toBeCloseTo(0.7634, 4);
    expect(wilson(0, 10).lo).toBe(0);
    expect(wilson(0, 10).hi).toBeCloseTo(0.2775, 4);
    expect(wilson(0, 0).p).toBeNull();
  });

  it("gives Newcombe's interval for a difference (his worked example: 56/70 against 48/80)", () => {
    const d = newcombe(wilson(56, 70), wilson(48, 80));
    expect(d.d).toBeCloseTo(0.2, 10);
    expect(d.lo).toBeCloseTo(0.0524, 4);
    expect(d.hi).toBeCloseTo(0.3339, 4);
  });
});

describe("the CSV export", () => {
  it("writes one row per account and keeps formulas out of spreadsheets", () => {
    const csv = resultsCsv(screenSync([{ id: "=HYPERLINK(1)", trades: trades(STEADY) }]));
    const [head, row] = csv.trim().split("\n");
    expect(head.split(",")[0]).toBe("account");
    expect(row.startsWith("'=HYPERLINK(1)")).toBe(true);
    expect(cell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(cell(-5)).toBe("-5");
    expect(cell(null)).toBe("");
  });
});
