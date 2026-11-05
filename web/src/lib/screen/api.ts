// POST /api/v1/verify/batch (DEC-0087): the batch screen for firms with larger jobs or their
// own systems. Same code as the page (score.ts, backtest.ts). Runs in memory; nothing sent is
// stored or logged (the log line has the key id, path, status and time only).
import type { Schema } from "../mcp/schema";
import { toTrades } from "../mcp/verify";
import { backtest } from "./backtest";
import { DEFAULT_OPTIONS, SCREEN_VERSION, screenSync, summarise, type AccountInput, type ScreenOptions } from "./score";

export const BATCH_LIMITS = { accounts: 500, tradesPerAccount: 5_000, trades: 50_000, bytes: 5_000_000 };

const trade: Schema = {
  type: "object",
  properties: {
    close_time: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}", description: "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS" },
    pnl: { type: "number", description: "Profit after fees, in the account's money. Negative for a loss." },
    fees: { type: "number" },
    open_time: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}" },
    symbol: { type: "string", maxLength: 40 },
    side: { type: "string", enum: ["buy", "sell"] },
    size: { type: "number", description: "Position size. With it the screen can tell whether size grows after losses." },
    entry: { type: "number" },
    exit: { type: "number" },
  },
  required: ["close_time", "pnl"],
};

export const batchSchema: Schema = {
  type: "object",
  properties: {
    accounts: {
      type: "array", minItems: 1, maxItems: BATCH_LIMITS.accounts,
      description: `Challenge accounts, at most ${BATCH_LIMITS.accounts} a request and ${BATCH_LIMITS.trades.toLocaleString("en-US")} trades in all. Send larger batches in pages.`,
      items: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1, maxLength: 80, description: "Your id for the account. Returned as sent." },
          trades: { type: "array", minItems: 1, maxItems: BATCH_LIMITS.tradesPerAccount, items: trade },
          starting_balance: { type: "number", minimum: 0, maximum: 1e12 },
          tries: { type: "integer", minimum: 1, maximum: 100000, description: "Challenge attempts or other tries behind this record, counting this one. Default 1." },
          passed: { type: "boolean", description: "Whether the account passed. Left out, the target and loss limit decide." },
          outcome: { type: "string", enum: ["payout", "blowup"], description: "What happened later, when known. With outcomes the answer includes a back-test of the screen." },
        },
        required: ["id", "trades"],
        additionalProperties: false,
      },
    },
    options: {
      type: "object",
      properties: {
        starting_balance: { type: "number", minimum: 1, maximum: 1e12, description: "For accounts without one. Default 100000." },
        profit_target: { type: "number", minimum: 0.001, maximum: 10, description: "Share of the balance. Default 0.08." },
        max_loss: { type: "number", minimum: 0.001, maximum: 1, description: "Share of the balance. Default 0.10." },
        consistency_limit: { type: "number", minimum: 0.01, maximum: 1, description: "Best day's share of the profit for the consistency rule. Default 0.30." },
        min_days: { type: "integer", minimum: 0, maximum: 365, description: "Minimum trading days rule. Default 5." },
        count_batch_as_tries: { type: "boolean", description: "Strictest: multiply each account's tries by the number of accounts sent. Default false." },
      },
      additionalProperties: false,
    },
  },
  required: ["accounts"],
  additionalProperties: false,
};

export class BatchError extends Error {}

export function optionsFrom(o: Record<string, unknown> | undefined): ScreenOptions {
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    startingBalance: n(o?.starting_balance, DEFAULT_OPTIONS.startingBalance),
    profitTarget: n(o?.profit_target, DEFAULT_OPTIONS.profitTarget),
    maxLoss: n(o?.max_loss, DEFAULT_OPTIONS.maxLoss),
    consistencyLimit: n(o?.consistency_limit, DEFAULT_OPTIONS.consistencyLimit),
    minDays: n(o?.min_days, DEFAULT_OPTIONS.minDays),
    countBatchAsTries: o?.count_batch_as_tries === true,
  };
}

const r4 = (v: number | null) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10_000) / 10_000);

