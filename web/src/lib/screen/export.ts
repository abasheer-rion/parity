// The batch screen's results as a CSV file (DEC-0087), one row per account, for a firm's own
// spreadsheet or system. Text cells that a spreadsheet would run as a formula are prefixed
// with an apostrophe.
import type { AccountResult } from "./score";
import { SCREEN_VERSION } from "./score";

const COLUMNS: [string, (r: AccountResult) => string | number | boolean | null][] = [
  ["account", (r) => r.id],
  ["verdict", (r) => r.label],
  ["reason", (r) => r.reason],
  ["trades", (r) => r.trades],
  ["trading_days", (r) => r.days],
  ["starting_balance", (r) => r.balance],
  ["net_profit", (r) => round(r.netProfit, 2)],
  ["return_pct", (r) => round(r.returnPct * 100, 2)],
  ["win_rate_pct", (r) => (r.winRate == null ? null : round(r.winRate * 100, 1))],
  ["profit_per_trade", (r) => (r.expectancy == null ? null : round(r.expectancy, 2))],
  ["tries", (r) => r.tries],
  ["luck_check_deflated_sharpe", (r) => (r.dsr == null ? null : round(r.dsr, 4))],
  ["survives_up_to_tries", (r) => r.survives],
  ["max_drawdown_pct", (r) => (r.maxDrawdown == null ? null : round(r.maxDrawdown * 100, 2))],
  ["best_5_trades_share_pct", (r) => (r.top5Share == null ? null : round(r.top5Share * 100, 1))],
  ["best_day_share_pct", (r) => (r.bestDayShare == null ? null : round(r.bestDayShare * 100, 1))],
  ["size_grows_after_losses", (r) => r.sizeGrowth],
  ["passed", (r) => r.passed],
  ["passed_from", (r) => r.passedFrom],
  ["outcome", (r) => r.outcome],
  ["method", () => SCREEN_VERSION],
];

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

export function cell(v: string | number | boolean | null): string {
  if (v == null) return "";
  if (typeof v !== "string") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function resultsCsv(results: readonly AccountResult[]): string {
  const lines = [COLUMNS.map(([h]) => h).join(",")];
  for (const r of results) lines.push(COLUMNS.map(([, f]) => cell(f(r))).join(","));
  return `${lines.join("\n")}\n`;
}
