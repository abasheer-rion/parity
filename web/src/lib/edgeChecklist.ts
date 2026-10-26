// The Edge Lab checklist: answers about a trading idea in, a ranked list of pitfalls out.
// Pure logic, no React and no network, so it can be tested on its own. The lessons and
// examples it links to live in docs/_system/edge-lab.json (see lib/edgeLab.ts).

export type LessonId = "register" | "out-of-sample" | "costs" | "multiple-testing" | "look-ahead" | "capacity" | "too-good";

export type DataKind = "prices" | "macro" | "weekly" | "news" | "fundamentals";
export type Frequency = "intraday" | "daily" | "weekly" | "monthly";
export type Trials = "one" | "few" | "dozens" | "hundreds" | "unknown";
export type Instrument = "tradable" | "average" | "index" | "spot" | "unsure";
export type YesNo = "yes" | "no" | "unsure";
export type SharpeBand = "low" | "mid" | "high" | "extreme";
export type CashShare = "rarely" | "half" | "mostly" | "almost-always";
export type Published = "no" | "old" | "recent" | "new";
export type Liquidity = "liquid" | "illiquid";

export interface Answers {
  data: DataKind[];
  frequency: Frequency;
  trials: Trials;
  instrument: Instrument;
  /** Has the test period already been looked at? */
  seen: YesNo;
  /** Is there data set aside that has never been looked at? */
  holdout: YesNo;
  sharpe: SharpeBand;
  cash: CashShare;
  published: Published;
  assets: Liquidity;
}

export type Severity = "high" | "medium" | "low";

export interface Pitfall {
  id: string;
  title: string;
  why: string;
  lesson: LessonId;
  /** An example from our own research, by id in edge-lab.json. */
  example?: string;
  severity: Severity;
}

export const DEFAULT_ANSWERS: Answers = {
  data: ["prices"], frequency: "daily", trials: "few", instrument: "tradable", seen: "no", holdout: "yes",
  sharpe: "mid", cash: "rarely", published: "no", assets: "liquid",
};

/** The questions, in order, with their choices. The page renders these as radio groups. */
export const QUESTIONS: { key: Exclude<keyof Answers, "data">; label: string; options: [string, string][] }[] = [
  { key: "frequency", label: "How often does it trade?", options: [["intraday", "Several times a day"], ["daily", "About daily"], ["weekly", "About weekly"], ["monthly", "Monthly or slower"]] },
  { key: "trials", label: "How many variations have you tried?", options: [["one", "Just this one"], ["few", "2 to 10"], ["dozens", "11 to 100"], ["hundreds", "More than 100"], ["unknown", "I lost count"]] },
  { key: "instrument", label: "What price does the backtest trade at?", options: [["tradable", "A price I could really trade at"], ["average", "A monthly or weekly average"], ["index", "An index level"], ["spot", "A spot price, like spot gas"], ["unsure", "Not sure"]] },
  { key: "seen", label: "Have you already looked at results for the test period?", options: [["no", "No"], ["yes", "Yes"], ["unsure", "Not sure"]] },
  { key: "holdout", label: "Is there data set aside you have never looked at?", options: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] },
  { key: "sharpe", label: "How big is the backtest Sharpe ratio?", options: [["low", "Below 0.5"], ["mid", "0.5 to 1"], ["high", "1 to 2"], ["extreme", "Above 2"]] },
  { key: "cash", label: "How much of the time is it in cash?", options: [["rarely", "Under a quarter"], ["half", "A quarter to three quarters"], ["mostly", "75% to 95%"], ["almost-always", "More than 95%"]] },
  { key: "published", label: "Is it from a published paper?", options: [["no", "No, my own idea"], ["old", "Yes, before 2000"], ["recent", "Yes, 2000 to 2015"], ["new", "Yes, after 2015"]] },
  { key: "assets", label: "What does it trade?", options: [["liquid", "Large, liquid markets"], ["illiquid", "Small or thinly traded markets"]] },
];

