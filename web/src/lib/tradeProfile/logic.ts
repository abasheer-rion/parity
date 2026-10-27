// The pure parts of the trade profile: the month calendar of daily P&L, streaks, the
// ranking of closed trades, the leaderboard's region filter, initials and handle rules.
// No data access here, so every rule is tested in tests/tradeProfile.test.ts.
//
// The daily P&L rule is the database's (supabase/migrations/20261112000000_trade_profile.sql):
// a day's P&L is the sum of realized_pnl of the demo fills dated that day (bar_date). Only
// sells carry realized_pnl, and it is already net of both fees: the buy fee sits in the
// cost basis and the sell fee is taken off (applyFill in lib/paper/matching.ts). So no fee
// is subtracted again here.
import { regionOf, type Region } from "./countries";

/** A demo fill as it comes from paper_fills (numbers may arrive as strings). */
export interface FillLike {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number | string;
  price: number | string;
  fee: number | string;
  bar_date: string;
  realized_pnl: number | string | null;
}

export interface ClosedTrade {
  id: string;
  account_id: string;
  symbol: string;
  market: string;
  date: string;
  qty: number;
  price: number;
  fee: number;
  /** Realized P&L in dollars, after both fees. */
  pnl: number;
  /** P&L over the cost of what was sold, or null when that cost is not positive. */
  ret: number | null;
}

const num = (v: number | string | null | undefined): number => (typeof v === "number" ? v : Number(v));

/**
 * The return of one closed trade: realized P&L over the cost basis of the part sold.
 *
 *   cost basis = qty * price - fee - realized_pnl
 *   return     = realized_pnl / cost basis
 *
 * Why: applyFill (lib/paper/matching.ts) books a sell as
 *   realized_pnl = qty * (price - avg_cost) - fee
 * so qty * avg_cost = qty * price - fee - realized_pnl. avg_cost already holds the buy
 * fees, so the return is net of both fees, from the fill alone.
 */
export function tradeReturn(qty: number, price: number, fee: number, pnl: number): number | null {
  const basis = qty * price - fee - pnl;
  return basis > 1e-9 && Number.isFinite(basis) ? pnl / basis : null;
}

/** The market a symbol belongs to, from its series key prefix (eq.US_MKT is equities). */
export const MARKETS: Record<string, string> = {
  eq: "Indices and US equities", fx: "Currencies (FX)", crypto: "Crypto", cmd: "Commodities", rates: "Rates and yields", rate: "Rates and yields",
};
export function marketOf(symbol: string): string {
  const prefix = symbol.includes(".") ? symbol.slice(0, symbol.indexOf(".")) : "";
  return MARKETS[prefix] ?? "Other";
}

