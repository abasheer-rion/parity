// Short insight lines for the two home pages, each computed from the data on screen:
// the selected research run, the strategy search's file and the official record.
// Nothing here is written by a model or guessed. If the data for a line is missing,
// the line is left out rather than filled with a placeholder (DEC-0020).
import type { SearchDoc } from "./data";
import { pct, signedPct } from "./format";
import { nameOf } from "./strategyMeta";
import type { LedgerEntry, Report, StrategyRun } from "./types";

export interface Insight {
  /** A few words that say what the line is about. */
  lead: string;
  /** The finding, in plain words, with its numbers. */
  text: string;
  href?: string;
}

const tested = (report: Report) => report.runs.filter((r) => !r.is_benchmark && r.gauntlet);
const lastYear = (r: StrategyRun) => Object.keys(r.yearly).sort().slice(-1)[0];
const two = (v: number) => v.toFixed(2);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export function productInsights(report: Report): Insight[] {
  const out: Insight[] = [];
  const runs = tested(report);
  const bench = report.runs.find((r) => r.is_benchmark);
  const link = (r: StrategyRun) => `#/strategy/${r.strategy}`;

  const bySharpe = runs.filter((r) => r.metrics.sharpe != null).sort((a, b) => b.metrics.sharpe! - a.metrics.sharpe!);
  const best = bySharpe[0];
  if (best) {
    const vs = bench?.metrics.sharpe != null ? `, against ${two(bench.metrics.sharpe)} for the US market` : "";
    out.push({ lead: "Best return for the risk", text: `${nameOf(best)}, with a Sharpe ratio of ${two(best.metrics.sharpe!)}${vs}.`, href: link(best) });
  }

  const year = bench ? lastYear(bench) : undefined;
  if (bench && year && bench.yearly[year] != null) {
    const withYear = runs.filter((r) => r.yearly[year] != null);
    const ahead = withYear.filter((r) => r.yearly[year] > bench.yearly[year]).length;
    if (withYear.length) out.push({ lead: `${year} so far`, text: `${ahead} of ${withYear.length} strategies are ahead of the US market, which is ${signedPct(bench.yearly[year])}.`, href: "#/compare" });
  }

  const steady = runs.filter((r) => (r.metrics.cagr ?? 0) > 0 && r.metrics.max_drawdown != null)
    .sort((a, b) => b.metrics.max_drawdown! - a.metrics.max_drawdown!)[0];
  if (steady) out.push({ lead: "Smallest worst fall", text: `${nameOf(steady)} lost at most ${pct(Math.abs(steady.metrics.max_drawdown!))} from a peak, while still growing ${pct(steady.metrics.cagr)} a year.`, href: link(steady) });

  const most = [...runs].sort((a, b) => b.gauntlet!.passed - a.gauntlet!.passed)[0];
  if (most) out.push({ lead: "Most tests passed", text: `${nameOf(most)}, ${most.gauntlet!.passed} of ${most.gauntlet!.total}.`, href: link(most) });

  return out;
}

export function researchInsights(report: Report, search: SearchDoc | null, ledger: LedgerEntry[]): Insight[] {
  const out: Insight[] = [];
  const runs = tested(report);

  if (search) {
    const passed = search.passed_luck_check;
    out.push({
      lead: "The search",
      text: `${plural(search.trials, "variation")} tried. ${passed === 0 ? "None" : passed.toLocaleString("en-US")} passed the luck check, though ${search.beat_market.toLocaleString("en-US")} had a higher Sharpe ratio than the market.`,
      href: "#/search",
    });
    const fam = Object.entries(search.by_family).sort((a, b) => b[1] - a[1])[0];
    if (fam && search.trials > 0) out.push({ lead: "Where it looked", text: `${Math.round((fam[1] / search.trials) * 100)}% of its tries were ${fam[0]} ideas (${fam[1].toLocaleString("en-US")} of ${search.trials.toLocaleString("en-US")}).`, href: "#/search" });
  }

  const fails = new Map<string, number>();
  for (const r of runs) for (const t of r.gauntlet!.tests) if (t.passed === false) fails.set(t.name, (fails.get(t.name) ?? 0) + 1);
  const hardest = [...fails.entries()].sort((a, b) => b[1] - a[1])[0];
  if (hardest && runs.length) out.push({ lead: "The hardest test", text: `"${hardest[0]}" failed for ${hardest[1]} of ${runs.length} strategies.`, href: "#/doc/REF-0006" });

  const closest = [...runs].sort((a, b) => (b.gauntlet!.passed - a.gauntlet!.passed) || ((b.metrics.deflated_sharpe ?? 0) - (a.metrics.deflated_sharpe ?? 0)))[0];
  if (closest) out.push({ lead: "Closest to an answer", text: `${nameOf(closest)}, ${closest.gauntlet!.passed} of ${closest.gauntlet!.total} tests.`, href: `/app/#/strategy/${closest.strategy}` });

  const newest = ledger[ledger.length - 1];
  if (newest) out.push({ lead: "On the record", text: `${plural(ledger.length, "official run")} sealed. The newest, ${newest.run_id}, counted ${plural(newest.trials_counted, "trial")}.`, href: "#/ledger" });

  return out;
}
