// The words for the "how it holds up" section: one plain sentence per number, built from
// the numbers themselves (REF-0017). Pure functions, so tests can read the copy.
import type { Holdup, HoldupMust, HoldupRegimeFamily } from "../../lib/types";

const MINUS = "−";
const minus = (s: string) => s.replace(/^-/, MINUS);

export const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "n/a" : minus(`${(v * 100).toFixed(d)}%`));
export const signedPct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "n/a" : `${v >= 0 ? "+" : MINUS}${Math.abs(v * 100).toFixed(d)}%`);
export const dec = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "n/a" : minus(v.toFixed(d)));
export const int = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "n/a" : Math.round(v).toLocaleString("en-US"));

/** A p-value the way a reader can take it in: 0.0002 reads "under 0.001". */
export function pText(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "n/a";
  if (p < 0.001) return "under 0.001";
  return p < 0.01 ? p.toFixed(3) : p.toFixed(2);
}

export const tries = (n: number) => `${int(n)} ${n === 1 ? "try" : "tries"}`;

export const FAMILY_TITLE: Record<HoldupRegimeFamily["family"], string> = {
  rates: "Rates rising or falling",
  volatility: "Calm or volatile markets",
  crises: "Stock market crises",
  decades: "By decade",
};

export const FAMILY_HELP: Record<HoldupRegimeFamily["family"], string> = {
  rates: "Days split by whether the 10-year Treasury yield was higher or lower than a year before.",
  volatility: "Days split by whether the market's last three months were bumpier than its usual level.",
  crises: "Each named fall of the S&P 500, from its peak to its low.",
  decades: "Each decade with at least three months of data.",
};

const REASON: Record<string, string> = {
  no_rate_series: "No interest rate series was loaded for this run.",
  no_benchmark: "There is no benchmark to compare against.",
  too_short: "The record is too short for this split.",
  no_overlap: "The record covers none of the named crises.",
  not_provided: "Not provided.",
  is_benchmark: "This is the benchmark itself.",
  upload: "An uploaded record has no market series attached.",
};

/** Why a source or a split is missing, in words. Unknown codes are shown as they come. */
export function reasonText(code: string | null | undefined): string {
  if (!code) return "Not available.";
  return REASON[code] ?? `Not available: ${code.replace(/_/g, " ")}.`;
}

/** One sentence on the luck check. */
export function luckSentence(h: Holdup): string {
  const l = h.luck;
  if (l.probability == null) return "The record is too short for the luck check: it needs at least 30 days of returns.";
  const at = `at ${tries(l.n_trials)}`;
  const chance = `${Math.round(l.probability * 100)}%`;
  if (l.verdict === "unlikely_luck") return `After allowing for ${tries(l.n_trials)}, there is a ${chance} chance the true Sharpe is above zero. That clears the 95% line, so luck alone is an unlikely explanation.`;
  if (l.verdict === "borderline") return `After allowing for ${tries(l.n_trials)}, the chance the true Sharpe is above zero is ${chance}, short of the 95% line. Luck could still explain the result ${at}.`;
  return `After allowing for ${tries(l.n_trials)}, the chance the true Sharpe is above zero is ${chance}. Luck explains this result as well as skill does ${at}.`;
}

/** One sentence on the p-values after correction. */
export function pSentence(h: Holdup): string {
  const p = h.p_values;
  if (p.raw == null) return "Too few days to test whether the Sharpe is above zero.";
  const sig = p.significant.bonferroni;
  if (p.n_trials <= 1) return `The chance of a Sharpe this high from a strategy with no edge is ${pText(p.raw)}.${p.raw < 0.05 ? " That is below the usual 0.05 line." : " That is above the usual 0.05 line."}`;
  return `On its own the chance of a Sharpe this high with no edge is ${pText(p.raw)}. Corrected for ${tries(p.n_trials)} it is ${pText(p.bonferroni)}${sig ? ", still below the 0.05 line." : ", above the 0.05 line."}`;
}

/** One sentence on the bootstrap ranges. */
export function rangeSentence(h: Holdup): string {
  const b = h.bootstrap;
  if (!b) return "The record is too short to resample: it needs at least 42 days.";
  const s = b.sharpe.ci95, c = b.cagr.ci95;
  if (!s || !c) return "The resampled ranges could not be measured.";
  const zero = s[0] != null && s[0] > 0 ? " The whole range is above zero." : " The range reaches zero or below, so a Sharpe of zero is not ruled out.";
  return `Reshuffling the record in one-month blocks ${int(b.n)} times, the Sharpe lands between ${dec(s[0])} and ${dec(s[1])} 95 times in 100, and the yearly return between ${pct(c[0])} and ${pct(c[1])}.${zero}`;
}

