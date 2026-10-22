// Number formatting for the terminal: tabular, a true minus sign, and changes shown as
// percent for prices and as differences in the series' own units for levels.
import type { TermSeries, Win } from "./data";

export const MINUS = "−";
const sign = (v: number) => (v > 0 ? "+" : v < 0 ? MINUS : "");

export function fmtLast(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = a >= 10000 ? a.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : a >= 1000 ? a.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : a >= 100 ? a.toFixed(2)
    : a >= 1 ? a.toFixed(3)
    : a === 0 ? "0" : a.toPrecision(4);
  return (v < 0 ? MINUS : "") + s;
}

/** A change: percent for a price series, a difference for a level series. */
export function fmtChg(v: number | null | undefined, kind: TermSeries["kind"], digits?: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const d = kind === "price" ? digits ?? 2 : digits ?? (a >= 1000 ? 0 : a >= 10 ? 1 : 2);
  const txt = a.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  // No sign on a change that rounds to zero.
  const sg = Number(a.toFixed(d)) === 0 ? "" : sign(v);
  return kind === "price" ? `${sg}${txt}%` : `${sg}${txt}`;
}

export function fmtNum(v: number | null | undefined, digits = 2, signed = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const txt = Math.abs(v).toFixed(digits);
  if (Number(txt) === 0) return txt;
  return `${signed ? sign(v) : v < 0 ? MINUS : ""}${txt}`;
}

export const fmtPct = (v: number | null | undefined, digits = 1, signed = false) =>
  v == null || !Number.isFinite(v) ? "—" : `${fmtNum(v * 100, digits, signed)}%`;

export const tone = (v: number | null | undefined) => (v == null || !Number.isFinite(v) || v === 0 ? "" : v > 0 ? "up" : "down");

export const WIN_LABEL: Record<Win, string> = { d1: "1D", w1: "1W", m1: "1M", ytd: "YTD" };
const WIN_DAYS: Record<Exclude<Win, "ytd">, number> = { d1: 1, w1: 5, m1: 21 };

function ytdDays(asof: string): number {
  const t = Date.parse(asof);
  const y0 = Date.parse(`${asof.slice(0, 4)}-01-01`);
  return Math.max(1, ((t - y0) / 86_400_000) * (252 / 365));
}

/**
 * A move as a rough z-score: the change divided by the typical change over that window.
 * The typical weekly change comes from the yearly volatility (prices) or from the index's
 * own 1-week z (any series); longer windows scale it by the square root of time.
 */
export function normMove(s: TermSeries, win: Win): number | null {
  const c = s.chg?.[win];
  if (c == null) return null;
  if (win === "w1" && s.z != null) return s.z;
  let weekly: number | null = null;
  if (s.kind === "price" && s.vol) weekly = s.vol / Math.sqrt(52);
  else if (s.z && s.chg?.w1) weekly = Math.abs(s.chg.w1 / s.z);
  if (!weekly) return null;
  const days = win === "ytd" ? ytdDays(s.asof) : WIN_DAYS[win];
  return c / (weekly * Math.sqrt(days / 5));
}

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(Date.parse(iso.slice(0, 10))).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
