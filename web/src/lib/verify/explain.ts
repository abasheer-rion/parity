// One line for every number Verify shows, used on hover or tap (REF-0016, acceptance
// test 10). Keyed by the number's id; the page refuses to show a number without one.
export const EXPLAIN: Record<string, string> = {
  // Card 1
  winRate: "Share of closed trades that made a profit above zero, after fees.",
  avgWin: "The average profit of the winning trades, after fees.",
  avgLoss: "The average loss of the losing trades, after fees.",
  payoff: "Average win divided by average loss. Above 1 means wins are bigger than losses.",
  expectancy: "What one trade makes on average: win rate times average win, minus loss rate times average loss.",
  expectancyPct: "The average result per trade as a share of the starting balance.",
  breakEven: "The win rate needed to make exactly zero at this payoff ratio: average loss over (average win plus average loss).",
  profitFactor: "All the profit from winners divided by all the losses from losers. Below 1 loses money.",
  n: "How many results these numbers are built from.",
  // Card 2
  worstTrade: "The single biggest losing trade, in money.",
  worstTradePct: "The biggest losing trade as a share of the account just before it.",
  worstDay: "The worst single day, in money.",
  worstDayPct: "The worst single day as a share of the account the evening before.",
  winsWipedOut: "How many average wins the worst loss cancels out. Above 20 is a red flag.",
  maxDrawdown: "The largest fall from a high point of the account to a later low. Above 50% is a red flag.",
  underwater: "The longest time, in calendar days, the account spent below an earlier high.",
  es5: "Expected shortfall: the average of the worst 5% of days (or periods).",
  skew: "Lopsidedness of the results. Negative means rare large losses and many small gains.",
  streaks: "Losing streaks followed by another trade, and how many of them saw the position size grow.",
  adds: "Times a new position was opened on the same side while an earlier one was open and losing.",
  // Card 3
  survives: "The largest number of tries for which the luck check stays at or above 0.95. Higher is stronger.",
  dsr: "The probability that the true Sharpe ratio is above zero after allowing for the tries, skew and fat tails. 0.95 is the line.",
  tries: "How many strategies, bots or settings were tried before this one. More tries make luck more likely.",
  sharpe: "Average return over its ups and downs, per period. Higher means steadier gains for the risk.",
  sharpeAnnual: "The Sharpe ratio scaled to a year, with a zero risk-free rate.",
  observations: "How many returns (or trades) the luck check used.",
  monthsMore: "How many more months of the same results the record would need to pass the luck check at the stated tries.",
  // Meta
  trades: "Closed trades read from the file, after open and cancelled orders were left out.",
  dates: "The first and last day in the record.",
  balance: "The starting balance used to turn profits into returns.",
  method: "The version of the rules that judged this record. It changes whenever a check or a line changes.",
  chart: "Your record as a point: its win rate against its payoff ratio. Above the curve makes money, below it loses.",
  // Matches and our own tests
  matchLuck: "The strategy's luck check score in our own research, with all our tries counted.",
  matchSharpe: "The strategy's yearly Sharpe ratio in our own backtest, after costs.",
  gauntlet: "How many of our research tests the strategy passed in its latest run.",
};

export function explain(id: string): string {
  const e = EXPLAIN[id];
  if (!e) throw new Error(`Verify: no explanation for the number "${id}"`);
  return e;
}