/** One sentence on correlation with stocks and bonds. */
export function corrSentence(h: Holdup): string {
  const c = h.rolling_correlation;
  if (!c) return "No stock or bond series was loaded, so correlation was not measured.";
  const part = (k: "stocks" | "bonds", name: string) => {
    const full = c.full_period[k];
    if (full == null) return null;
    const word = Math.abs(full) < 0.2 ? "barely moves with" : full > 0 ? (full > 0.6 ? "moves closely with" : "partly moves with") : full < -0.6 ? "moves strongly against" : "partly moves against";
    return `It ${word} ${name} (${dec(full)} over the whole record, ${dec(c.latest[k])} over the last year).`;
  };
  return [part("stocks", "stocks"), part("bonds", "bonds")].filter(Boolean).join(" ") || "Too few shared days to measure correlation.";
}

/** Wins and losses across every split that has a benchmark. */
export function regimeTally(h: Holdup): { won: number; lost: number; total: number } {
  let won = 0, lost = 0;
  for (const f of h.regimes) for (const it of f.items) { if (it.wins === true) won++; else if (it.wins === false) lost++; }
  return { won, lost, total: won + lost };
}

export function regimeSentence(h: Holdup): string {
  const t = regimeTally(h);
  if (!t.total) return "There is no benchmark to compare against, so each period shows the strategy's own return.";
  const items = h.regimes.flatMap((f) => f.items).filter((i) => i.wins != null);
  const best = items.filter((i) => i.wins).map((i) => i.label);
  const worst = items.filter((i) => !i.wins).map((i) => i.label);
  const wins = best.length ? ` It did better in ${listText(best.slice(0, 3))}.` : "";
  const loses = worst.length ? ` It did worse in ${listText(worst.slice(0, 3))}.` : "";
  return `It beat the benchmark in ${t.won} of ${t.total} periods.${wins}${loses}`;
}

export function listText(xs: string[]): string {
  const l = xs.map((x) => (/^\d/.test(x) ? `the ${x}` : x.charAt(0).toLowerCase() + x.slice(1)));
  return l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`;
}

/** The sentence for one "has to stay true" item. */
export function mustText(m: HoldupMust): string {
  const v = m.values;
  switch (m.key) {
    case "costs_below_breakeven":
      return `Costs stay under break-even. The edge is gone at ${dec(v.breakeven_bps, 1)} basis points a trade, and the backtest assumed ${dec(v.assumed_bps, 1)}.`;
    case "correlation_to_stocks_persists":
      return `Its link to stocks stays near ${dec(v.full_period)}. Over one-year windows it has ranged from ${dec(v.min)} to ${dec(v.max)}.`;
    case "correlation_to_bonds_persists":
      return `Its link to bonds stays near ${dec(v.full_period)}. Over one-year windows it has ranged from ${dec(v.min)} to ${dec(v.max)}.`;
    case "not_reliant_on_crises":
      return `Not mostly from crises: crisis days are ${pct(v.crisis_day_share, 0)} of the record and gave ${pct(v.crisis_return_share, 0)} of the growth.`;
    case "not_one_lucky_year":
      return `More than one good year: without its best year (${v.best_year}, ${pct(v.best_year_return, 0)}) the Sharpe is ${dec(v.sharpe_without)}.`;
    case "enough_history":
      return v.years_needed == null
        ? `Long enough to judge: at this Sharpe no length of record would pass the luck check at ${tries(v.n_trials ?? 1)}.`
        : `Long enough to judge: it has ${dec(v.years, 1)} years and needs ${dec(v.years_needed, 1)} at ${tries(v.n_trials ?? 1)}.`;
    case "survives_trial_count":
      return `Survives the number of things tried: the luck check gives ${pct(v.probability, 0)} at ${tries(v.n_trials ?? 1)}, against the 95% line.`;
    default:
      return String(m.key).replace(/_/g, " ");
  }
}

/** The verdict card's line: how many of the tested conditions hold. */
export function verdictLine(h: Holdup): { tone: "good" | "bad" | "warning"; title: string; text: string } {
  const tested = h.must_be_true.filter((m) => m.holds != null);
  const held = tested.filter((m) => m.holds).length;
  const t = regimeTally(h);
  const regimes = t.total ? ` It beat the benchmark in ${t.won} of ${t.total} periods.` : "";
  const luck = h.luck.verdict === "unlikely_luck" ? "Luck is an unlikely explanation." : h.luck.verdict === "borderline" ? "Luck could still explain it." : h.luck.verdict === "could_be_luck" ? "Luck explains it as well as skill." : "Too short to rule out luck.";
  const tone = h.luck.verdict === "unlikely_luck" && held === tested.length ? "good" : h.luck.verdict === "could_be_luck" || held < tested.length / 2 ? "bad" : "warning";
  return { tone, title: tested.length ? `${held} of ${tested.length} checks hold` : "Not enough data to check", text: `${luck}${regimes}` };
}
