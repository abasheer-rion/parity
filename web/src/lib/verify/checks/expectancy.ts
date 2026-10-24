// Card 1: win rate against expectancy (REF-0016). A 99% win rate can lose money when the
// losses are big enough; expectancy, the average result per trade, settles it.

export interface ExpectancyCard {
  /** What one result is: a closed trade, or a day (week, month) of an equity curve. */
  basis: "trade" | "period";
  n: number;
  winRate: number;
  lossRate: number;
  avgWin: number | null;
  avgLoss: number | null;
  payoff: number | null;
  expectancy: number;
  /** Expectancy as a share of the starting balance, when the balance is known. */
  expectancyPct: number | null;
  breakEven: number | null;
  profitFactor: number | null;
  grossProfit: number;
  grossLoss: number;
}

/** Card 1 from results (trade profits after fees, or period returns). */
export function expectancyCard(results: readonly number[], basis: ExpectancyCard["basis"], balance: number | null): ExpectancyCard {
  const wins = results.filter((v) => v > 0);
  const losses = results.filter((v) => v < 0);
  const n = results.length;
  const grossProfit = wins.reduce((s, v) => s + v, 0);
  const grossLoss = -losses.reduce((s, v) => s + v, 0);
  const avgWin = wins.length ? grossProfit / wins.length : null;
  const avgLoss = losses.length ? grossLoss / losses.length : null;
  const winRate = n ? wins.length / n : 0;
  const lossRate = n ? losses.length / n : 0;
  const expectancy = winRate * (avgWin ?? 0) - lossRate * (avgLoss ?? 0);
  return {
    basis, n, winRate, lossRate, avgWin, avgLoss,
    payoff: avgWin != null && avgLoss ? avgWin / avgLoss : null,
    expectancy,
    expectancyPct: basis === "trade" && balance ? expectancy / balance : null,
    breakEven: avgWin != null && avgLoss != null ? avgLoss / (avgWin + avgLoss) : avgLoss == null && avgWin != null ? 0 : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    grossProfit, grossLoss,
  };
}

/** The win rate a payoff ratio needs to break even: the curve on card 1's chart. */
export const breakEvenAt = (payoff: number) => 1 / (1 + payoff);
