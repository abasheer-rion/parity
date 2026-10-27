// Monthly candles from a strategy's daily value series (DEC-0075), for the strategy cards on
// Home. Pure arithmetic, unit tested (tests/home.test.ts).
import type { Point } from "../lib/types";

export interface Candles { candles: [number, number, number, number][]; labels: string[]; change: number | null }

/** The last `months` calendar months as [open, high, low, close], oldest first. A month opens
 *  at the previous month's close, so the candles join up. */
export function monthlyCandles(points: Point[], months = 12): Candles {
  const by = new Map<string, number[]>();
  for (const [d, v] of points) {
    if (!Number.isFinite(v)) continue;
    const m = d.slice(0, 7);
    const arr = by.get(m);
    if (arr) arr.push(v); else by.set(m, [v]);
  }
  const keys = [...by.keys()].sort();
  const pick = keys.slice(-(months + 1));
  const out: [number, number, number, number][] = [];
  const labels: string[] = [];
  for (let i = 1; i < pick.length; i++) {
    const prev = by.get(pick[i - 1])!;
    const vals = by.get(pick[i])!;
    const open = prev[prev.length - 1];
    const close = vals[vals.length - 1];
    out.push([open, Math.max(open, ...vals), Math.min(open, ...vals), close]);
    labels.push(pick[i]);
  }
  const change = out.length ? out[out.length - 1][3] / out[0][0] - 1 : null;
  return { candles: out, labels, change };
}
