// Card 5: overfitting flags (REF-0016). Signs a record was tuned to the past: too short,
// fading in its last part, made by a handful of trades, too many settings for the trades
// behind them, or a claim the file does not back.
import { daysBetween } from "../returns";
import { sharpe } from "../stats";
import type { Claim, Trade } from "../types";
import { NA, type CheckRow } from "./lookahead";

const pp = (v: number) => `${(v * 100).toFixed(1)}%`;

export function shortSampleCheck(trades: number | null, firstDate: string | null, lastDate: string | null): CheckRow {
  const label = "Short sample";
  const months = firstDate && lastDate ? daysBetween(firstDate, lastDate) / 30.44 : 0;
  if (!firstDate) return { id: "short", label, status: "na", detail: `${NA}: there are no dates.` };
  const fewTrades = trades != null && trades < 100;
  if (fewTrades || months < 12) {
    const why = [fewTrades ? `${trades} trades (100 is the line)` : "", months < 12 ? `${months.toFixed(1)} months (12 is the line)` : ""].filter(Boolean).join(" and ");
    return { id: "short", label, status: "fail", detail: `Only ${why}. A short record can look good by chance.` };
  }
  return { id: "short", label, status: "pass", detail: `${trades != null ? `${trades.toLocaleString("en-US")} trades over ` : ""}${months.toFixed(0)} months.` };
}

/** Sharpe in the last 30% of the record below half the Sharpe of the first 70%. */
export function fadeCheck(returns: readonly number[]): CheckRow {
  const label = "First part against last part";
  const cut = Math.floor(returns.length * 0.7);
  if (cut < 20 || returns.length - cut < 10) return { id: "fade", label, status: "na", detail: `${NA}: it needs at least 30 returns.` };
  const a = sharpe(returns.slice(0, cut)), b = sharpe(returns.slice(cut));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { id: "fade", label, status: "na", detail: `${NA}: one part has no ups and downs.` };
  if (a > 0 && b < a / 2) return { id: "fade", label, status: "fail", detail: `The last 30% earned ${(b / a * 100).toFixed(0)}% as much per unit of risk as the first 70% (Sharpe ${b.toFixed(3)} against ${a.toFixed(3)} per period). Results that fade like this are often tuned to the early data.` };
  return { id: "fade", label, status: "pass", detail: `Sharpe per period: ${a.toFixed(3)} in the first 70%, ${b.toFixed(3)} in the last 30%.` };
}

/** The best 5 trades make more than half of the total profit. */
export function concentrationCheck(trades: readonly Trade[]): CheckRow {
  const label = "Concentration";
  if (trades.length < 10) return { id: "conc", label, status: "na", detail: `${NA}: it needs at least 10 trades.` };
  const total = trades.reduce((s, t) => s + t.pnl, 0);
  if (!(total > 0)) return { id: "conc", label, status: "na", detail: `${NA}: there is no overall profit to be concentrated.` };
  const best = [...trades].map((t) => t.pnl).sort((a, b) => b - a).slice(0, 5).reduce((s, v) => s + v, 0);
  const share = best / total;
  return share > 0.5
    ? { id: "conc", label, status: "fail", detail: `The best 5 trades made ${pp(share)} of all the profit. Take them away and little is left.` }
    : { id: "conc", label, status: "pass", detail: `The best 5 trades made ${pp(share)} of the profit (50% is the line).` };
}

/** Input B: more than one adjustable setting per 20 trades. */
export function settingsCheck(settings: number | null, trades: number | null): CheckRow {
  const label = "Many settings, few trades";
  if (settings == null || trades == null) return { id: "settings", label, status: "na", detail: `${NA}: it needs a description with its rules and a number of trades.` };
  return settings > trades / 20
    ? { id: "settings", label, status: "fail", detail: `${settings} adjustable settings for ${trades} trades: more than one setting per 20 trades, so the rules can be bent to fit almost any past.` }
    : { id: "settings", label, status: "pass", detail: `${settings} adjustable settings for ${trades} trades (one per 20 trades is the line).` };
}

export interface FileFacts { winRate: number | null; monthlyReturn: number | null; maxDrawdown: number | null }

/** The claimed win rate, monthly return or drawdown is more than 5 percentage points from the file. */
export function claimCheck(claim: Claim, file: FileFacts): CheckRow & { contradicted: string[] } {
  const label = "Claim against file";
  const pairs: [string, number | undefined, number | null][] = [
    ["win rate", claim.winRate, file.winRate],
    ["monthly return", claim.monthlyReturn, file.monthlyReturn],
    ["largest fall from a high", claim.maxDrawdown, file.maxDrawdown],
  ];
  const given = pairs.filter(([, c]) => c != null);
  if (!given.length) return { id: "claim", label, status: "na", detail: `${NA}: no claim was entered.`, contradicted: [] };
  const off: string[] = [], ok: string[] = [], unknown: string[] = [];
  for (const [name, c, f] of given) {
    if (f == null) { unknown.push(name); continue; }
    const gap = Math.abs(c! - f);
    (gap > 0.05 ? off : ok).push(`${name}: claimed ${pp(c!)}, file ${pp(f)}`);
  }
  if (off.length) return { id: "claim", label, status: "fail", detail: `The file does not back the claim. ${off.join("; ")} (more than 5 points apart).`, contradicted: off };
  if (!ok.length) return { id: "claim", label, status: "na", detail: `${NA}: the file cannot show the claimed ${unknown.join(" or ")} without a starting balance.`, contradicted: [] };
  return { id: "claim", label, status: "pass", detail: `${ok.join("; ")}: within 5 points.${unknown.length ? ` The ${unknown.join(" and ")} could not be compared.` : ""}`, contradicted: [] };
}
