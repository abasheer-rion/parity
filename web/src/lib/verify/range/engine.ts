// The fill price check's arithmetic (DEC-0092), with no network: which bars a request needs
// (plan), and, once they are loaded, one answer per fill (classify). The server fills in the
// bars; the tests use recorded ones.
//
// For each fill:
//  1. US stocks: a fill timed on a weekend (8 p.m. Friday to 8 p.m. Sunday, New York time) or
//     on a market holiday before 8 p.m. is "closed". Currency pairs: 5 p.m. Friday to 5 p.m.
//     Sunday. Crypto trades every day.
//  2. The bars that overlap the fill's minute, give or take the source's window, set a low and
//     a high. The fill is "in" when its price is inside them, widened by the source's tolerance,
//     and "out" when it is not.
//  3. With no bars in the window (nothing traded on our source then), the day's low and high are
//     used instead, for crypto at any time and for US stocks in the regular session only.
//  4. A fill inside the range within 0.05% of the day's high or low is marked as at it.
// An unknown clock is tried at every time zone; the one that puts the most fills inside a
// minute bar is used, give or take an hour for summer time. A source read around exact times
// only (the swaps of our on-chain pools) needs a known clock and a time of day.
import { nyClock, OFFSETS, toUtc, utcDate, wallMs } from "./clock";
import type { Market } from "./market";
import { EDGE, MIN_FOR_OFFSET, RANGE_VERSION, type Clock, type FillAnswer, type FillPoint, type NoneWhy, type RangeAnswer } from "./types";

/** [start ms, low, high]. A bar covers [start, start + the source's bar length). */
export type Bar = [number, number, number];

export interface SourceInfo {
  id: string;
  /** In words, for the page: "Alpaca, consolidated US feed". */
  name: string;
  market: Market;
  /** Bar length, ms. */
  barMs: number;
  /** How far either side of the fill's time bars count, ms. */
  window: number;
  /** Tolerance on a minute range and on a day's range, as fractions. */
  tolBar: number;
  tolDay: number;
  /** Smallest price step the tolerance never goes under (a cent for US stocks). */
  tick?: number;
  /** Read around exact times, not by whole days: needs a known clock and a time of day. */
  exactTime?: boolean;
}

/** Bars loaded for [from, to), or why that stretch could not be loaded. */
export type Span = { from: number; to: number; bars: Bar[] } | { from: number; to: number; why: NoneWhy };

/** What the server loaded for one symbol. */
export interface SymData {
  src: SourceInfo;
  /** Intraday bars for the stretches loaded, sorted by start. A time no span covers was not asked for. */
  spans: Span[];
  /** The day's [low, high] by date (New York trading date for stocks, UTC date for the rest). */
  days: Map<string, [number, number]> | NoneWhy | null;
  /** The source's data is complete (or allowed) only up to this moment, ms. */
  until?: number;
}

export interface Book {
  /** Per sent symbol, its data or why there is none. */
  syms: Map<string, SymData | NoneWhy>;
  /** US trading days (New York dates) between `calFrom` and `calTo`, from a broad fund's daily bars. Null when not loaded. */
  calendar: Set<string> | null;
  calFrom?: string;
  calTo?: string;
}

const H = 3_600_000;
/** An unknown clock: a wall time could be anything from 14 hours ahead of UTC to 12 behind, plus an hour for summer time. */
const BEFORE = 14 * H + H, AFTER = 12 * H + H;

const dateOnly = (t: string) => /^\d{4}-\d{2}-\d{2}$/.test(t);
const addDays = (d: string, n: number) => utcDate(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000);

export interface Need {
  /** Stretches of time (UTC ms) the fills need bars for, merged, in the order first needed. */
  spans: [number, number][];
  /** Dates of daily bars needed. */
  from: string;
  to: string;
}

/**
 * Which stretches of intraday bars, and which span of daily bars, each symbol needs. Fills
 * come first in the order sent, so a request that runs out of budget answers the earliest.
 * `reachOf` is the source's window plus one bar length (a bar that starts before the window
 * can still overlap it), or null for a source that cannot be read for this clock.
 */
export function plan(clock: Clock, fills: readonly FillPoint[], reachOf: (s: string) => { reach: number; exactTime: boolean }): Map<string, Need> {
  const out = new Map<string, Need>();
  for (const f of fills) {
    const w = wallMs(f.t);
    if (Number.isNaN(w)) continue;
    const d = utcDate(w);
    const need = out.get(f.s) ?? { spans: [], from: d, to: d };
    out.set(f.s, need);
    const lo = addDays(d, -1), hi = addDays(d, 1);
    if (lo < need.from) need.from = lo;
    if (hi > need.to) need.to = hi;
    if (dateOnly(f.t)) continue;
    const { reach, exactTime } = reachOf(f.s);
    if (exactTime && clock === "unknown") continue;
    const span: [number, number] = clock === "unknown" ? [w - BEFORE - reach, w + AFTER + reach] : [toUtc(f.t, clock) - reach, toUtc(f.t, clock) + reach];
    need.spans.push(span);
  }
  for (const need of out.values()) need.spans = merge(need.spans);
  return out;
}

