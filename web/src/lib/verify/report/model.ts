// The Verify report (DEC-0089): one page for every check, built from a Result into a small,
// versioned shape that is also what a shared link carries. The page, the shared link, the
// PDF and the image card all draw from this one shape, so they always agree. Pure functions, no React.
import { NA, survivesText, type ClaimRow, type ClaimSource, type CheckRow, type ExpectancyCard, type LuckCard, type RecordFacts, type Result, type TailCard, type Verdict } from "../checks";
import type { InputKind, Source } from "../types";
import type { Curve, Groups, Spread } from "./series";

export const REPORT_VERSION = 1;

export interface ReportData {
  v: typeof REPORT_VERSION;
  method: string;
  /** The day the check ran, YYYY-MM-DD. */
  checkedOn: string;
  source: Source;
  kind: InputKind;
  what: string;
  dateFrom: string | null;
  dateTo: string | null;
  trades: number | null;
  dailyReturns: number;
  tries: number;
  triesDefaulted: boolean;
  balance: number | null;
  verdict: Verdict;
  c1: ExpectancyCard | null;
  c2: TailCard | null;
  c3: LuckCard | null;
  c4: CheckRow[];
  c5: CheckRow[];
  arithmetic: ClaimRow[];
  facts: RecordFacts | null;
  curve: Curve | null;
  spread: Spread | null;
  groups: Groups | null;
  benchmark: string | null;
  claims: ClaimSource | null;
  inputs: { label: string; value: string }[];
  cannot: { check: string; why: string }[];
  notes: string[];
  gauntlet: { verdict: string; passed: number; total: number } | null;
  code: { market: string; marketName: string; cost: number; costWhy: string; totalReturn: number; delayedReturn: number; buyHoldReturn: number; triesStated: number; triesSweep: number; sweepRuns: number; sweepProfitable: number } | null;
  /** The words of a described bot, cut to 600 characters. */
  description: string | null;
  /** A batch screen's own verdict, when the report was opened from a batch row (DEC-0087). */
  screen: { verdict: string; reason: string; method: string; account: string } | null;
  /** "summary" for a published badge, which keeps the summary numbers and not the record. */
  kept: "full" | "summary";
}

export interface ReportExtra {
  /** "today" for the check's date; tests pass a fixed one. */
  checkedOn?: string;
  /** What the person's daily prices did, for the inputs list. */
  prices?: "loaded" | "signed_out" | "not_needed" | "missing";
  fileName?: string | null;
  screen?: ReportData["screen"];
  /** True on a published badge's page. */
  badge?: boolean;
}

const KIND_TEXT: Record<InputKind, string> = { real: "Real money, as you told us", demo: "Demo account, as you told us", backtest: "Backtest, as you told us" };
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const int = (v: number) => v.toLocaleString("en-US");

/** The checks this input could not run, and why, in words (shared with the API's could_not_check). */
export function cannotCheck(r: Pick<Result, "card1" | "card3" | "card4" | "card5">): { check: string; why: string }[] {
  const out: { check: string; why: string }[] = [];
  if (!r.card1) out.push({ check: "Profit per trade", why: "The record has no trades or returns to average." });
  if (!r.card3) out.push({ check: "Luck check", why: "It needs at least 30 returns, or a trade list." });
  for (const row of [...r.card4, ...r.card5]) {
    if (row.status === "na") out.push({ check: row.label, why: row.detail.replace(`${NA}: `, "").replace(/^./, (c) => c.toUpperCase()) });
  }
  return out;
}

