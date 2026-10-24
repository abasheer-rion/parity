// Performance numbers for the demo account and for strategy forward tests (DEC-0034).
// They use the engine's own definitions, so a number here means the same as on a
// strategy page: engine/src/parity/metrics/performance.py and docs/reference/0002-kpis.md.
//   Sharpe        mean of period returns / their sample standard deviation * sqrt(periods
//                 per year), zero risk-free rate (TRADING_DAYS = 252 for daily returns)
//   Max drawdown  the worst fall of cumulative equity from its running peak
//   Hit rate      the share of non-zero periods that were positive
// Win rate and profit factor are per closed trade (each sell), after fees.
import type { Point } from "../types";
import { barAtOrBefore } from "../bars";
import type { Bar } from "../indicators";
import { applyFill, emptyBook, type Book, type PaperFill } from "./matching";

export const TRADING_DAYS = 252;
export const WEEKS_PER_YEAR = 52;

/** Period returns from an equity curve: e[t] / e[t-1] - 1. */
export function returnsOf(equity: Point[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const a = equity[i - 1][1], b = equity[i][1];
    if (a > 0 && Number.isFinite(b)) out.push(b / a - 1);
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Sample standard deviation (n - 1), as pandas' Series.std uses. */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Annualised Sharpe with a zero risk-free rate; null when it is undefined. */
export function sharpe(returns: number[], periodsPerYear = TRADING_DAYS): number | null {
  const sd = stdev(returns);
  if (!(sd > 0)) return null;
  return (mean(returns) / sd) * Math.sqrt(periodsPerYear);
}

/** Worst peak-to-trough fall of cumulative equity, as a negative fraction (0 if none). */
export function maxDrawdown(returns: number[]): number | null {
  if (!returns.length) return null;
  let eq = 1, peak = 1, worst = 0;
  for (const r of returns) {
    eq *= 1 + r;
    peak = Math.max(peak, eq);
    worst = Math.min(worst, eq / peak - 1);
  }
  return worst;
}

/** Compound annual growth rate over the curve's own length in periods. */
export function cagr(returns: number[], periodsPerYear = TRADING_DAYS): number | null {
  if (!returns.length) return null;
  const growth = returns.reduce((g, r) => g * (1 + r), 1);
  const years = returns.length / periodsPerYear;
  return growth > 0 && years > 0 ? growth ** (1 / years) - 1 : null;
}

export function hitRate(returns: number[]): number | null {
  const traded = returns.filter((r) => r !== 0);
  return traded.length ? traded.filter((r) => r > 0).length / traded.length : null;
}

export function winRate(closed: number[]): number | null {
  return closed.length ? closed.filter((p) => p > 0).length / closed.length : null;
}

/** Gross profit over gross loss of closed trades; null with no losing trade. */
export function profitFactor(closed: number[]): number | null {
  const win = closed.filter((p) => p > 0).reduce((s, p) => s + p, 0);
  const loss = -closed.filter((p) => p < 0).reduce((s, p) => s + p, 0);
  return loss > 0 ? win / loss : null;
}

/** Periods per year for a curve, from the median gap between its dates: daily (252) or weekly (52). */
export function periodsPerYear(points: Point[]): number {
  if (points.length < 3) return TRADING_DAYS;
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) gaps.push((Date.parse(points[i][0]) - Date.parse(points[i - 1][0])) / 86_400_000);
  gaps.sort((a, b) => a - b);
  const mid = gaps[gaps.length >> 1];
  return mid >= 25 ? 12 : mid >= 5 ? WEEKS_PER_YEAR : TRADING_DAYS;
}

export interface Stats {
  total_return: number | null;
  cagr: number | null;
  sharpe: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  closed_trades: number;
  periods: number;
}

/** Every number the account page shows, from its equity curve and closed trades. */
export function statsFor(equity: Point[], closed: number[] = [], ppy = periodsPerYear(equity)): Stats {
  const r = returnsOf(equity);
  const first = equity[0]?.[1], last = equity[equity.length - 1]?.[1];
  return {
    total_return: first > 0 && last != null ? last / first - 1 : null,
    cagr: r.length >= ppy / 4 ? cagr(r, ppy) : null,
    sharpe: r.length >= 2 ? sharpe(r, ppy) : null,
    max_drawdown: maxDrawdown(r),
    win_rate: winRate(closed),
    profit_factor: profitFactor(closed),
    closed_trades: closed.length,
    periods: r.length,
  };
}

/**
 * The account's value each day from `start`: cash plus every holding at that day's
 * delayed close (the last close on or before the day). Fills are replayed in order, so
 * the curve and the account always agree. `dates` is the calendar to draw on.
 */
export function equityCurve(startingCash: number, fills: PaperFill[], bars: Record<string, Bar[]>, dates: string[]): Point[] {
  const sorted = [...fills].sort((a, b) => (a.bar_date < b.bar_date ? -1 : a.bar_date > b.bar_date ? 1 : 0));
  let book: Book = emptyBook(startingCash);
  let i = 0;
  const out: Point[] = [];
  for (const d of dates) {
    while (i < sorted.length && sorted[i].bar_date <= d) {
      // Sources publish on different days, so replaying by bar date can briefly run cash
      // below zero; these fills already happened, so nothing is refused here.
      const r = applyFill(book, sorted[i++], false);
      if ("book" in r) book = r.book;
    }
    let value = book.cash;
    for (const p of Object.values(book.positions)) {
      const b = bars[p.symbol];
      const k = b ? barAtOrBefore(b, d) : -1;
      value += p.qty * (k >= 0 ? b[k].close : p.avg_cost);
    }
    out.push([d, value]);
  }
  return out;
}

/** A strategy's curve from `from` onward, rescaled so it starts at `capital` on the last
 *  point on or before `from`. Empty when the curve has nothing after `from`. */
export function scaleFrom(curve: Point[], from: string, capital: number): Point[] {
  let base = -1;
  for (let i = 0; i < curve.length; i++) { if (curve[i][0] <= from) base = i; else break; }
  if (base < 0 || !(curve[base][1] > 0) || base === curve.length - 1) return [];
  const b = curve[base][1];
  return curve.slice(base).map(([d, v]) => [d, (v / b) * capital] as Point);
}

/** The part of a curve before `before`, rescaled to end at `capital`: the backtest's promise. */
export function scaleBefore(curve: Point[], before: string, capital: number): Point[] {
  const part = curve.filter(([d]) => d <= before);
  const end = part[part.length - 1]?.[1];
  if (!(end > 0)) return [];
  return part.map(([d, v]) => [d, (v / end) * capital] as Point);
}