/** Closed trades (fills with a realized P&L), newest first. */
export function closedTrades(fills: FillLike[]): ClosedTrade[] {
  const out: ClosedTrade[] = [];
  for (const f of fills) {
    if (f.realized_pnl == null) continue;
    const pnl = num(f.realized_pnl);
    if (!Number.isFinite(pnl)) continue;
    const qty = num(f.qty), price = num(f.price), fee = num(f.fee);
    out.push({ id: f.id, account_id: f.account_id, symbol: f.symbol, market: marketOf(f.symbol), date: f.bar_date.slice(0, 10), qty, price, fee, pnl, ret: tradeReturn(qty, price, fee, pnl) });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export interface Day { pnl: number; trades: number }

/** P&L and trade count per day (YYYY-MM-DD). */
export function dailyPnl(trades: ClosedTrade[]): Map<string, Day> {
  const out = new Map<string, Day>();
  for (const t of trades) {
    const d = out.get(t.date) ?? { pnl: 0, trades: 0 };
    d.pnl += t.pnl;
    d.trades += 1;
    out.set(t.date, d);
  }
  return out;
}

// ---------------------------------------------------------------- dates (UTC, no clock)

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
export function addDays(iso: string, n: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/** A month as "YYYY-MM". */
export type Month = string;
export const monthOf = (iso: string): Month => iso.slice(0, 7);
export function shiftMonth(m: Month, delta: number): Month {
  const [y, mo] = m.split("-").map(Number);
  const i = y * 12 + (mo - 1) + delta;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}
export function monthLabel(m: Month): string {
  return utc(`${m}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
export function dayLabel(iso: string): string {
  return utc(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------- the month calendar

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export interface DayCell { date: string; day: number; pnl: number; trades: number; heat: number }
export interface WeekRow { cells: (DayCell | null)[]; pnl: number; trades: number }
export interface MonthView {
  month: Month;
  weeks: WeekRow[];
  pnl: number;
  trades: number;
  winDays: number;
  lossDays: number;
  best: DayCell | null;
  worst: DayCell | null;
  /** The largest absolute day in the month; every cell's heat is scaled to it. */
  maxAbs: number;
}

/**
 * The month as weeks of Monday to Sunday. Days outside the month are null, and a week's
 * total counts only the days of this month shown in that row. `heat` is the day's
 * absolute P&L over the month's largest absolute day, 0 to 1.
 */
export function buildMonth(month: Month, daily: Map<string, Day>): MonthView {
  const first = utc(`${month}-01`);
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: DayCell[] = [];
  let maxAbs = 0;
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${pad(d)}`;
    const v = daily.get(date);
    const pnl = v?.pnl ?? 0;
    maxAbs = Math.max(maxAbs, Math.abs(pnl));
    cells.push({ date, day: d, pnl, trades: v?.trades ?? 0, heat: 0 });
  }
  for (const c of cells) c.heat = maxAbs > 0 ? Math.abs(c.pnl) / maxAbs : 0;
  const slots: (DayCell | null)[] = [...Array<null>(lead).fill(null), ...cells];
  while (slots.length % 7) slots.push(null);
  const weeks: WeekRow[] = [];
  for (let i = 0; i < slots.length; i += 7) {
    const row = slots.slice(i, i + 7);
    weeks.push({ cells: row, pnl: row.reduce((s, c) => s + (c?.pnl ?? 0), 0), trades: row.reduce((s, c) => s + (c?.trades ?? 0), 0) });
  }
  const traded = cells.filter((c) => c.trades > 0);
  const best = traded.reduce<DayCell | null>((b, c) => (b == null || c.pnl > b.pnl ? c : b), null);
  const worst = traded.reduce<DayCell | null>((w, c) => (w == null || c.pnl < w.pnl ? c : w), null);
  return {
    month, weeks, maxAbs,
    pnl: cells.reduce((s, c) => s + c.pnl, 0),
    trades: traded.reduce((s, c) => s + c.trades, 0),
    winDays: traded.filter((c) => c.pnl > 0).length,
    lossDays: traded.filter((c) => c.pnl < 0).length,
    best: best && best.pnl > 0 ? best : null,
    worst: worst && worst.pnl < 0 ? worst : null,
  };
}

export interface Streaks { current: { kind: "win" | "loss" | null; days: number }; longestWin: number; longestLoss: number }

/**
 * Win and loss streaks over the days that had closed trades, in date order. A win day has
 * P&L above zero and a loss day below; a day at exactly zero ends both. Days with no
 * closed trade are skipped, so a weekend does not break a streak.
 */
export function streaks(daily: Map<string, Day>): Streaks {
  const days = [...daily.entries()].filter(([, d]) => d.trades > 0).sort(([a], [b]) => (a < b ? -1 : 1));
  let longestWin = 0, longestLoss = 0, run = 0;
  let kind: "win" | "loss" | null = null;
  for (const [, d] of days) {
    const k = d.pnl > 0 ? "win" : d.pnl < 0 ? "loss" : null;
    run = k && k === kind ? run + 1 : k ? 1 : 0;
    kind = k;
    if (kind === "win") longestWin = Math.max(longestWin, run);
    if (kind === "loss") longestLoss = Math.max(longestLoss, run);
  }
  return { current: { kind, days: kind ? run : 0 }, longestWin, longestLoss };
}

// ---------------------------------------------------------------- ranked trades

export type TradePeriod = "week" | "month" | "year" | "all";
const PERIOD_DAYS: Record<Exclude<TradePeriod, "all">, number> = { week: 7, month: 30, year: 365 };

/** True when the date falls in the period ending today: after today minus 7, 30 or 365 days, as the database counts weeks and months. */
export function inPeriod(date: string, period: TradePeriod, today: string): boolean {
  return period === "all" || date > addDays(today, -PERIOD_DAYS[period]);
}

export type RankBy = "pnl" | "ret";

/** Rank of each trade, 1 = best by P&L or by return. Trades with no return rank last. Ties share a rank. */
export function rankTrades(trades: ClosedTrade[], by: RankBy): Map<string, number> {
  const val = (t: ClosedTrade) => (by === "pnl" ? t.pnl : t.ret);
  const sorted = [...trades].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    return y - x;
  });
  const out = new Map<string, number>();
  sorted.forEach((t, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    out.set(t.id, prev && val(prev) === val(t) ? out.get(prev.id)! : i + 1);
  });
  return out;
}

// ---------------------------------------------------------------- the leaderboard

export type BoardPeriod = "week" | "month" | "all";

export interface BoardRow {
  period: BoardPeriod;
  rank: number;
  handle: string;
  display_name: string | null;
  initials: string;
  country: string | null;
  region: string | null;
  trades: number;
  active_days: number;
  total_return: number;
  risk_adjusted: number | null;
  win_rate: number | null;
  max_drawdown: number | null;
  min_trades: number;
  is_you: boolean;
}

/**
 * The board for one region, ranked again inside it the way the database ranks the whole
 * board: by return per unit of risk, then by trades, highest first, with ties sharing a
 * rank (SQL rank()). "all" keeps every row and its database rank.
 */
export function boardFor(rows: BoardRow[], region: Region | "all"): BoardRow[] {
  if (region === "all") return [...rows].sort((a, b) => a.rank - b.rank);
  const inRegion = rows.filter((r) => (r.region ?? regionOf(r.country)) === region);
  const key = (r: BoardRow): [number, number] => [r.risk_adjusted ?? -Infinity, r.trades];
  const sorted = [...inRegion].sort((a, b) => {
    const [ax, at] = key(a), [bx, bt] = key(b);
    return bx - ax || bt - at;
  });
  return sorted.map((r, i) => {
    let rank = i + 1;
    for (let j = i - 1; j >= 0; j--) {
      const [px, pt] = key(sorted[j]), [x, t] = key(r);
      if (px === x && pt === t) rank = j + 1; else break;
    }
    return { ...r, rank };
  });
}

/** Two upper-case letters for the avatar: from the display name if set, else the handle. */
export function initials(displayName: string | null | undefined, handle: string | null | undefined): string {
  const src = (displayName?.trim() || handle?.trim() || "").replace(/[^\p{L}\p{N}\s_]/gu, "");
  const words = src.split(/[\s_]+/).filter(Boolean);
  const out = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return (out || "?").toUpperCase();
}

export const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;
/** Why a handle cannot be used, or null when it can. */
export function handleError(handle: string): string | null {
  const h = handle.trim();
  if (!h) return "Choose a handle to join the leaderboard.";
  if (h.length < 3) return "Use at least 3 characters.";
  if (h.length > 20) return "Use 20 characters or fewer.";
  if (!HANDLE_RE.test(h)) return "Use only letters, digits and underscores.";
  return null;
}

export type Luck = "few" | "luck" | "less-likely";
export const LUCK_TEXT: Record<Luck, string> = { few: "Too few trades", luck: "Could be luck", "less-likely": "Less likely to be luck alone" };
/**
 * The luck check. The score is how far average daily P&L sits above zero in units of its
 * own noise (a t-statistic): below the trade minimum, or with no score, there is too
 * little to say; under 2 it could be luck; at 2 or more it is less likely to be luck alone.
 */
export function luck(trades: number, minTrades: number, score: number | null): Luck {
  if (trades < minTrades || score == null) return "few";
  return score >= 2 ? "less-likely" : "luck";
}

// ---------------------------------------------------------------- number text

/** Dollars with a sign and cents: +$1,234.50, -$80.00, $0.00. */
export function usd(v: number): string {
  const s = `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return v > 0.004 ? `+${s}` : v < -0.004 ? `-${s}` : s;
}
/** Short signed dollars for a calendar cell: +$1.2k, -$350, $0. */
export function usdShort(v: number): string {
  const a = Math.abs(v);
  const body = a >= 1e6 ? `${(a / 1e6).toFixed(1)}m` : a >= 1e4 ? `${Math.round(a / 1e3)}k` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}k` : `${Math.round(a)}`;
  const s = `$${body.replace(/\.0(?=[km])/, "")}`;
  return Math.round(a) === 0 && a < 0.5 ? "$0" : v > 0 ? `+${s}` : `-${s}`;
}
/** A fraction as a signed percent: +4.2%, -1.0%. */
export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const s = `${Math.abs(v * 100).toFixed(digits)}%`;
  return v > 0 ? `+${s}` : v < 0 ? `-${s}` : s;
}
/** A fraction as a plain percent, no sign: 62%. */
export function share(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "n/a" : `${Math.round(v * 100)}%`;
}
