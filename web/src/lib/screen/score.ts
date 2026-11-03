// The batch screen for prop firms and platforms (DEC-0087): one verdict per account out of
// three (holds up, likely luck, not enough trades), the numbers behind it, one line saying
// why, and a summary for the whole batch. It reuses Verify's checks (REF-0016): the luck
// check (deflated Sharpe ratio), worst losses, size growth after losses and concentration.
// Pure functions, no React, so the page, the API and the tests run the same code.
//
// Why a separate verdict from Verify's five: a challenge lasts weeks, so Verify's "short
// sample" check (100 trades and 12 months) would fail every account. The screen judges a
// short record on what it can show: whether it makes money per trade, whether one bad run
// could erase it, and whether the result clears the luck check for the tries behind it. How
// much of the profit the best 5 trades made is shown, and counted as a firm rule, but is not
// a reason on its own: in a few dozen trades the best 5 can make half the profit even with a
// real edge.
import { expectancyCard } from "../verify/checks/expectancy";
import { luckCard } from "../verify/checks/luck";
import { tailCard } from "../verify/checks/tail";
import { MIN_TRADES } from "../verify/checks/verdict";
import { day } from "../verify/csv";
import { LUCK_LINE } from "../verify/dsr";
import { daysBetween, drawdowns } from "../verify/returns";
import type { Trade } from "../verify/types";

/** Bump when a rule or a threshold changes, so a report says which rules judged it. */
export const SCREEN_VERSION = "screen-1.0";

export type ScreenVerdict = "holds_up" | "likely_luck" | "not_enough";
export const SCREEN_LABEL: Record<ScreenVerdict, string> = {
  holds_up: "Holds up",
  likely_luck: "Likely luck",
  not_enough: "Not enough trades",
};
export const VERDICT_ORDER: ScreenVerdict[] = ["holds_up", "likely_luck", "not_enough"];

/** What happened after the challenge, when the firm knows: a payout, or the account blew up. */
export type Outcome = "payout" | "blowup";

/** The firm rule on concentration: the best 5 trades made more than this share of the profit. */
export const TOP5_LIMIT = 0.5;

export interface ScreenOptions {
  /** Starting balance for accounts the file does not give one for. */
  startingBalance: number;
  /** The challenge's profit target and loss limit, as shares of the starting balance. */
  profitTarget: number;
  maxLoss: number;
  /** A common firm rule: no single day may make more than this share of the profit. */
  consistencyLimit: number;
  /** A common firm rule: at least this many days with a trade. */
  minDays: number;
  /** Strictest setting: count every account in the batch as one try for each account. */
  countBatchAsTries: boolean;
}

export const DEFAULT_OPTIONS: ScreenOptions = {
  startingBalance: 100_000, profitTarget: 0.08, maxLoss: 0.1, consistencyLimit: 0.3, minDays: 5, countBatchAsTries: false,
};

export interface AccountInput {
  id: string;
  trades: Trade[];
  /** Starting balance from the file, when it has one. */
  balance?: number | null;
  /** Challenge attempts or other tries behind this record, counting this one. */
  tries?: number | null;
  /** Whether the account passed the challenge, when the file says. */
  passed?: boolean | null;
  outcome?: Outcome | null;
}

export interface FirmRules {
  /** True when the rule would have stopped this account; null when it cannot be told. */
  consistency: boolean | null;
  minDays: boolean;
  sizeGrowth: boolean | null;
  concentration: boolean | null;
}