/** Overlapping stretches joined, sorted by start. */
export function merge(spans: [number, number][]): [number, number][] {
  const s = [...spans].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out;
}

const inside = (p: number, lo: number, hi: number, tol: number, tick = 0) => {
  const pad = (v: number) => Math.max(v * tol, tick);
  return p >= lo - pad(lo) && p <= hi + pad(hi);
};

/** True when US stocks do not trade at all at this moment (weekend, holiday), as far as we know. */
function stockClosed(u: number, book: Book): boolean {
  const c = nyClock(u);
  if (c.weekday === 6) return true;
  if (c.weekday === 5 && c.minute >= 20 * 60) return true;
  if (c.weekday === 0 && c.minute < 20 * 60) return true;
  if (book.calendar && book.calFrom && book.calTo && c.date >= book.calFrom && c.date <= book.calTo && !book.calendar.has(c.date) && c.minute < 20 * 60) return true;
  return false;
}

/** Currency markets close from 5 p.m. Friday to 5 p.m. Sunday, New York time. */
function fxClosed(u: number): boolean {
  const c = nyClock(u);
  return c.weekday === 6 || (c.weekday === 5 && c.minute >= 17 * 60) || (c.weekday === 0 && c.minute < 17 * 60);
}

/** The date a day's bar is filed under: the New York date for US stocks, the UTC date otherwise. */
const dayKey = (market: Market, u: number) => (market === "stock" ? nyClock(u).date : utcDate(u));

function dayRange(sd: SymData, date: string): [number, number] | null {
  return sd.days instanceof Map ? sd.days.get(date) ?? null : null;
}

/** At the day's high ("h") or low ("l"), neither ("n"), or undefined when the day's range is unknown. */
function edgeOf(p: number, r: [number, number] | null): "h" | "l" | "n" | undefined {
  if (!r) return undefined;
  if (p >= r[1] * (1 - EDGE)) return "h";
  if (p <= r[0] * (1 + EDGE)) return "l";
  return "n";
}

/** First index with bar start >= t. */
function lowerBound(bars: Bar[], t: number): number {
  let lo = 0, hi = bars.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m][0] < t) lo = m + 1; else hi = m; }
  return lo;
}

/** One fill at one UTC moment. `edges` false when the moment is only one of many guesses. */
export function atMoment(sd: SymData, book: Book, u: number, p: number, edges = true): FillAnswer {
  const s = sd.src;
  if (s.market === "stock" && stockClosed(u, book)) return { r: "closed", src: s.id };
  if (s.market === "fx" && fxClosed(u)) return { r: "closed", src: s.id };
  const from = u - s.window, to = u + s.window;
  if (sd.until != null && to > sd.until) return { r: "none", n: "late", src: s.id };
  // Every moment of the window must be in a loaded stretch.
  let covered = from - s.barMs, lo = Infinity, hi = -Infinity;
  for (const sp of sd.spans) {
    if (sp.to <= from - s.barMs || sp.from >= to) continue;
    if (sp.from > covered) break;
    if ("why" in sp) return { r: "none", n: sp.why, src: s.id };
    covered = Math.max(covered, sp.to);
    const b = sp.bars;
    for (let i = lowerBound(b, from - s.barMs + 1); i < b.length && b[i][0] < to; i++) {
      if (b[i][0] + s.barMs <= from) continue;
      if (b[i][1] < lo) lo = b[i][1];
      if (b[i][2] > hi) hi = b[i][2];
    }
  }
  if (covered < to) return { r: "none", n: "more", src: s.id };
  const day = dayRange(sd, dayKey(s.market, u));
  // A US stock's day range is its regular session (9:30 a.m. to 4 p.m. New York), so it is
  // only used, for the fallback and for "at the day's high or low", inside that session.
  const regular = s.market !== "stock" || (() => { const c = nyClock(u); return c.minute >= 9 * 60 + 30 && c.minute < 16 * 60; })();
  edges &&= regular;
  if (lo <= hi) {
    const r = inside(p, lo, hi, s.tolBar, s.tick) ? "in" : "out";
    return { r, b: "m", src: s.id, ...(r === "in" && edges ? { e: edgeOf(p, day) } : {}) };
  }
  // Nothing traded on our source in the window.
  if (!day || !regular) return { r: "none", n: "data", src: s.id };
  const r = inside(p, day[0], day[1], s.tolDay, s.tick) ? "in" : "out";
  return { r, b: "d", src: s.id, ...(r === "in" && edges ? { e: edgeOf(p, day) } : {}) };
}

