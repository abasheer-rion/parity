// Two reports side by side (DEC-0089), such as two bots someone is choosing between. The same
// numbers for each, in the same words, and the checks each passed or failed. It never says
// which to choose: Parity does not rank records by return (DEC-0079). Pure functions.
import { survivesText } from "../checks/verdict";
import type { ReportData } from "./model";
import { count } from "../words";

export interface CompareRow {
  /** An explanation id (explain.ts) for the numbers, or null for words. */
  id: string | null;
  label: string;
  a: string;
  b: string;
  /** Which side is worse on a line about risk or luck (a deeper fall, more failed checks), for colour only. Never set for returns. */
  worse?: "a" | "b" | null;
}

const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "n/a" : `${(v * 100).toFixed(d)}%`);
const dec = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "n/a" : v.toFixed(d));
const int = (v: number | null | undefined) => (v == null ? "n/a" : v.toLocaleString("en-US"));
const money = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "n/a" : `${v < 0 ? "-" : ""}${Math.abs(v) >= 1000 ? Math.round(Math.abs(v)).toLocaleString("en-US") : Math.abs(v).toFixed(2)}`);
const lower = (x: number | null | undefined, y: number | null | undefined): "a" | "b" | null => (x == null || y == null || x === y ? null : x < y ? "a" : "b");

function failed(d: ReportData): string[] {
  return [...d.c4, ...d.c5].filter((c) => c.status === "fail").map((c) => c.label);
}

export function compareRows(a: ReportData, b: ReportData): CompareRow[] {
  const rows: CompareRow[] = [];
  const add = (id: string | null, label: string, fa: (d: ReportData) => string, worse?: CompareRow["worse"]) => rows.push({ id, label, a: fa(a), b: fa(b), worse: worse ?? null });
  add(null, "Verdict", (d) => d.verdict.label);
  add("survives", "Luck check", (d) => (d.c3 ? survivesText(d.c3.survives) : "Not measured"), lower(a.c3?.survives ?? null, b.c3?.survives ?? null));
  add("dsr", "Luck check at the tries counted", (d) => (d.c3?.dsr == null ? "n/a" : `${d.c3.dsr.toFixed(3)} at ${int(d.c3.tries)} ${d.c3.tries === 1 ? "try" : "tries"}`), lower(a.c3?.dsr, b.c3?.dsr));
  add("tries", "Tries counted", (d) => int(d.tries));
  add("trades", "Trades", (d) => int(d.trades));
  add("dates", "Dates", (d) => (d.dateFrom && d.dateTo ? `${d.dateFrom.slice(0, 10)} to ${d.dateTo.slice(0, 10)}` : "n/a"));
  add("expectancy", "Profit per trade (or period)", (d) => (!d.c1 ? "n/a" : d.c1.basis === "trade" ? money(d.c1.expectancy) : `${pct(d.c1.expectancy, 2)} a period`));
  add("winRate", "Win rate", (d) => (d.c1 ? pct(d.c1.winRate) : "n/a"));
  add("profitFactor", "Profit factor", (d) => dec(d.c1?.profitFactor));
  add("totalReturn", "Total return", (d) => (d.facts?.totalReturn == null ? "n/a" : `${d.facts.totalReturn >= 0 ? "+" : ""}${pct(d.facts.totalReturn)}`));
  add("maxDrawdown", "Largest fall from a high", (d) => (d.c2?.maxDrawdown == null ? "n/a" : pct(-d.c2.maxDrawdown)), lower(b.c2?.maxDrawdown, a.c2?.maxDrawdown));
  add("underwater", "Longest time under water", (d) => (d.c2?.longestUnderwaterDays == null ? "n/a" : count(d.c2.longestUnderwaterDays, "day")), lower(b.c2?.longestUnderwaterDays, a.c2?.longestUnderwaterDays));
  add("winsWipedOut", "Wins wiped out by the worst loss", (d) => dec(d.c2?.winsWipedOut, 1), lower(b.c2?.winsWipedOut, a.c2?.winsWipedOut));
  add("sharpeAnnual", "Sharpe a year", (d) => dec(d.c3?.sharpeAnnual));
  add(null, "Checks failed", (d) => { const f = failed(d); return f.length ? `${f.length}: ${f.join(", ")}` : "None"; }, lower(failed(b).length, failed(a).length));
  add(null, "Could not be checked", (d) => (d.cannot.length ? `${d.cannot.length}: ${d.cannot.map((c) => c.check).join(", ")}` : "None"));
  add("method", "Method", (d) => d.method);
  return rows;
}

/** One plain sentence about the two verdicts, without choosing between them. */
export function compareSentence(a: ReportData, b: ReportData, names = ["A", "B"]): string {
  const one = (d: ReportData, n: string) => `${n}: ${d.verdict.label}${d.c3 ? `, luck check ${survivesText(d.c3.survives).toLowerCase()}` : ""}`;
  const same = a.verdict.id === b.verdict.id;
  const methods = a.method === b.method ? "" : ` They were checked by different method versions (${a.method} and ${b.method}).`;
  return `${one(a, names[0])}. ${one(b, names[1])}.${same ? " Both get the same verdict, so the numbers below are where they differ." : ""}${methods} Parity does not rank records or say which to choose.`;
}

/**
 * Both growth curves over the days they share, from the first shared day, so one picture can
 * hold both. The curves in a report are thinned, so B is read at its last point on or
 * before each of A's days. Null when they share fewer than 20 of A's points.
 */
export function overlap(a: ReportData, b: ReportData): { dates: string[]; a: number[]; b: number[] } | null {
  if (a.curve?.unit !== "growth" || b.curve?.unit !== "growth") return null;
  const bd = b.curve.dates.map((d) => d.slice(0, 10)), bv = b.curve.values;
  const start = bd[0], end = bd[bd.length - 1];
  const dates: string[] = [], va: number[] = [], vb: number[] = [];
  let j = 0;
  for (let i = 0; i < a.curve.dates.length; i++) {
    const d = a.curve.dates[i].slice(0, 10);
    if (d < start || d > end) continue;
    while (j + 1 < bd.length && bd[j + 1] <= d) j++;
    dates.push(d); va.push(a.curve.values[i]); vb.push(bv[j]);
  }
  if (dates.length < 20) return null;
  const a0 = va[0], b0 = vb[0];
  if (!(a0 > 0) || !(b0 > 0)) return null;
  return { dates, a: va.map((v) => Math.round((v / a0) * 1e4) / 1e4), b: vb.map((v) => Math.round((v / b0) * 1e4) / 1e4) };
}
