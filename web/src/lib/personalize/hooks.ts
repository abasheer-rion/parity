// The one line under a What's new title (DEC-0068). A hook is a true statement built from the
// candidate's own numbers, the ones the linked page shows. When the numbers do not support a
// hook, the plain description is used instead. Hooks describe a past test result; none says
// or suggests that anyone should put money into a strategy (REF-0017, DEC-0015).
import type { Candidate } from "./candidates";

const pct1 = (x: number) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
const pct0 = (x: number) => `${Math.round(x * 100)}%`;

/** The hook line, or null when the facts do not support one. */
export function hookFor(c: Candidate): string | null {
  const f = c.facts;
  if (c.kind === "algo") {
    // Bots: win rate against the money result is the most surprising true pair.
    if (f.winRate != null && f.pnl != null && (f.trades ?? 0) >= 10) {
      if (f.winRate >= 0.6 && f.pnl < 0) return `This bot won ${pct1(f.winRate)} of trades and still lost money.`;
      if (f.winRate <= 0.4 && f.pnl > 0) return `This bot lost ${pct1(1 - f.winRate)} of trades and still made money.`;
    }
    if (f.blown && f.runLabel) return `This bot lost its account in the ${f.runLabel} run.`;
    if ((f.marginCalls ?? 0) > 0) return `This bot hit ${f.marginCalls} margin call${f.marginCalls === 1 ? "" : "s"}.`;
    // Tested strategies.
    if (f.cagr != null && f.cagr > 0 && f.beatsMarket === false) return `Made ${pct1(f.cagr)} a year and did not beat holding the US stock market.`;
    if (f.maxDrawdown != null && f.maxDrawdown <= -0.4) return `Fell ${pct0(-f.maxDrawdown)} from its peak at its worst.`;
    if (f.passed != null && f.total) return `Passed ${f.passed} of ${f.total} tests.`;
    return null;
  }
  if (c.kind === "lesson" && f.lessons) {
    return `${f.lessons} lesson${f.lessons === 1 ? "" : "s"}${f.minutes ? `, about ${f.minutes} minutes` : ""}.`;
  }
  return null;
}

/** What the card shows under the title: the hook, or the description when there is none. */
export function lineFor(c: Candidate, withHook = true): string {
  return (withHook ? hookFor(c) : null) ?? c.description;
}
