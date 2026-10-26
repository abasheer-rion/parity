// Card 3: the luck check (REF-0016). The deflated Sharpe ratio at the number of tries the
// person stated, the largest number of tries the record survives, and how much longer the
// same results would need to run to pass.
import { deflatedSharpeFrom, minTrackRecord, moments, survivesUpTo } from "../dsr";

export interface LuckCard {
  /** What one observation is: a day (week, month) of returns, or one trade's profit when returns are unknown. */
  basis: "daily" | "weekly" | "monthly" | "period" | "trade";
  observations: number;
  /** Sharpe per observation, and per year when the basis is a time period. */
  sharpe: number | null;
  sharpeAnnual: number | null;
  tries: number;
  dsr: number | null;
  survives: number | null;
  /** Months more of the same results needed to pass at the stated tries; 0 when it already passes, Infinity when it never would. */
  monthsMore: number | null;
  /** The spread of Sharpe across tries is unknown, so the single-estimate stand-in was used. */
  varianceStandIn: boolean;
}

export function basisFor(periodsPerYear: number): LuckCard["basis"] {
  return periodsPerYear >= 180 ? "daily" : periodsPerYear >= 40 ? "weekly" : periodsPerYear >= 10 ? "monthly" : "period";
}

/**
 * @param obs returns per period, or trade profits when there is no balance
 * @param perYear observations per year (trades per year for the trade basis)
 */
export function luckCard(obs: readonly number[], basis: LuckCard["basis"], perYear: number, tries: number): LuckCard {
  const m = moments(obs);
  if (!m) return { basis, observations: obs.length, sharpe: null, sharpeAnnual: null, tries, dsr: null, survives: null, monthsMore: null, varianceStandIn: true };
  const dsr = deflatedSharpeFrom(m, tries);
  const need = minTrackRecord(m, tries);
  const extra = Math.max(0, Math.ceil(need) - m.t);
  return {
    basis, observations: m.t, sharpe: m.sr,
    sharpeAnnual: basis === "trade" ? null : m.sr * Math.sqrt(perYear),
    tries, dsr, survives: survivesUpTo(m),
    monthsMore: dsr >= 0.95 ? 0 : Number.isFinite(need) && perYear > 0 ? (extra / perYear) * 12 : Infinity,
    varianceStandIn: true,
  };
}
