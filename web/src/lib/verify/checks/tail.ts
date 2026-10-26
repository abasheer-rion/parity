// Card 2: tail risk (REF-0016). How bad one loss can get, how far the account fell, and
// whether position size grows after losses (martingale or grid). Red flag when the worst
// loss wipes out more than 20 average wins, a martingale pattern is found, or the fall
// from a high is more than half.
import { skew } from "../stats";
import type { Trade } from "../types";

export const WIPEOUT_LIMIT = 20;
export const DRAWDOWN_LIMIT = 0.5;

export interface Martingale {
  found: boolean;
  /** Losing streaks followed by another trade, and how many of them saw size grow. */
  streaks: number;
  grew: number;
  /** Positions added on the same side while an earlier one was losing. */
  adds: number;
  /** False when the file has no position sizes, so the pattern cannot be checked. */
  checkable: boolean;
}

export interface TailCard {
  worstTrade: number | null;
  worstTradePct: number | null;
  worstDay: number | null;
  worstDayPct: number | null;
  winsWipedOut: number | null;
  maxDrawdown: number | null;
  longestUnderwaterDays: number | null;
  es5: number | null;
  skew: number | null;
  skewBasis: "daily" | "trade" | "period" | null;
  martingale: Martingale;
  red: boolean;
  reasons: string[];
}

/**
 * Martingale or grid: size grows after losses in at least 3 out of 4 losing streaks (and
 * at least 3 streaks), or at least 3 times a position is added on the same side of the
 * same symbol while an earlier one is open and losing.
 */
export function martingale(trades: readonly Trade[]): Martingale {
  const sized = trades.filter((t) => t.size != null && t.size > 0);
  if (sized.length < trades.length * 0.9 || sized.length < 8) return { found: false, streaks: 0, grew: 0, adds: 0, checkable: false };
  let streaks = 0, grew = 0;
  for (let i = 0; i < sized.length; i++) {
    if (!(sized[i].pnl < 0) || (i > 0 && sized[i - 1].pnl < 0)) continue;
    // A losing streak starts at i. Size "grows after losses" when each trade after a loss
    // in the streak is bigger than the loss before it.
    let j = i, up = true;
    while (j < sized.length && sized[j].pnl < 0) {
      if (j + 1 < sized.length && !(sized[j + 1].size! > sized[j].size! * 1.0001)) up = false;
      j++;
    }
    if (j >= sized.length) break; // the record ends inside the streak
    streaks++;
    if (up) grew++;
  }
  // Adding to a loser: a new position opens on the same symbol and side while an earlier
  // one is still open and the new entry price is worse than the earlier one.
  let adds = 0;
  const withTimes = trades.filter((t) => t.openTime && t.entry != null && t.side && t.symbol);
  const byKey = new Map<string, Trade[]>();
  for (const t of withTimes) { const k = `${t.symbol}|${t.side}`; byKey.set(k, [...(byKey.get(k) ?? []), t]); }
  for (const list of byKey.values()) {
    const sorted = [...list].sort((a, b) => (a.openTime! < b.openTime! ? -1 : 1));
    for (let i = 1; i < sorted.length; i++) {
      const t = sorted[i];
      const earlier = sorted.slice(0, i).find((o) => o.closeTime > t.openTime! && (t.side === "buy" ? t.entry! < o.entry! : t.entry! > o.entry!));
      if (earlier) adds++;
    }
  }
  const found = (streaks >= 3 && grew / streaks >= 0.75) || adds >= 3;
  return { found, streaks, grew, adds, checkable: true };
}

export interface TailInput {
  trades?: readonly Trade[];
  /** Account value before each trade, when the balance is known (for worst trade as a share). */
  equityBeforeTrade?: readonly number[];
  daily?: { returns: readonly number[]; pnl?: readonly number[]; equityBefore?: readonly number[]; basis: "daily" | "period" };
  avgWin: number | null;
  drawdown?: { maxDrawdown: number; longestDays: number };
}

export function tailCard(x: TailInput): TailCard {
  const trades = x.trades ?? [];
  let worstTrade: number | null = null, worstTradePct: number | null = null;
  if (trades.length) {
    let wi = 0;
    trades.forEach((t, i) => { if (t.pnl < trades[wi].pnl) wi = i; });
    worstTrade = trades[wi].pnl;
    const eb = x.equityBeforeTrade?.[wi];
    worstTradePct = eb && eb > 0 ? worstTrade / eb : null;
  }
  let worstDay: number | null = null, worstDayPct: number | null = null, es5: number | null = null;
  const r = x.daily?.returns ?? [];
  if (r.length) {
    let wi = 0;
    r.forEach((v, i) => { if (v < r[wi]) wi = i; });
    worstDayPct = r[wi];
    worstDay = x.daily?.pnl?.[wi] ?? null;
    const k = Math.max(1, Math.ceil(r.length * 0.05));
    const worst = [...r].sort((a, b) => a - b).slice(0, k);
    es5 = worst.reduce((s, v) => s + v, 0) / k;
  }
  const worstLoss = trades.length ? Math.min(0, worstTrade ?? 0) : worstDayPct != null ? Math.min(0, worstDayPct) : 0;
  const winsWipedOut = x.avgWin && worstLoss < 0 ? -worstLoss / x.avgWin : worstLoss < 0 ? null : 0;
  const sk = r.length >= 3 ? skew(r) : trades.length >= 3 ? skew(trades.map((t) => t.pnl)) : NaN;
  const mg = martingale(trades);
  const reasons: string[] = [];
  if (winsWipedOut != null && winsWipedOut > WIPEOUT_LIMIT) reasons.push(`the worst loss wiped out ${Math.round(winsWipedOut).toLocaleString("en-US")} average wins`);
  if (mg.found) reasons.push(mg.adds >= 3 && !(mg.streaks >= 3 && mg.grew / mg.streaks >= 0.75)
    ? `positions were added while earlier ones were losing ${mg.adds} times`
    : `position size grew after losses in ${mg.grew} of ${mg.streaks} losing streaks`);
  if (x.drawdown && x.drawdown.maxDrawdown > DRAWDOWN_LIMIT) reasons.push(`the account fell ${Math.round(x.drawdown.maxDrawdown * 100)}% from a high`);
  return {
    worstTrade, worstTradePct, worstDay, worstDayPct, winsWipedOut,
    maxDrawdown: x.drawdown?.maxDrawdown ?? null, longestUnderwaterDays: x.drawdown?.longestDays ?? null,
    es5, skew: Number.isFinite(sk) ? sk : null,
    skewBasis: r.length >= 3 ? x.daily!.basis : trades.length >= 3 ? "trade" : null,
    martingale: mg, red: reasons.length > 0, reasons,
  };
}
