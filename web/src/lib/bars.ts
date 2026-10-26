// Bars for the Trade charts. Our free, licence-clean sources publish one closing price
// a day (FRED, the ECB, CoinGecko), not the open, high and low. So a daily bar is built
// from two closes: it opens at the previous close and its high and low are the larger
// and smaller of the two. Weekly and monthly bars are true bars of the daily closes
// (first, highest, lowest and last close in the period). The chart says so in words.
import type { Bar } from "./indicators";
import type { Point } from "./types";

export type Timeframe = "D" | "W" | "M";

export const TIMEFRAMES: { id: Timeframe; label: string; long: string }[] = [
  { id: "D", label: "1D", long: "Daily" },
  { id: "W", label: "1W", long: "Weekly" },
  { id: "M", label: "1M", long: "Monthly" },
];

/** Daily bars from closing prices; volumes (same dates) are attached when given. */
export function barsFromCloses(points: Point[], volumes?: Map<string, number>): Bar[] {
  const out: Bar[] = [];
  let prev: number | null = null;
  for (const [time, close] of points) {
    if (close == null || !Number.isFinite(close)) continue;
    const open = prev ?? close;
    out.push({ time, open, high: Math.max(open, close), low: Math.min(open, close), close, volume: volumes?.get(time) ?? null });
    prev = close;
  }
  return out;
}

/** The Monday that starts an ISO week, as YYYY-MM-DD (bars are keyed by their first day). */
function periodKey(time: string, tf: Timeframe): string {
  if (tf === "M") return time.slice(0, 7);
  const d = new Date(`${time}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Weekly or monthly bars from daily bars: first open, highest high, lowest low, last close,
 *  summed volume (null if any day lacks it). Each bar is dated by its last day in the data. */
export function resample(bars: Bar[], tf: Timeframe): Bar[] {
  if (tf === "D") return bars;
  const out: Bar[] = [];
  let key = "", cur: Bar | null = null, volOk = true;
  for (const b of bars) {
    const k = periodKey(b.time, tf);
    if (k !== key || !cur) {
      if (cur) out.push({ ...cur, volume: volOk ? cur.volume : null });
      key = k; cur = { ...b }; volOk = b.volume != null;
      continue;
    }
    cur.high = Math.max(cur.high, b.high);
    cur.low = Math.min(cur.low, b.low);
    cur.close = b.close;
    cur.time = b.time;
    if (b.volume == null) volOk = false; else cur.volume = (cur.volume ?? 0) + b.volume;
  }
  if (cur) out.push({ ...cur, volume: volOk ? cur.volume : null });
  return out;
}

/** The plain-words note under a chart about how its bars were made. */
export function barNote(tf: Timeframe): string {
  return tf === "D"
    ? "Daily bars are built from closing prices: each opens at the previous close, and its high and low are the larger and smaller of the two. Our free sources do not publish intraday highs and lows."
    : `${tf === "W" ? "Weekly" : "Monthly"} bars use daily closes: the first, highest, lowest and last close in the period. Intraday highs and lows are not in our free data.`;
}

/** Index of the last bar dated on or before `time` (bars sorted oldest first), or -1. */
export function barAtOrBefore(bars: Bar[], time: string): number {
  let lo = 0, hi = bars.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].time <= time) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