/** Runs the screen on a body already checked against batchSchema. */
export function runBatch(body: Record<string, unknown>, methodology: string) {
  const raw = body.accounts as Record<string, unknown>[];
  const total = raw.reduce((s, a) => s + (a.trades as unknown[]).length, 0);
  if (total > BATCH_LIMITS.trades) throw new BatchError(`${total.toLocaleString("en-US")} trades in one request. At most ${BATCH_LIMITS.trades.toLocaleString("en-US")}: send the batch in pages.`);
  const ids = new Set<string>();
  const accounts: AccountInput[] = raw.map((a) => {
    const id = String(a.id);
    if (ids.has(id)) throw new BatchError(`The id "${id.slice(0, 80)}" is sent twice. Each account needs its own id.`);
    ids.add(id);
    return {
      id, trades: toTrades(a.trades as unknown[]),
      balance: typeof a.starting_balance === "number" ? a.starting_balance : null,
      tries: typeof a.tries === "number" ? a.tries : null,
      passed: typeof a.passed === "boolean" ? a.passed : null,
      outcome: a.outcome === "payout" || a.outcome === "blowup" ? a.outcome : null,
    };
  });
  const opts = optionsFrom(body.options as Record<string, unknown> | undefined);
  const results = screenSync(accounts, opts);
  const s = summarise(results, opts);
  const bt = backtest(results);
  return {
    method_version: SCREEN_VERSION,
    accounts: results.map((r) => ({
      id: r.id, verdict: r.verdict, label: r.label, reason: r.reason,
      trades: r.trades, trading_days: r.days, starting_balance: r.balance,
      net_profit: Math.round(r.netProfit * 100) / 100, return: r4(r.returnPct),
      win_rate: r4(r.winRate), profit_per_trade: r.expectancy == null ? null : Math.round(r.expectancy * 100) / 100,
      tries: r.tries, luck_check: r4(r.dsr), survives_up_to_tries: r.survives,
      max_drawdown: r4(r.maxDrawdown), best_5_trades_share: r4(r.top5Share), best_day_share: r4(r.bestDayShare),
      size_grows_after_losses: r.sizeGrowth, passed: r.passed, passed_from: r.passedFrom, outcome: r.outcome,
      firm_rules_hit: Object.entries(r.rules).filter(([, v]) => v === true).map(([k]) => k),
    })),
    summary: {
      accounts: s.accounts, verdicts: s.counts, passers: s.passers, passers_by_verdict: s.passersByVerdict,
      passed_from: s.passedFrom, lucky_passer_share: r4(s.luckyPasserShare),
      firm_rules: s.rules.map((x) => ({ id: x.id, label: x.label, lucky_passers_caught: x.luckyCaught, holds_up_passers_blocked: x.holdsBlocked, could_not_tell: x.unknown })),
      lucky_passers_no_firm_rule_catches: s.onlyLuckCheck,
      options: { starting_balance: opts.startingBalance, profit_target: opts.profitTarget, max_loss: opts.maxLoss, consistency_limit: opts.consistencyLimit, min_days: opts.minDays, count_batch_as_tries: opts.countBatchAsTries },
    },
    backtest: bt && {
      judged_with_outcome: bt.n,
      table: { likely_luck_blew_up: bt.tp, likely_luck_paid_out: bt.fp, holds_up_blew_up: bt.fn, holds_up_paid_out: bt.tn },
      hit_rate: { value: r4(bt.hitRate.p), low: r4(bt.hitRate.lo), high: r4(bt.hitRate.hi), what: "Of accounts flagged likely luck, the share that later blew up (95% Wilson interval)." },
      false_alarms: { value: r4(bt.falseAlarms.p), low: r4(bt.falseAlarms.lo), high: r4(bt.falseAlarms.hi), what: "Of accounts that went on to a payout, the share flagged likely luck." },
      caught: { value: r4(bt.caught.p), low: r4(bt.caught.lo), high: r4(bt.caught.hi), what: "Of accounts that blew up, the share flagged likely luck." },
      holds_up_blowup_rate: { value: r4(bt.holdsBlowup.p), low: r4(bt.holdsBlowup.lo), high: r4(bt.holdsBlowup.hi) },
      gap: { value: r4(bt.gap.d), low: r4(bt.gap.lo), high: r4(bt.gap.hi), what: "Blow-up rate of likely luck minus that of holds up (Newcombe interval)." },
      not_enough_trades: { accounts: bt.notEnough.n, blew_up: bt.notEnough.k },
      small_sample: bt.small,
    },
    stored: false,
    methodology,
    note: "Research only, not investment advice. A verdict is about the record, not about the trader's future. Nothing sent is stored.",
  };
}