/** The inputs a check used, in words, for the report's "What was checked" list. */
export function inputsOf(r: Result, x: ReportExtra = {}): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => { if (value) rows.push({ label, value }); };
  add("What", r.source === "file" ? `${r.what}${x.fileName ? `, read in your browser` : ""}` : r.source === "code" ? `${r.what}, run on our daily prices` : r.source === "strategy" ? `${r.what}, from our research` : "A seller's claim, not a record");
  if (r.source === "file") add("Money", KIND_TEXT[r.kind]);
  if (r.dateFrom && r.dateTo) add("Dates", `${r.dateFrom} to ${r.dateTo}`);
  if (r.trades != null) add("Trades", int(r.trades));
  if (r.source === "file" || r.source === "code") add("Starting balance", r.balance != null ? int(Math.round(r.balance)) : "Not given, so returns, the largest fall and the luck check on returns are left out");
  if (r.source !== "description") {
    add("Tries counted", r.code ? `${int(r.code.triesStated)} you stated, plus ${int(r.code.triesSweep)} nearby settings we ran: ${int(r.tries)}`
      : r.source === "strategy" ? `${int(r.tries)}, every try our research and search have counted`
      : `${int(r.tries)}${r.triesDefaulted ? ", left at 1: the most generous reading" : ""}`);
  }
  if (r.claimSource) add("Claims", `${r.claimSource.found.length} read from ${r.claimSource.url ? hostOf(r.claimSource.url) : "the words you pasted"}${r.claimSource.readAt ? ` on ${r.claimSource.readAt.slice(0, 10)}` : ""}`);
  const prices = x.prices === "loaded" ? "Our daily closes for currencies, Bitcoin, Ether and the S&P 500" : x.prices === "signed_out" ? "Not loaded: our daily prices load for signed-in accounts only" : null;
  add("Prices", prices);
  add("Compared with", r.benchmark ? `${r.benchmark}, daily` : r.source === "description" ? null : "No market series");
  add("Method", `${r.methodVersion}, checked on ${x.checkedOn ?? today()}`);
  add("Trust", r.source === "file" ? "Self-reported: Parity checked the numbers in the file, not where the file came from" : r.source === "code" ? "We ran the rules ourselves on our prices" : r.source === "strategy" ? "Our own research run" : "Words only: a claim is not a record");
  return rows;
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "the page"; }
}

const today = () => new Date().toISOString().slice(0, 10);

/** Gaps in the pictures, in words, so the report says why one is missing instead of leaving a hole. */
export function pictureGaps(d: Pick<ReportData, "curve" | "spread" | "groups" | "c3" | "source" | "benchmark" | "balance" | "trades" | "dailyReturns">, signedOut: boolean): Record<"curve" | "bench" | "spread" | "luck" | "groups" | "underwater", string | null> {
  const desc = d.source === "description";
  return {
    curve: d.curve ? null : desc ? "A claim has no record to draw." : "Too few results to draw.",
    bench: d.curve && !d.benchmark && d.source !== "strategy"
      ? (signedOut ? "Not compared with the S&P 500: our daily prices load for signed-in accounts only." : d.curve.unit === "money" ? "Not compared with the S&P 500: without a starting balance the record has no returns." : d.dailyReturns < 30 ? "Not compared with the S&P 500: it needs at least 30 daily returns." : "Not compared with a market: no daily prices for these dates.")
      : null,
    underwater: d.curve ? null : desc ? "A claim has no record to draw." : "Too few results to draw.",
    spread: d.spread ? null : desc ? "A claim has no results to reshuffle." : "It needs at least 10 trades, or 30 daily returns.",
    luck: d.c3?.moments ? null : desc ? "A claim has no returns." : "It needs at least 30 returns, or a trade list with 30 trades.",
    groups: d.groups ? null : desc ? "A claim has no record to split." : "There are too few results to split.",
  };
}