export const DATA_OPTIONS: [DataKind, string][] = [
  ["prices", "Prices only"],
  ["macro", "Monthly or quarterly economic data"],
  ["weekly", "Weekly reports, like COT or jobless claims"],
  ["news", "News or sentiment"],
  ["fundamentals", "Company fundamentals"],
];

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Every pitfall that applies to these answers, most serious first. */
export function checkIdea(a: Answers): Pitfall[] {
  const out: Pitfall[] = [];
  const add = (p: Pitfall) => out.push(p);
  const data = new Set(a.data);

  // Too good to be true comes first: it usually means a bug, not an edge.
  if (a.cash === "almost-always") add({ id: "cash-fake-sharpe", severity: "high", lesson: "too-good", example: "cash-only", title: "It sits in cash almost all the time", why: "A line that barely moves has almost no risk to divide by, so the Sharpe ratio looks huge on a handful of trades. Our search rejects these outright." });
  else if (a.cash === "mostly") add({ id: "cash-few-trades", severity: "medium", lesson: "too-good", example: "cash-only", title: "It is in cash most of the time", why: "Count how many separate bets the result rests on. A few lucky trades can carry the whole backtest." });

  if (a.instrument === "average") add({ id: "untradable-average", severity: "high", lesson: "too-good", example: "copper", title: "It trades at an average price", why: "Nobody can buy at a monthly average, and the average is only known after the period ends. Use it as a delayed signal and trade something real." });
  else if (a.instrument === "spot") add({ id: "untradable-spot", severity: "high", lesson: "too-good", example: "natural-gas", title: "It trades at a spot price nobody trades", why: "Spot prices can spike in ways futures do not. Our gas strategy led the race at +2,632% for this reason." });
  else if (a.instrument === "index") add({ id: "untradable-index", severity: "medium", lesson: "too-good", title: "It trades at an index level", why: "You cannot buy an index itself. Test it on a fund or future that tracks it, with that product's costs and tracking gap." });
  else if (a.instrument === "unsure") add({ id: "untradable-unsure", severity: "medium", lesson: "too-good", title: "Check what price the backtest really uses", why: "If you are not sure, find out. Averages, index levels and spot prices can all show gains nobody could earn." });

  if (a.sharpe === "extreme") add({ id: "sharpe-extreme", severity: "high", lesson: "too-good", title: "A Sharpe ratio above 2 is a warning sign", why: "Very few real strategies hold a Sharpe above 2 after costs. Look for a bug, a peek at future data or an untradable price first." });
  else if (a.sharpe === "high") add({ id: "sharpe-high", severity: "medium", lesson: "too-good", title: "A Sharpe ratio above 1 deserves a second look", why: "It can be real, but check timing, costs and the number of tries first." });

  // Look-ahead: data used before it was public.
  if (data.has("macro")) add({ id: "lag-macro", severity: "high", lesson: "look-ahead", example: "copper", title: "Economic data arrives late and gets revised", why: "Monthly and quarterly figures are released weeks after the period ends, then revised. Use each value only from its release date, as first published." });
  if (data.has("weekly")) add({ id: "lag-weekly", severity: "high", lesson: "look-ahead", title: "Weekly reports are released days after their date", why: "COT positions are as of Tuesday but come out Friday. Jobless claims for a week come out the next Thursday. Shift each value to its release day." });
  if (data.has("fundamentals")) add({ id: "lag-fundamentals", severity: "high", lesson: "look-ahead", title: "Company results arrive weeks after the quarter", why: "Use only figures as they were first reported, from the day they were reported. Restated numbers and today's company list both leak the future." });
  if (data.has("news")) add({ id: "lag-news", severity: "medium", lesson: "look-ahead", title: "Check the exact time each story was public", why: "A story dated today may have come out after the close. Trade only on stories timestamped before the price you trade at." });
  if (data.has("prices") && (a.frequency === "daily" || a.frequency === "intraday")) add({ id: "lag-closes", severity: "low", lesson: "look-ahead", example: "brent-wti", title: "Prices with the same date can close hours apart", why: "If the rule mixes markets, check their closing times. Acting the same day on Brent and WTI turned a 0.5 Sharpe into 1.2." });

  // Holdout and registration.
  if (a.seen === "yes" && a.holdout !== "yes") add({ id: "no-clean-test", severity: "high", lesson: "out-of-sample", title: "There is no clean test left", why: "You have seen the test period and kept nothing aside. Write the rule down now and judge it only on data that arrives from today." });
  else if (a.holdout !== "yes") add({ id: "no-holdout", severity: "high", lesson: "out-of-sample", title: "Set aside data you never look at", why: "Without a holdout, the backtest only shows how well the rule fits the past it was built on." });
  if (a.seen !== "no") add({ id: "register-now", severity: a.seen === "yes" ? "medium" : "low", lesson: "register", title: "Register the rule before the next test", why: "Write down the rule, the market and what counts as failure, then run it once. Changes after seeing results are new trials." });
  else add({ id: "register-first", severity: "low", lesson: "register", title: "Write it down before you run it", why: "You have not looked yet, which is the best time to fix the rule and the pass mark." });

  // Multiple testing.
  if (a.trials === "hundreds" || a.trials === "unknown") add({ id: "many-trials", severity: "high", lesson: "multiple-testing", example: "cash-only", title: a.trials === "unknown" ? "Count your trials" : "More than 100 tries will turn up a lucky winner", why: "The best of many random rules always looks good. Judge it with a deflated Sharpe ratio that uses the full count of tries." });
  else if (a.trials === "dozens") add({ id: "some-trials", severity: "medium", lesson: "multiple-testing", title: "11 to 100 tries raise the bar", why: "Every changed window, asset or start date is another trial. Report the count and deflate the Sharpe ratio for it." });
  else if (a.trials === "few") add({ id: "few-trials", severity: "low", lesson: "multiple-testing", title: "Keep counting your tries", why: "A handful is fine if you report them all. Nudging settings until it works is how a few tries become many." });

  // Costs.
  if (a.frequency === "intraday") add({ id: "costs-intraday", severity: "high", lesson: "costs", title: "Costs will likely eat an intraday edge", why: "Several trades a day pay the spread and fees each time. Work out the breakeven cost per trade and compare it with what you would really pay." });
  else if (a.frequency === "daily") add({ id: "costs-daily", severity: a.assets === "illiquid" ? "high" : "medium", lesson: "costs", title: "Check the breakeven cost", why: "Trading daily, small costs add up fast. Rerun it at double your cost guess and check it still makes money." });
  else if (a.assets === "illiquid") add({ id: "costs-illiquid", severity: "medium", lesson: "costs", title: "Thin markets cost more than they look", why: "Wide spreads and price impact can be far above a standard cost guess." });

  // Capacity and decay.
  if (a.assets === "illiquid") add({ id: "capacity", severity: "high", lesson: "capacity", title: "It may not fit real money", why: "In thin markets your own orders move the price. Check how much you could trade before the edge is gone." });
  if (a.published !== "no") add({ id: "decay", severity: a.published === "old" ? "medium" : "low", lesson: "capacity", title: "Published edges fade", why: "Stock return patterns earned about 58% less after publication (McLean and Pontiff, 2016). Test the years after the paper on their own." });

  return out.map((p, i) => ({ p, i })).sort((x, y) => RANK[x.p.severity] - RANK[y.p.severity] || x.i - y.i).map(({ p }) => p);
}

/** A one-line read of the list, for the top of the results. */
export function summary(list: Pitfall[]): string {
  const high = list.filter((p) => p.severity === "high").length;
  if (!high) return "No major red flags from these answers. They do not prove an edge. Register it and test it on new data.";
  return `${high} serious ${high === 1 ? "problem" : "problems"} to rule out before trusting the backtest.`;
}