/** A fill with only a date: the day's low and high (any of the three days around it for an unknown clock). */
function onDate(sd: SymData, book: Book, date: string, p: number, clock: Clock): FillAnswer {
  const s = sd.src;
  if (s.exactTime) return { r: "none", n: "time", src: s.id };
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (s.market === "stock") {
    const weekend = clock === "unknown" ? wd === 0 : wd === 0 || wd === 6;
    const holiday = clock !== "unknown" && !!book.calendar && !!book.calFrom && !!book.calTo && date >= book.calFrom && date <= book.calTo && !book.calendar.has(date) && wd !== 0 && wd !== 6;
    if (weekend || holiday) return { r: "closed", src: s.id };
  }
  const dates = clock === "unknown" ? [addDays(date, -1), date, addDays(date, 1)] : [date];
  const rs = dates.map((d) => dayRange(sd, d)).filter((x): x is [number, number] => !!x);
  if (!rs.length) return { r: "none", n: typeof sd.days === "string" ? sd.days : sd.days ? "data" : "more", src: s.id };
  const lo = Math.min(...rs.map((r) => r[0])), hi = Math.max(...rs.map((r) => r[1]));
  const r = inside(p, lo, hi, s.tolDay, s.tick) ? "in" : "out";
  return { r, b: "d", src: s.id, ...(r === "in" && clock !== "unknown" ? { e: edgeOf(p, rs[0]) } : {}) };
}

/** Combines the answers at several guessed times: inside at any wins, then outside, then closed. */
function best(answers: FillAnswer[]): FillAnswer {
  return answers.find((a) => a.r === "in") ?? answers.find((a) => a.r === "out") ?? answers.find((a) => a.r === "closed") ?? answers.find((a) => a.n && a.n !== "data") ?? answers[0];
}

/** One answer per fill, in the order sent. */
export function classify(clock: Clock, fills: readonly FillPoint[], book: Book): RangeAnswer {
  const unsupported = new Set<string>();
  const dataOf = (s: string): SymData | NoneWhy => book.syms.get(s) ?? "sym";

  // An unknown clock: score every time zone by the fills it puts inside a minute bar.
  let offset: number | null = null;
  if (clock === "unknown") {
    const timed = fills.filter((f) => { const d = dataOf(f.s); return !dateOnly(f.t) && typeof d !== "string" && !d.src.exactTime; });
    if (timed.length >= MIN_FOR_OFFSET) {
      const score = new Map<number, number>();
      for (const o of OFFSETS) {
        let n = 0;
        for (const f of timed) {
          const a = atMoment(dataOf(f.s) as SymData, book, wallMs(f.t) - o * 60_000, f.p, false);
          if (a.r === "in" && a.b === "m") n++;
        }
        score.set(o, n);
      }
      const top = Math.max(...score.values());
      if (top > 0) offset = OFFSETS.filter((o) => score.get(o) === top).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)[0];
    }
  }

  const out: FillAnswer[] = fills.map((f) => {
    const sd = dataOf(f.s);
    if (typeof sd === "string") { if (sd === "sym") unsupported.add(f.s); return { r: "none", n: sd }; }
    if (!(f.p > 0) || Number.isNaN(wallMs(f.t.length === 10 ? `${f.t}T00:00` : f.t))) return { r: "none", n: "data", src: sd.src.id };
    if (dateOnly(f.t)) return onDate(sd, book, f.t, f.p, clock);
    if (clock !== "unknown") return atMoment(sd, book, toUtc(f.t, clock), f.p);
    if (sd.src.exactTime) return { r: "none", n: "time", src: sd.src.id };
    const w = wallMs(f.t);
    if (offset != null) {
      // The time zone that fits best, or an hour either side of it for summer time.
      return best([offset, offset - 60, offset + 60].map((o) => atMoment(sd, book, w - o * 60_000, f.p, o === offset)));
    }
    // Too few fills to pick a time zone: inside at any of them counts as inside.
    return best(OFFSETS.map((o) => atMoment(sd, book, w - o * 60_000, f.p, false)));
  });
  for (const a of out) if (a.e === undefined) delete a.e;
  return { v: RANGE_VERSION, fills: out, offset, unsupported: [...unsupported] };
}
