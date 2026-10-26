// The luck check: the deflated Sharpe ratio of Bailey and Lopez de Prado (2014), ported
// line for line from deflated_sharpe() in engine/src/parity/metrics/performance.py. A
// fixture made by that Python function (scripts/verify_dsr_fixture.py) checks this port
// to 3 decimal places in web/tests/verify/dsr.test.ts. Change both together.
import { kurtosis, mean, normCdf, normPpf, skew, std } from "./stats";

export const EULER_GAMMA = 0.5772156649;
/** The line the luck check must reach, as in the gauntlet's test A3 (REF-0006). */
export const LUCK_LINE = 0.95;
/** The largest number of tries "survives up to N tries" looks at. */
export const MAX_TRIES = 1_000_000_000;

export interface Moments { t: number; sr: number; skew: number; kurt: number }

/** The numbers the luck check needs from a list of returns, or null when too short or flat. */
export function moments(returns: readonly number[]): Moments | null {
  const r = returns.filter((v) => Number.isFinite(v));
  const t = r.length;
  const sd = std(r);
  // A flat series leaves only rounding error in the standard deviation; treat it as zero.
  if (t < 30 || !(sd > 1e-12)) return null;
  return { t, sr: mean(r) / sd, skew: skew(r), kurt: kurtosis(r) };
}

/** The Sharpe a lucky best-of-N would reach by chance: sr0 in the paper. */
export function luckyBar(m: Moments, nTrials: number, srVariance?: number): number {
  if (nTrials <= 1) return 0;
  // When the spread of Sharpe across tries is unknown (always, for uploads), use the
  // sampling variance of a single estimate, the same stand-in the Python uses.
  const v = srVariance ?? (1 + 0.5 * m.sr ** 2) / (m.t - 1);
  const z1 = normPpf(1 - 1 / nTrials);
  const z2 = normPpf(1 - 1 / (nTrials * Math.E));
  return Math.sqrt(v) * ((1 - EULER_GAMMA) * z1 + EULER_GAMMA * z2);
}

function denom(m: Moments): number {
  return Math.sqrt(Math.max(1 - m.skew * m.sr + ((m.kurt - 1) / 4) * m.sr ** 2, 1e-12));
}

/** Probability that the true Sharpe is above zero after nTrials tries; null when the Python returns NaN. */
export function deflatedSharpeFrom(m: Moments, nTrials = 1, srVariance?: number): number {
  return normCdf(((m.sr - luckyBar(m, nTrials, srVariance)) * Math.sqrt(m.t - 1)) / denom(m));
}

export function deflatedSharpe(returns: readonly number[], nTrials = 1, srVariance?: number): number | null {
  const m = moments(returns);
  return m ? deflatedSharpeFrom(m, nTrials, srVariance) : null;
}

/**
 * The shareable number: the largest number of tries for which the luck check stays at
 * or above 0.95. 0 means it fails even as the only thing tried. Capped at MAX_TRIES.
 */
export function survivesUpTo(m: Moments): number {
  const ok = (n: number) => deflatedSharpeFrom(m, n) >= LUCK_LINE;
  if (!ok(1)) return 0;
  if (ok(MAX_TRIES)) return MAX_TRIES;
  let lo = 1, hi = MAX_TRIES; // ok(lo) is true, ok(hi) is false
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

/**
 * Minimum track record length (Bailey and Lopez de Prado, 2012), solved for this luck
 * check: the number of observations the same results would need for the check to reach
 * 0.95 at nTrials tries, with the single-estimate stand-in for the variance. Infinity
 * when the Sharpe is zero or below.
 */
export function minTrackRecord(m: Moments, nTrials: number): number {
  if (!(m.sr > 0)) return Infinity;
  const z = normPpf(LUCK_LINE);
  const k = nTrials <= 1 ? 0 : (1 - EULER_GAMMA) * normPpf(1 - 1 / nTrials) + EULER_GAMMA * normPpf(1 - 1 / (nTrials * Math.E));
  // (sr - sqrt((1 + sr^2/2)/(t-1)) k) sqrt(t-1) / denom >= z  <=>  sqrt(t-1) >= (z denom + sqrt(1 + sr^2/2) k) / sr
  const root = (z * denom(m) + Math.sqrt(1 + 0.5 * m.sr ** 2) * k) / m.sr;
  return 1 + Math.max(0, root) ** 2;
}