/** Builds the report from a check's result. */
export function reportFrom(r: Result, x: ReportExtra = {}): ReportData {
  const notes = [...r.notes];
  return {
    v: REPORT_VERSION, method: r.methodVersion, checkedOn: x.checkedOn ?? today(),
    source: r.source, kind: r.kind, what: r.what, dateFrom: r.dateFrom, dateTo: r.dateTo, trades: r.trades, dailyReturns: r.dailyReturns,
    tries: r.tries, triesDefaulted: r.triesDefaulted, balance: r.balance, verdict: r.verdict,
    c1: r.card1, c2: r.card2, c3: r.card3, c4: r.card4, c5: r.card5, arithmetic: r.claims,
    facts: r.facts ?? null, curve: r.curve ?? null, spread: r.spread ?? null, groups: r.groups ?? null, benchmark: r.benchmark ?? null,
    claims: r.claimSource ? { ...r.claimSource, found: r.claimSource.found.slice(0, 60) } : null,
    inputs: inputsOf(r, x), cannot: cannotCheck(r), notes,
    gauntlet: r.gauntlet ?? null,
    code: r.code ? {
      market: r.code.market, marketName: r.code.marketName, cost: r.code.cost, costWhy: r.code.costWhy, totalReturn: r.code.totalReturn,
      delayedReturn: r.code.delayedReturn, buyHoldReturn: r.code.buyHoldReturn, triesStated: r.code.triesStated, triesSweep: r.code.triesSweep,
      sweepRuns: r.code.sweep.runs, sweepProfitable: r.code.sweep.profitable,
    } : null,
    description: r.description?.text ? r.description.text.slice(0, 600) : null,
    screen: x.screen ?? null,
    kept: x.badge ? "summary" : "full",
  };
}

/** The numbers at the top of the report, each with an explanation id (explain.ts). */
export interface KeyNumber { id: string; label: string; value: string; tone?: "good" | "bad" | null }

export function keyNumbers(d: ReportData): KeyNumber[] {
  const out: KeyNumber[] = [];
  const money = (v: number) => `${v < 0 ? "-" : ""}${Math.abs(v) >= 1000 ? Math.round(Math.abs(v)).toLocaleString("en-US") : Math.abs(v).toFixed(2)}`;
  if (d.c3) out.push({ id: "survives", label: "Luck check", value: survivesText(d.c3.survives), tone: d.c3.dsr == null ? null : d.c3.dsr >= 0.95 ? "good" : "bad" });
  if (d.c1) {
    const per = d.c1.basis === "trade";
    out.push({ id: "expectancy", label: per ? "Profit per trade" : "Average per period", value: per ? money(d.c1.expectancy) : pct(d.c1.expectancy, 2), tone: d.c1.expectancy > 0 ? "good" : "bad" });
    out.push({ id: "winRate", label: per ? "Win rate" : "Up periods", value: pct(d.c1.winRate), tone: null });
  }
  if (d.facts?.totalReturn != null) out.push({ id: "totalReturn", label: "Total return", value: `${d.facts.totalReturn >= 0 ? "+" : ""}${pct(d.facts.totalReturn)}`, tone: d.facts.totalReturn >= 0 ? "good" : "bad" });
  if (d.c2?.maxDrawdown != null) out.push({ id: "maxDrawdown", label: "Largest fall", value: pct(-Math.abs(d.c2.maxDrawdown)), tone: d.c2.maxDrawdown > 0.5 ? "bad" : null });
  if (d.c3?.sharpeAnnual != null) out.push({ id: "sharpeAnnual", label: "Sharpe a year", value: d.c3.sharpeAnnual.toFixed(2), tone: null });
  else if (d.c3?.sharpe != null) out.push({ id: "sharpe", label: "Sharpe per trade", value: d.c3.sharpe.toFixed(3), tone: null });
  return out.slice(0, 6);
}

/** One plain sentence for a social card or a page title: the verdict and how many tries it survives. */
export function shareLine(d: ReportData): string {
  const s = d.c3 ? ` ${survivesText(d.c3.survives)}.` : "";
  return `${d.verdict.label}.${s} ${d.what}${d.trades != null ? `, ${int(d.trades)} trades` : ""}. Parity Verify, method ${d.method}.`;
}
