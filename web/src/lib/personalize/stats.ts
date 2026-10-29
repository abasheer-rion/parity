// Confidence intervals for experiment results (DEC-0068), on our own normal quantile
// (lib/verify/stats.ts). Proportions only: every experiment metric is "share of exposed people
// who did it at least once".
import { normPpf } from "../verify/stats";

export interface Interval { estimate: number; lo: number; hi: number }

/** Wilson score interval for k successes out of n. Null when n is 0. */
export function wilson(k: number, n: number, level = 0.95): Interval | null {
  if (!(n > 0) || k < 0 || k > n) return null;
  const z = normPpf(1 - (1 - level) / 2);
  const p = k / n, z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { estimate: p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/**
 * Newcombe's hybrid score interval for the difference p1 - p2 (variant minus control), built
 * from the two Wilson intervals. Null when either side has no one.
 */
export function diffInterval(k1: number, n1: number, k2: number, n2: number, level = 0.95): Interval | null {
  const a = wilson(k1, n1, level), b = wilson(k2, n2, level);
  if (!a || !b) return null;
  const d = a.estimate - b.estimate;
  const lo = d - Math.sqrt((a.estimate - a.lo) ** 2 + (b.hi - b.estimate) ** 2);
  const hi = d + Math.sqrt((a.hi - a.estimate) ** 2 + (b.estimate - b.lo) ** 2);
  return { estimate: d, lo, hi };
}

/** "4.1%" for a share, "n/a" when unknown. */
export const pctText = (x: number | null | undefined, digits = 1) => (x == null || !Number.isFinite(x) ? "n/a" : `${(x * 100).toFixed(digits)}%`);

/** "+1.2 to +3.4 points" style text for a difference interval. */
export function diffText(iv: Interval | null): string {
  if (!iv) return "n/a";
  const s = (x: number) => `${x >= 0 ? "+" : "-"}${Math.abs(x * 100).toFixed(1)}`;
  return `${s(iv.estimate)} (${s(iv.lo)} to ${s(iv.hi)}) points`;
}
