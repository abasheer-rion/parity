// The back-test of the screen itself (DEC-0087): when a firm also gives what happened after
// the challenge (a payout, or the account blew up), how well did the verdict predict it?
// Counts in a two by two table, each rate with a 95% Wilson interval, and the gap between
// the blow-up rates of "likely luck" and "holds up" with Newcombe's interval for a
// difference of two proportions. Pure functions.
import type { AccountResult } from "./score";

export interface Rate {
  k: number;
  n: number;
  /** k / n; null when n is 0. */
  p: number | null;
  /** 95% Wilson score interval; null when n is 0. */
  lo: number | null;
  hi: number | null;
}

const Z95 = 1.959963984540054;

/** Wilson score interval for k successes in n tries (Wilson 1927). */
export function wilson(k: number, n: number, z = Z95): Rate {
  if (n <= 0) return { k, n, p: null, lo: null, hi: null };
  const p = k / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { k, n, p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

export interface Difference { d: number | null; lo: number | null; hi: number | null }

/** p1 - p2 with Newcombe's hybrid score interval (Newcombe 1998, method 10). */
export function newcombe(a: Rate, b: Rate): Difference {
  if (a.p == null || b.p == null) return { d: null, lo: null, hi: null };
  const d = a.p - b.p;
  return {
    d,
    lo: d - Math.sqrt((a.p - a.lo!) ** 2 + (b.hi! - b.p) ** 2),
    hi: d + Math.sqrt((a.hi! - a.p) ** 2 + (b.p - b.lo!) ** 2),
  };
}

export interface Backtest {
  /** Accounts with a known outcome and a verdict other than "not enough trades". */
  n: number;
  /** Flagged "likely luck" and blew up; flagged and paid; held up and blew up; held up and paid. */
  tp: number; fp: number; fn: number; tn: number;
  /** Of the accounts flagged likely luck, the share that later blew up. */
  hitRate: Rate;
  /** Of the accounts that went on to a payout, the share flagged likely luck. */
  falseAlarms: Rate;
  /** Of the accounts that blew up, the share flagged likely luck. */
  caught: Rate;
  /** Blow-up rate of accounts that hold up. */
  holdsBlowup: Rate;
  /** Blow-up rate of every judged account with an outcome. */
  baseRate: Rate;
  /** Blow-up rate of likely luck minus that of holds up. */
  gap: Difference;
  /** Accounts with an outcome but too few trades to judge, and how many of them blew up. */
  notEnough: Rate;
  /** True when a group is too small to read much into (under 20 accounts). */
  small: boolean;
}

/** Null when no account has an outcome. */
export function backtest(results: readonly AccountResult[]): Backtest | null {
  const known = results.filter((r) => r.outcome);
  if (!known.length) return null;
  const judged = known.filter((r) => r.verdict !== "not_enough");
  const flagged = judged.filter((r) => r.verdict === "likely_luck");
  const holds = judged.filter((r) => r.verdict === "holds_up");
  const blew = (rs: readonly AccountResult[]) => rs.filter((r) => r.outcome === "blowup").length;
  const tp = blew(flagged), fp = flagged.length - tp, fn = blew(holds), tn = holds.length - fn;
  const hitRate = wilson(tp, tp + fp);
  const holdsBlowup = wilson(fn, fn + tn);
  const thin = known.filter((r) => r.verdict === "not_enough");
  return {
    n: judged.length, tp, fp, fn, tn,
    hitRate,
    falseAlarms: wilson(fp, fp + tn),
    caught: wilson(tp, tp + fn),
    holdsBlowup,
    baseRate: wilson(tp + fn, judged.length),
    gap: newcombe(hitRate, holdsBlowup),
    notEnough: wilson(blew(thin), thin.length),
    small: Math.min(flagged.length, holds.length) < 20,
  };
}
