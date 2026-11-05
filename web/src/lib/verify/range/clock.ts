// Times for the fill price check: which clock a file uses, New York time for US stock
// sessions, and turning a wall time into UTC. Uses the platform's time zone data (Intl), which
// browsers, Node and Cloudflare all carry.
import type { Parsed } from "../types";
import { headerOffset } from "../csv";
import type { Clock } from "./types";

const NY = "America/New_York";
let fmt: Intl.DateTimeFormat | null = null;

/** Minutes New York is ahead of UTC at a moment: -300 in winter, -240 in summer. */
export function nyOffset(utcMs: number): number {
  fmt ??= new Intl.DateTimeFormat("en-US", { timeZone: NY, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((wall - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/** A wall time ("YYYY-MM-DDTHH:MM[:SS]") read as UTC, in ms; NaN when it cannot be read. */
export function wallMs(t: string): number {
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return Number.NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
}

/** UTC ms of a New York wall time. */
export function fromNy(wall: number): number {
  let u = wall - nyOffset(wall) * 60_000;
  u = wall - nyOffset(u) * 60_000;
  return u;
}

/** The New York date ("YYYY-MM-DD") and minutes after midnight of a UTC moment. */
export function nyClock(utcMs: number): { date: string; minute: number; weekday: number } {
  const w = new Date(utcMs + nyOffset(utcMs) * 60_000);
  return { date: w.toISOString().slice(0, 10), minute: w.getUTCHours() * 60 + w.getUTCMinutes(), weekday: w.getUTCDay() };
}

/** UTC date of a moment. */
export const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const UTC_FORMATS = new Set(["bybit", "bybit_pnl", "bybit_closed", "binance_spot", "binance_futures", "binance_statement", "coinbase", "coinbase_tx", "kraken", "alpaca"]);
const ZONE_IN_CELL = /\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|UTC|GMT|[+-]\d{2}:?\d{2}|EST|EDT|CST|CDT|MST|MDT|PST|PDT|CET|CEST|BST)\s*$/i;

/**
 * Which clock a parsed file's times are in. The readers turn a zone they find (in a header or
 * a cell) into UTC; Interactive Brokers writes New York time; anything else is unknown.
 */
export function clockOf(p: Pick<Parsed, "format" | "table" | "mapping">): Clock {
  if (p.format === "ibkr" || p.format === "ibkr_activity") return "new_york";
  if (UTC_FORMATS.has(p.format)) return "utc";
  const col = p.mapping.closeTime ?? p.mapping.date;
  if (col != null) {
    if (headerOffset(p.table.headers[col]) != null) return "utc";
    const cells = p.table.rows.slice(0, 20).map((r) => (r[col] ?? "").trim()).filter(Boolean);
    if (cells.length && cells.every((c) => ZONE_IN_CELL.test(c))) return "utc";
  }
  return "unknown";
}

/** UTC ms of a fill's time in its clock, with `offset` minutes east of UTC for an unknown one. */
export function toUtc(t: string, clock: Clock, offset = 0): number {
  const w = wallMs(t);
  if (Number.isNaN(w)) return w;
  if (clock === "utc") return w;
  if (clock === "new_york") return fromNy(w);
  return w - offset * 60_000;
}

/** Every time zone a clock could be in, as minutes east of UTC: whole and half hours from UTC-12 to UTC+14. */
export const OFFSETS: number[] = Array.from({ length: 53 }, (_, i) => -720 + i * 30);

const addDay = (d: string, n: number) => utcDate(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000);

/** UTC dates a stretch [from, to) touches. */
export function datesIn(from: number, to: number): string[] {
  const out: string[] = [];
  for (let d = utcDate(from); d <= utcDate(to - 1); d = addDay(d, 1)) out.push(d);
  return out;
}
