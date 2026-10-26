// Turning a record into dated returns: trades plus a starting balance become daily
// returns, and an equity curve becomes returns with deposits and withdrawals taken out.
import { day } from "./csv";
import type { EquityPoint, Trade } from "./types";

export interface ReturnSeries {
  dates: string[];
  returns: number[];
  /** Account value at the end of each period; equity0 is the value before the first. */
  equity: number[];
  equity0: number;
  /** Profit or loss per period in money, when built from trades. */
  pnl?: number[];
  periodsPerYear: number;
  warnings: string[];
}

const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Calendar days between two "YYYY-MM-DD" dates. */
export const daysBetween = (a: string, b: string) => Math.round((toMs(b.slice(0, 10)) - toMs(a.slice(0, 10))) / DAY_MS);

/** How many returns a year this series has, from its own dates. */
export function periodsPerYear(dates: string[]): number {
  if (dates.length < 2) return 252;
  const years = daysBetween(dates[0], dates[dates.length - 1]) / 365.25;
  return years > 0 ? Math.max(1, Math.round((dates.length - 1) / years)) : 252;
}

/**
 * Daily returns from closed trades and a starting balance. Every weekday from the first
 * to the last close is a day (weekends too when a trade closed on one), so quiet days
 * count as zero. A day's return is its profit over the account value the evening before.
 */
export function fromTrades(trades: Trade[], balance: number): ReturnSeries {
  const warnings: string[] = [];
  const byDay = new Map<string, number>();
  for (const t of trades) byDay.set(day(t.closeTime), (byDay.get(day(t.closeTime)) ?? 0) + t.pnl);
  const keys = [...byDay.keys()].sort();
  const dates: string[] = [], returns: number[] = [], equity: number[] = [], pnl: number[] = [];
  if (!keys.length) return { dates, returns, equity, equity0: balance, pnl, periodsPerYear: 252, warnings };
  let e = balance;
  for (let ms = toMs(keys[0]); ms <= toMs(keys[keys.length - 1]); ms += DAY_MS) {
    const d = fromMs(ms);
    const dow = new Date(ms).getUTCDay();
    const p = byDay.get(d);
    if (p == null && (dow === 0 || dow === 6)) continue;
    if (e <= 0) { warnings.push(`The account value reached zero on ${dates[dates.length - 1]}, so later days are left out of the returns.`); break; }
    const v = p ?? 0;
    dates.push(d); returns.push(v / e); pnl.push(v);
    e += v; equity.push(e);
  }
  return { dates, returns, equity, equity0: balance, pnl, periodsPerYear: periodsPerYear(dates), warnings };
}

/**
 * Returns from an equity curve. With account values, a period's return is
 * (value - money paid in that period) / previous value - 1, so deposits are not profit.
 * With a return column, the returns are used as they are and the curve starts at 1.
 */
export function fromEquity(points: EquityPoint[]): ReturnSeries {
  const warnings: string[] = [];
  const dates: string[] = [], returns: number[] = [], equity: number[] = [];
  if (!points.length) return { dates, returns, equity, equity0: 1, periodsPerYear: 252, warnings };
  const useValues = points.filter((p) => p.equity != null).length >= points.length * 0.9;
  let prev = useValues ? points[0].equity ?? 1 : points[0].equity ?? 1;
  const equity0 = prev;
  const start = useValues ? 1 : points[0].ret == null ? 1 : 0;
  for (let i = start; i < points.length; i++) {
    const p = points[i];
    let r: number | null = null;
    if (useValues && p.equity != null && prev > 0) r = (p.equity - (p.cashflow ?? 0)) / prev - 1;
    else if (!useValues && p.ret != null) r = p.ret;
    if (r == null || !Number.isFinite(r)) continue;
    const e = useValues && p.equity != null ? p.equity : prev * (1 + r);
    dates.push(p.date); returns.push(r); equity.push(e);
    prev = e;
    if (e <= 0) { warnings.push(`The account value reached zero on ${p.date}; later values are left out.`); break; }
  }
  return { dates, returns, equity, equity0, periodsPerYear: periodsPerYear([points[0].date, ...dates]), warnings };
}

/** Largest fall from a high, as a positive fraction, and the longest stretch below a high in calendar days. */
export function drawdowns(equity0: number, equity: number[], dates: string[]): { maxDrawdown: number; longestDays: number } {
  let peak = equity0, peakDate = dates[0] ?? "", maxDd = 0, longest = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] >= peak) { peak = equity[i]; peakDate = dates[i]; continue; }
    maxDd = Math.max(maxDd, 1 - equity[i] / peak);
    longest = Math.max(longest, daysBetween(peakDate, dates[i]));
  }
  return { maxDrawdown: maxDd, longestDays: longest };
}

/** Compounded return of each calendar month, oldest first. */
export function monthlyReturns(dates: string[], returns: number[]): { month: string; ret: number }[] {
  const out: { month: string; ret: number }[] = [];
  for (let i = 0; i < returns.length; i++) {
    const m = dates[i].slice(0, 7);
    if (!out.length || out[out.length - 1].month !== m) out.push({ month: m, ret: 0 });
    const last = out[out.length - 1];
    last.ret = (1 + last.ret) * (1 + returns[i]) - 1;
  }
  return out;
}
