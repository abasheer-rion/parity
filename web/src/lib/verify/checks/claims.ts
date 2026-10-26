// Claim arithmetic (REF-0016): claims that fail on sums alone, before any trade is seen.
// Each rule is a pure function with a test in web/tests/verify/claims.test.ts.
import type { Claim } from "../types";

export type ClaimStatus = "fail" | "warn" | "info";
export interface ClaimRow { id: string; status: ClaimStatus; text: string }

/** The S&P 500's long-run yearly return with dividends, roughly, for scale. */
export const SP500_LONG_RUN = 0.1;

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d).replace(/\.0$/, "")}%`;

/** Rule 1: the average loss at which a take-profit and win rate break even, as a share of the position. */
export function breakEvenLoss(takeProfit: number, winRate: number): number {
  return winRate >= 1 ? Infinity : (takeProfit * winRate) / (1 - winRate);
}

export function ruleBreakEven(c: Claim): ClaimRow | null {
  if (c.takeProfit == null || c.winRate == null) return null;
  const be = breakEvenLoss(c.takeProfit, c.winRate);
  if (c.stopLoss != null) {
    return c.stopLoss > be
      ? { id: "breakeven", status: "fail", text: `A ${pct(c.winRate)} win rate with a ${pct(c.takeProfit)} take-profit breaks even only if losses average under ${pct(be)} of a position. The stated ${pct(c.stopLoss)} stop-loss is wider, so if most losers hit it, the average trade loses money before costs.` }
      : { id: "breakeven", status: "info", text: `A ${pct(c.winRate)} win rate with a ${pct(c.takeProfit)} take-profit breaks even if losses average under ${pct(be)} of a position. The stated ${pct(c.stopLoss)} stop-loss is inside that, so the claim adds up before costs.` };
  }
  return { id: "breakeven", status: "warn", text: `A ${pct(c.winRate)} win rate with a ${pct(c.takeProfit)} take-profit and no stop needs the average loss to stay under ${pct(be)} of a position to break even (${pct(c.takeProfit)} x ${c.winRate.toFixed(2)} / ${(1 - c.winRate).toFixed(2)}). With no stop, nothing keeps it there.` };
}

/** Rule 2: a stated maximum drawdown smaller than a stated single loss is impossible. */
export function ruleDrawdown(c: Claim): ClaimRow | null {
  if (c.maxDrawdown == null || c.maxLoss == null) return null;
  return c.maxDrawdown < c.maxLoss
    ? { id: "drawdown", status: "fail", text: `The claimed largest fall of ${pct(c.maxDrawdown)} is smaller than the claimed single loss of ${pct(c.maxLoss)}. One loss alone is a fall at least that big, so both cannot be true.` }
    : null;
}

/** Rule 3: a monthly return above 10% for more than 12 months, shown as the yearly figure it implies. */
export function ruleMonthly(c: Claim): ClaimRow | null {
  if (c.monthlyReturn == null || c.monthlyReturn <= 0.1) return null;
  if (c.months != null && c.months <= 12) return null;
  const yearly = (1 + c.monthlyReturn) ** 12 - 1;
  const grow = (1 + c.monthlyReturn) ** 24;
  return { id: "monthly", status: "warn", text: `${pct(c.monthlyReturn)} a month compounds to ${Math.round(yearly * 100).toLocaleString("en-US")}% a year, against about ${pct(SP500_LONG_RUN, 0)} a year for the S&P 500 over the long run. Kept up for two years it would turn $1,000 into $${Math.round(1000 * grow).toLocaleString("en-US")}.` };
}

/** Rule 4: a grid or martingale bot with no stated maximum loss. */
export function ruleUncapped(c: Claim): ClaimRow | null {
  if (!(c.grid || c.martingale) || c.maxLossCapped || c.maxLoss != null || c.stopLoss != null) return null;
  return { id: "uncapped", status: "fail", text: `Loss is not capped. A ${c.martingale ? "martingale" : "grid"} bot adds to losing positions, and with no stated maximum loss one long move against it can take the whole account.` };
}

/** Rule 5: a win rate above 90% with no stated average loss. */
export function ruleWinRateAlone(c: Claim): ClaimRow | null {
  if (c.winRate == null || c.winRate <= 0.9 || c.avgLoss != null || c.stopLoss != null) return null;
  return { id: "winrate", status: "warn", text: `The win rate alone says nothing about profit. At ${pct(c.winRate)}, the record loses money if the average loss is more than ${((c.winRate / (1 - c.winRate))).toFixed(1)} times the average win, and the claim does not say how big losses are.` };
}

export function claimRows(c: Claim): ClaimRow[] {
  return [ruleBreakEven(c), ruleDrawdown(c), ruleMonthly(c), ruleUncapped(c), ruleWinRateAlone(c)].filter((r): r is ClaimRow => r != null);
}
