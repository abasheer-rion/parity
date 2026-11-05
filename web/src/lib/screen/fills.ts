// The fill price check for a batch (DEC-0092): with the firm's leave, the symbol, time and
// price of each account's fills go to our server, which says how many fall outside the range
// traded at that time, or were timed while the market was closed. It does not change the
// screen's verdict (screen-1.0): it is reported next to it, per account and for the batch.
// Large batches are sampled evenly: at most MAX_BATCH_FILLS fills in all, the same share of
// each account's fills.
import { fetchCoverage, planFills, RangeFailed, runFills, type Coverage, type Planned, type RangeOutcome } from "../verify/range/client";
import type { FillPoint } from "../verify/range/types";
import type { AccountInput } from "./score";

export const MAX_BATCH_FILLS = 10_000;

export interface AccountFills {
  /** Fills with an answer inside or outside the range. */
  checked: number;
  outside: number;
  closed: number;
  /** Fills sent but not checked (no source, no data). */
  notChecked: number;
  /** Fills of the account's that were sent. */
  sent: number;
  /** All the account's fills with a symbol, time and price. */
  total: number;
  /** The account's own outcome, for its full Verify report. */
  outcome: RangeOutcome;
}

/** Each account's planned fills, sampled evenly when the batch is larger than the cap. */
export function planBatch(accounts: readonly AccountInput[], cap = MAX_BATCH_FILLS, cover?: Coverage | null): Map<string, Planned & { total: number }> {
  const plans = new Map<string, Planned & { total: number }>();
  for (const a of accounts) { const p = planFills(a.trades, a.format, a.clock ?? "unknown", cover); plans.set(a.id, { ...p, total: p.points.length }); }
  const total = [...plans.values()].reduce((s, p) => s + p.points.length, 0);
  if (total <= cap) return plans;
  const share = cap / total;
  for (const p of plans.values()) {
    const keep = Math.max(1, Math.floor(p.points.length * share));
    const step = p.points.length / keep;
    p.points = Array.from({ length: keep }, (_, i) => p.points[Math.floor(i * step)]);
  }
  return plans;
}

/**
 * Runs the check for every account, grouped by clock so one request carries many accounts.
 * Returns each account's counts. Throws RangeFailed when the server cannot be reached at all.
 */
export async function screenFills(accounts: readonly AccountInput[], opt: { token: string; fetch?: typeof fetch; onProgress?: (done: number, total: number) => void; cap?: number }): Promise<Map<string, AccountFills>> {
  // Which markets the server can check, so only those fills are sent.
  const cover = await fetchCoverage(opt.fetch);
  // Without the server's answer on what it covers, nothing is sent.
  if (!cover) throw new RangeFailed("the fill price check could not be reached. Try again in a minute.", "failed");
  const plans = planBatch(accounts, opt.cap, cover);
  const out = new Map<string, AccountFills>();
  const byClock = new Map<string, { id: string; plan: Planned & { total: number } }[]>();
  for (const [id, plan] of plans) {
    if (!plan.points.length) continue;
    const k = plan.clock;
    if (!byClock.has(k)) byClock.set(k, []);
    byClock.get(k)!.push({ id, plan });
  }
  const grand = [...plans.values()].reduce((s, p) => s + p.points.length, 0);
  let doneBefore = 0;
  for (const [clock, group] of byClock) {
    // One combined plan per clock; each point remembers its account.
    const owner: string[] = [];
    const points: (FillPoint & { legs: Planned["points"][number]["legs"] })[] = [];
    for (const { id, plan } of group) for (const p of plan.points) { owner.push(id); points.push(p); }
    const res = await runFills({ clock: clock as Planned["clock"], points, skipped: 0, uncovered: {} }, { token: opt.token, fetch: opt.fetch, onProgress: (d) => opt.onProgress?.(doneBefore + d, grand) });
    doneBefore += points.length;
    if (!res.ran) continue;
    for (const { id, plan } of group) {
      const idx = owner.map((o, i) => (o === id ? i : -1)).filter((i) => i >= 0);
      const answers = idx.map((i) => res.answers[i]);
      out.set(id, {
        checked: answers.filter((a) => a.r === "in" || a.r === "out").length,
        outside: answers.filter((a) => a.r === "out").length,
        closed: answers.filter((a) => a.r === "closed").length,
        notChecked: answers.filter((a) => a.r === "none").length,
        sent: plan.points.length, total: plan.total,
        outcome: { ran: true, clock: plan.clock, offset: res.offset, points: plan.points, answers, unsupported: res.unsupported, skipped: plan.skipped, uncovered: plan.uncovered },
      });
    }
  }
  return out;
}
