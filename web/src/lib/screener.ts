// The Trade screener (DEC-0032): a few plain measures per instrument from its bars, and
// filters over them. It filters; it never ranks markets by return or says what to buy.
import { adx, rsi, smaOf, type Bar } from "./indicators";

export interface ScreenMetrics {
  close: number | null;
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  /** How far the last close is below the highest close of the past year, as a fraction (0 = at the high). */
  fromHigh: number | null;
  adx14: number | null;
  bars: number;
}

const last = <T,>(a: (T | null)[]): T | null => (a.length ? a[a.length - 1] : null);

export function screenMetrics(bars: Bar[]): ScreenMetrics {
  if (!bars.length) return { close: null, rsi14: null, sma50: null, sma200: null, fromHigh: null, adx14: null, bars: 0 };
  const closes = bars.map((b) => b.close);
  const end = bars[bars.length - 1];
  const yearAgo = new Date(new Date(`${end.time}T00:00:00Z`).getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const high = Math.max(...bars.filter((b) => b.time > yearAgo).map((b) => b.close));
  return {
    close: end.close,
    rsi14: last(rsi(bars, 14)),
    sma50: last(smaOf(closes, 50)),
    sma200: last(smaOf(closes, 200)),
    fromHigh: high > 0 && end.close > 0 ? end.close / high - 1 : null,
    adx14: last(adx(bars, 14).adx),
    bars: bars.length,
  };
}

export type Side = "any" | "above" | "below";

export interface ScreenFilter {
  classes: string[];
  rsiMin: number | null; rsiMax: number | null;
  sma50: Side; sma200: Side;
  m1Min: number | null; m1Max: number | null;
  ytdMin: number | null; ytdMax: number | null;
  /** Keep instruments within this many percent of their one-year high. */
  nearHigh: number | null;
  adxMin: number | null;
}

export const EMPTY_FILTER: ScreenFilter = {
  classes: [], rsiMin: null, rsiMax: null, sma50: "any", sma200: "any", m1Min: null, m1Max: null, ytdMin: null, ytdMax: null, nearHigh: null, adxMin: null,
};

export interface ScreenInput { class: string; m1: number | null | undefined; ytd: number | null | undefined; m: ScreenMetrics }

const inRange = (v: number | null | undefined, lo: number | null, hi: number | null) =>
  (lo == null && hi == null) || (v != null && Number.isFinite(v) && (lo == null || v >= lo) && (hi == null || v <= hi));

const side = (close: number | null, avg: number | null, want: Side) =>
  want === "any" || (close != null && avg != null && (want === "above" ? close > avg : close < avg));

/** Whether a row passes every filter that is set. A filter on a missing value fails the row. */
export function passes(row: ScreenInput, f: ScreenFilter): boolean {
  const { m } = row;
  return (!f.classes.length || f.classes.includes(row.class))
    && inRange(m.rsi14, f.rsiMin, f.rsiMax)
    && side(m.close, m.sma50, f.sma50)
    && side(m.close, m.sma200, f.sma200)
    && inRange(row.m1, f.m1Min, f.m1Max)
    && inRange(row.ytd, f.ytdMin, f.ytdMax)
    && (f.nearHigh == null || (m.fromHigh != null && -m.fromHigh * 100 <= f.nearHigh))
    && (f.adxMin == null || (m.adx14 != null && m.adx14 >= f.adxMin));
}

/** How many filters are set, for the Reset button. */
export function activeCount(f: ScreenFilter): number {
  return (f.classes.length ? 1 : 0) + [f.rsiMin, f.rsiMax, f.m1Min, f.m1Max, f.ytdMin, f.ytdMax, f.nearHigh, f.adxMin].filter((v) => v != null).length
    + (f.sma50 !== "any" ? 1 : 0) + (f.sma200 !== "any" ? 1 : 0);
}

/** Runs `fn` over `items` with at most `limit` running at once, calling `onDone` after each. */
export async function runPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, onDone?: (done: number) => void): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0, done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      onDone?.(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