export interface AccountResult {
  id: string;
  verdict: ScreenVerdict;
  label: string;
  /** One line, written from the numbers that decided the verdict. */
  reason: string;
  trades: number;
  days: number;
  balance: number;
  netProfit: number;
  returnPct: number;
  winRate: number | null;
  /** Average profit per trade after fees. */
  expectancy: number | null;
  tries: number;
  /** The luck check: the deflated Sharpe ratio of the trade results at `tries`. */
  dsr: number | null;
  /** The largest number of tries the record survives (the tries-adjusted significance). */
  survives: number | null;
  /** Largest fall from a high, as a share of that high. */
  maxDrawdown: number | null;
  /** Share of the profit made by the best 5 trades; null with no profit or under 10 trades. */
  top5Share: number | null;
  /** Share of the profit made on the best day (the consistency number); null with no profit. */
  bestDayShare: number | null;
  /** Position size grew after losses (martingale or grid); null when the file has no sizes. */
  sizeGrowth: boolean | null;
  passed: boolean | null;
  passedFrom: "file" | "rule" | null;
  outcome: Outcome | null;
  /** What counted against the account: loses money, fragile (one bad run could erase it), luck. */
  flags: ("loses" | "fragile" | "luck")[];
  rules: FirmRules;
}

const money = (v: number) => {
  const a = Math.abs(v);
  return `${v < 0 ? "-" : ""}${a >= 1000 ? a.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a.toFixed(2)}`;
};
const pct = (v: number) => `${Math.round(v * 100)}%`;
const triesText = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "try" : "tries"}`;

/** Whether the account hit the profit target before the loss limit, walking its trades in order. */
export function passedByRule(trades: readonly Trade[], balance: number, target: number, maxLoss: number): boolean {
  let e = balance;
  for (const t of trades) {
    e += t.pnl;
    if (e <= balance * (1 - maxLoss)) return false;
    if (e >= balance * (1 + target)) return true;
  }
  return false;
}

/** Profit by day, in the order the days come. */
export function dailyPnl(trades: readonly Trade[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of trades) out.set(day(t.closeTime), (out.get(day(t.closeTime)) ?? 0) + t.pnl);
  return out;
}

export function top5Share(trades: readonly Trade[]): number | null {
  if (trades.length < 10) return null;
  const total = trades.reduce((s, t) => s + t.pnl, 0);
  if (!(total > 0)) return null;
  const best = trades.map((t) => t.pnl).sort((a, b) => b - a).slice(0, 5).reduce((s, v) => s + v, 0);
  return best / total;
}

export function bestDayShare(trades: readonly Trade[]): number | null {
  const total = trades.reduce((s, t) => s + t.pnl, 0);
  if (!(total > 0)) return null;
  return Math.max(...dailyPnl(trades).values()) / total;
}

/** One account, judged on its trades. `batchSize` counts the batch as tries when the option is on. */
export function scoreAccount(a: AccountInput, opts: ScreenOptions = DEFAULT_OPTIONS, batchSize = 1): AccountResult {
  const trades = [...a.trades].sort((x, y) => (x.closeTime < y.closeTime ? -1 : x.closeTime > y.closeTime ? 1 : 0));
  const balance = a.balance && a.balance > 0 ? a.balance : opts.startingBalance;
  const ownTries = a.tries && a.tries >= 1 ? Math.round(a.tries) : 1;
  const tries = opts.countBatchAsTries ? ownTries * Math.max(1, batchSize) : ownTries;
  const n = trades.length;
  const pnls = trades.map((t) => t.pnl);
  const netProfit = pnls.reduce((s, v) => s + v, 0);
  const days = dailyPnl(trades).size;
  const passedFile = typeof a.passed === "boolean" ? a.passed : null;
  const passed = passedFile ?? (n ? passedByRule(trades, balance, opts.profitTarget, opts.maxLoss) : null);
  const base = {
    id: a.id, trades: n, days, balance, netProfit, returnPct: netProfit / balance, tries,
    passed, passedFrom: passedFile != null ? "file" as const : passed != null ? "rule" as const : null,
    outcome: a.outcome ?? null,
  };

  // Numbers every account gets, even with too few trades to judge.
  let e = balance;
  const equity = trades.map((t) => (e += t.pnl));
  const dd = n ? drawdowns(balance, equity, trades.map((t) => day(t.closeTime))) : null;
  const card1 = n ? expectancyCard(pnls, "trade", balance) : null;
  const equityBefore = [balance, ...equity.slice(0, -1)];
  const tail = card1 ? tailCard({ trades, equityBeforeTrade: equityBefore, avgWin: card1.avgWin, drawdown: dd ?? undefined }) : null;
  const sizeGrowth = tail && tail.martingale.checkable ? tail.martingale.found : null;
  const t5 = top5Share(trades);
  const bd = bestDayShare(trades);
  const rules: FirmRules = {
    consistency: bd == null ? null : bd > opts.consistencyLimit,
    minDays: days < opts.minDays,
    sizeGrowth,
    concentration: t5 == null ? null : t5 > TOP5_LIMIT,
  };
  const common = {
    ...base, winRate: card1 ? card1.winRate : null, expectancy: card1 ? card1.expectancy : null,
    maxDrawdown: dd ? dd.maxDrawdown : null, top5Share: t5, bestDayShare: bd, sizeGrowth, rules,
  };

  if (n < MIN_TRADES) {
    return {
      ...common, verdict: "not_enough", label: SCREEN_LABEL.not_enough, dsr: null, survives: null, flags: [],
      reason: `Only ${n} trade${n === 1 ? "" : "s"}. The screen needs at least ${MIN_TRADES} before it says anything.`,
    };
  }

  const span = trades.length > 1 ? Math.max(daysBetween(trades[0].closeTime, trades[n - 1].closeTime), 1) / 365.25 : 1 / 365.25;
  const luck = luckCard(pnls, "trade", n / span, tries);
  const flags: AccountResult["flags"] = [];
  const why: string[] = [];
  if (card1!.expectancy <= 0) {
    flags.push("loses");
    why.push(`Loses ${money(-card1!.expectancy)} a trade on average after fees`);
  }
  if (tail!.red) {
    flags.push("fragile");
    why.push(`${tail!.reasons[0].charAt(0).toUpperCase()}${tail!.reasons[0].slice(1)}`);
  }
  if (luck.dsr == null || luck.dsr < LUCK_LINE) {
    flags.push("luck");
    why.push(luck.dsr == null
      ? "The luck check cannot be measured: the results do not vary"
      : `Luck check ${luck.dsr.toFixed(2)} after ${triesText(tries)}, below ${LUCK_LINE.toFixed(2)}`);
  }
  const survives = luck.survives;
  if (flags.length) {
    return { ...common, verdict: "likely_luck", label: SCREEN_LABEL.likely_luck, dsr: luck.dsr, survives, flags, reason: `${why.slice(0, 2).join(". ")}.` };
  }
  const spread = t5 != null ? `, best 5 trades made ${pct(t5)} of the profit` : "";
  const surv = survives == null ? "" : survives >= 1_000_000_000 ? ", survives more than 1 billion tries" : `, survives up to ${triesText(survives)}`;
  return {
    ...common, verdict: "holds_up", label: SCREEN_LABEL.holds_up, dsr: luck.dsr, survives, flags,
    reason: `Makes ${money(card1!.expectancy)} a trade over ${n} trades. Luck check ${luck.dsr!.toFixed(2)} after ${triesText(tries)}${surv}${spread}.`,
  };
}

// ------------------------------------------------------------------ the batch

export interface RuleRow {
  id: "consistency" | "minDays" | "sizeGrowth" | "concentration";
  label: string;
  /** Likely-luck passers this rule would also have stopped. */
  luckyCaught: number;
  /** Passers that hold up which this rule would have stopped too. */
  holdsBlocked: number;
  /** Passers the rule could not be applied to (no profit, or no sizes in the file). */
  unknown: number;
}

export interface Summary {
  version: string;
  options: ScreenOptions;
  accounts: number;
  counts: Record<ScreenVerdict, number>;
  /** Accounts whose pass or fail is known (from the file or the target rule). */
  passers: number;
  passersByVerdict: Record<ScreenVerdict, number>;
  /** Where pass or fail came from: the file, the target and loss rule, or both. */
  passedFrom: "file" | "rule" | "mixed" | "none";
  /** Share of judged passers (holds up or likely luck) that look like luck. */
  luckyPasserShare: number | null;
  rules: RuleRow[];
  /** Likely-luck passers that none of the four firm rules above would have stopped. */
  onlyLuckCheck: number;
  /** Accounts with each flag, among likely-luck passers. */
  flagCounts: Record<AccountResult["flags"][number], number>;
}

export const RULE_IDS = ["consistency", "minDays", "sizeGrowth", "concentration"] as const;

export function ruleLabels(o: ScreenOptions): Record<RuleRow["id"], string> {
  return {
    consistency: `Best day over ${pct(o.consistencyLimit)} of the profit`,
    minDays: `Fewer than ${o.minDays} trading days`,
    sizeGrowth: "Position size grows after losses",
    concentration: `Best 5 trades over ${pct(TOP5_LIMIT)} of the profit`,
  };
}

export function summarise(results: readonly AccountResult[], opts: ScreenOptions = DEFAULT_OPTIONS): Summary {
  const zero = (): Record<ScreenVerdict, number> => ({ holds_up: 0, likely_luck: 0, not_enough: 0 });
  const counts = zero(), passersByVerdict = zero();
  for (const r of results) counts[r.verdict]++;
  const passers = results.filter((r) => r.passed === true);
  for (const r of passers) passersByVerdict[r.verdict]++;
  const sources = new Set(results.map((r) => r.passedFrom).filter(Boolean));
  const lucky = passers.filter((r) => r.verdict === "likely_luck");
  const holds = passers.filter((r) => r.verdict === "holds_up");
  const labels = ruleLabels(opts);
  const rules: RuleRow[] = RULE_IDS.map((id) => ({
    id, label: labels[id],
    luckyCaught: lucky.filter((r) => r.rules[id] === true).length,
    holdsBlocked: holds.filter((r) => r.rules[id] === true).length,
    unknown: [...lucky, ...holds].filter((r) => r.rules[id] == null).length,
  }));
  const flagCounts = { loses: 0, fragile: 0, luck: 0 };
  for (const r of lucky) for (const f of r.flags) flagCounts[f]++;
  const judged = passersByVerdict.holds_up + passersByVerdict.likely_luck;
  return {
    version: SCREEN_VERSION, options: opts, accounts: results.length, counts,
    passers: passers.length, passersByVerdict,
    passedFrom: sources.size === 0 ? "none" : sources.size === 2 ? "mixed" : (sources.values().next().value as "file" | "rule"),
    luckyPasserShare: judged ? passersByVerdict.likely_luck / judged : null,
    rules,
    onlyLuckCheck: lucky.filter((r) => RULE_IDS.every((id) => !r.rules[id])).length,
    flagCounts,
  };
}

/** Scores every account, yielding to the page between chunks so a large batch does not freeze it. */
export async function screenBatch(
  accounts: readonly AccountInput[], opts: ScreenOptions = DEFAULT_OPTIONS,
  onProgress?: (done: number, total: number) => void, chunk = 25,
): Promise<AccountResult[]> {
  const out: AccountResult[] = [];
  for (let i = 0; i < accounts.length; i++) {
    out.push(scoreAccount(accounts[i], opts, accounts.length));
    if (onProgress && (i + 1) % chunk === 0) {
      onProgress(i + 1, accounts.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onProgress?.(accounts.length, accounts.length);
  return out;
}

/** The same, all at once, for the API and tests. */
export function screenSync(accounts: readonly AccountInput[], opts: ScreenOptions = DEFAULT_OPTIONS): AccountResult[] {
  return accounts.map((a) => scoreAccount(a, opts, accounts.length));
}
