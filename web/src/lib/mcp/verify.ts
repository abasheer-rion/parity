// Verify for AI apps and programs (DEC-0082): verify_trades, verify_strategy and verify_claim,
// shared by the hosted MCP server (tools.ts) and the public API (/api/v1/verify/...). Each one
// runs the same checks as the Verify page (REF-0016) in memory. Nothing sent is stored.
// verify_record and verify_description stay as aliases so existing connections keep working.
// No import.meta.env here: Pages Functions import this file.
import type { Report } from "../types";
import type { SearchDoc } from "../data";
import { nameOf, searchTextOf, tagsOf } from "../strategyMeta";
import { tagline } from "../strategyNames";
import { checkDescription, checkFile, checkStrategy, claimRows, NA, survivesText, type ClaimRow, type Result } from "../verify/checks";
import { closest, extract, searchVerdict, type Candidate } from "../verify/describe";
import { priceBook, type PriceBook } from "../verify/prices";
import type { Claim, EquityPoint, InputKind, Parsed, Trade } from "../verify/types";
import type { Schema } from "./schema";
import type { Tool, ToolContext } from "./tools";
import { NOTE, ToolError } from "./common";

/** Most trades or equity points in one call (DEC-0071, API4). */
export const MAX_ROWS = 5000;

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const READ = (title: string) => ({ title, readOnlyHint: true, openWorldHint: false });

/** Numbers to 6 significant figures, so answers stay short. Whole numbers are left alone. */
export function tidy(v: unknown): unknown {
  if (typeof v === "number") return Number.isFinite(v) ? (Number.isInteger(v) ? v : Number(v.toPrecision(6))) : null;
  if (Array.isArray(v)) return v.map(tidy);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tidy(x)]));
  return v;
}

// ---------------------------------------------------------------------------- input

export const claimSchema: Schema = {
  type: "object",
  description: "What was claimed, for example on a seller's page. Rates and returns are fractions: 0.92 means 92%, 0.05 means 5%. Example: {\"winRate\": 0.92, \"takeProfit\": 0.05, \"monthlyReturn\": 0.12, \"maxDrawdown\": 0.08}.",
  properties: {
    winRate: { type: "number", minimum: 0, maximum: 1, description: "Share of trades that win. 0.92 for 92%." },
    monthlyReturn: { type: "number", minimum: -1, maximum: 100, description: "Average return a month. 0.1 for 10%." },
    maxDrawdown: { type: "number", minimum: 0, maximum: 1, description: "Largest fall from a high, as a share of the account. 0.08 for 8%." },
    takeProfit: { type: "number", minimum: 0, maximum: 10, description: "Take-profit as a share of the position. 0.05 for 5%." },
    stopLoss: { type: "number", minimum: 0, maximum: 10, description: "Stop-loss as a share of the position. Leave out when there is no stop." },
    avgLoss: { type: "number", minimum: 0, maximum: 10, description: "Average losing trade as a share of the position." },
    maxLoss: { type: "number", minimum: 0, maximum: 1, description: "Largest single loss as a share of the account." },
    tradesPerMonth: { type: "number", minimum: 0, maximum: 100000 },
    trades: { type: "integer", minimum: 0, maximum: 10000000, description: "Trades in the record the claim is about." },
    months: { type: "number", minimum: 0, maximum: 1200, description: "How long the claimed results ran, in months." },
    leverage: { type: "number", minimum: 0, maximum: 10000 },
    grid: { type: "boolean", description: "True for a grid bot." },
    martingale: { type: "boolean", description: "True when it adds to losing positions or doubles size after a loss." },
    maxLossCapped: { type: "boolean", description: "True when the seller states a hard cap on the total loss." },
  },
  additionalProperties: false,
};

export function toClaim(v: unknown): Claim {
  const out: Claim = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x === "number" || typeof x === "boolean") (out as Record<string, unknown>)[k] = x;
  }
  return out;
}

const isoTime = (s: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s.replace(" ", "T").slice(0, 19));

export function toTrades(raw: unknown[]): Trade[] {
  return raw.map((x) => {
    const t = x as Record<string, unknown>;
    const trade: Trade = { closeTime: isoTime(str(t.close_time)), pnl: Number(t.pnl), fees: typeof t.fees === "number" ? t.fees : 0 };
    if (typeof t.open_time === "string") trade.openTime = isoTime(t.open_time);
    if (typeof t.symbol === "string") trade.symbol = t.symbol;
    if (t.side === "buy" || t.side === "sell") trade.side = t.side;
    for (const k of ["size", "entry", "exit"] as const) if (typeof t[k] === "number") trade[k] = t[k] as number;
    return trade;
  }).sort((a, b) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0));
}

const tradesSchema: Schema = {
  type: "array", maxItems: MAX_ROWS, description: `Closed trades, any order, at most ${MAX_ROWS}. Each needs close_time and pnl. Example item: {"close_time": "2026-03-02", "pnl": 41.5, "symbol": "EURUSD", "side": "buy"}.`,
  items: {
    type: "object",
    properties: {
      close_time: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}", description: "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS" },
      pnl: { type: "number", description: "Profit after fees, in the account's money. Negative for a loss." },
      fees: { type: "number", description: "Commission and swap, as a cost." },
      open_time: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}" },
      symbol: { type: "string", maxLength: 40 }, side: { type: "string", enum: ["buy", "sell"] },
      size: { type: "number" }, entry: { type: "number", description: "Entry price. With exit and symbol, lets Verify check fills against the day's range." },
      exit: { type: "number" },
    },
    required: ["close_time", "pnl"],
  },
};

const equitySchema: Schema = {
  type: "array", maxItems: MAX_ROWS, description: `Account value by date, oldest first, at most ${MAX_ROWS} points. Use instead of trades. Example item: {"date": "2026-03-02", "equity": 10412.5}.`,
  items: {
    type: "object",
    properties: {
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      equity: { type: "number" },
      cashflow: { type: "number", description: "Money paid in (positive) or taken out (negative) that day." },
    },
    required: ["date", "equity"],
  },
};

// ---------------------------------------------------------------------------- output

const methodology = (ctx: Pick<ToolContext, "origin">) => `${ctx.origin}/methodology/`;

/** The checks this input could not run, and why, in words. */
function cannotCheck(r: Result): { check: string; why: string }[] {
  const out: { check: string; why: string }[] = [];
  if (!r.card1) out.push({ check: "Profit per trade", why: "The record has no trades or returns to average." });
  if (!r.card3) out.push({ check: "Luck check", why: "It needs at least 30 returns, or a trade list." });
  for (const row of [...r.card4, ...r.card5]) {
    if (row.status === "na") out.push({ check: row.label, why: row.detail.replace(`${NA}: `, "").replace(/^./, (c) => c.toUpperCase()) });
  }
  return out;
}

/** The full answer for a record or one of our strategies: verdict, sentence, five cards and limits. */
export function fullResult(r: Result, ctx: Pick<ToolContext, "origin">) {
  const survives = r.card3 ? r.card3.survives : null;
  return tidy({
    verdict: r.verdict,
    sentence: r.verdict.sentence,
    survives_up_to_tries: survives,
    survives: survivesText(survives),
    what: r.what, kind: r.kind, tries: r.tries, tries_defaulted: r.triesDefaulted, method_version: r.methodVersion,
    date_from: r.dateFrom, date_to: r.dateTo, trades: r.trades, starting_balance: r.balance,
    profit_per_trade: r.card1, worst_losses: r.card2, luck_check: r.card3,
    signs_of_peeking_or_editing: r.card4, signs_of_tuning: r.card5, claim_arithmetic: r.claims,
    could_not_check: cannotCheck(r),
    notes: r.notes,
    methodology: methodology(ctx),
    note: NOTE,
  }) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------- verify_trades

async function runTrades(a: Record<string, unknown>, ctx: ToolContext) {
  const trades = Array.isArray(a.trades) && a.trades.length ? toTrades(a.trades) : undefined;
  const equity = !trades && Array.isArray(a.equity) && a.equity.length
    ? (a.equity as Record<string, unknown>[]).map((p): EquityPoint => ({ date: str(p.date), equity: Number(p.equity), ...(typeof p.cashflow === "number" ? { cashflow: p.cashflow } : {}) }))
    : undefined;
  if (!trades && !equity) throw new ToolError("Give trades (each with close_time and pnl) or equity (each with date and equity).");
  const parsed: Parsed = {
    format: trades ? "trades" : "equity", table: { headers: [], rows: [] }, mapping: {}, dropped: [],
    trades, equity, warnings: [], backtestExport: false,
  };
  const doc = trades ? await ctx.data.json<Parameters<typeof priceBook>[0]>("/data/verify/prices.json").catch(() => null) : null;
  const prices: PriceBook | null = doc ? priceBook(doc) : null;
  const tries = typeof a.tries === "number" && Number.isFinite(a.tries) ? Math.max(1, Math.round(a.tries)) : 1;
  const balance = typeof a.starting_balance === "number" && a.starting_balance > 0 ? a.starting_balance : null;
  const result = checkFile({
    parsed, prices, triesDefaulted: a.tries == null,
    answers: { kind: str(a.kind) as InputKind, balance, tries, claim: toClaim(a.claim), noCashflows: true },
  });
  return fullResult(result, ctx);
}

const tradesInput: Tool["inputSchema"] = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["real", "demo", "backtest"], description: "Real money, a demo account, or a backtest." },
    trades: tradesSchema,
    equity: equitySchema,
    starting_balance: { type: "number", minimum: 0, maximum: 1e12, description: "The account's starting value. Needed to turn a trade list into returns, the largest fall and the luck check on returns." },
    tries: { type: "integer", minimum: 1, maximum: 10000000, description: "How many strategies, bots or settings were tried before this one, counting this one. Ask the person; if they tried 12 settings, send 12. Default 1, which is the most generous to the record." },
    claim: claimSchema,
  },
  required: ["kind"],
  additionalProperties: false,
};

export const verifyTrades: Tool = {
  name: "verify_trades",
  title: "Verify a trade record",
  description: [
    "Runs Parity Verify on a trade list or an equity curve and says whether the record holds up.",
    "Returns a verdict (holds_up, could_be_luck, fragile, does_not_hold_up or not_enough_data), one sentence written from the numbers, five cards (profit_per_trade, worst_losses, luck_check, signs_of_peeking_or_editing, signs_of_tuning), how many tries the result survives (survives_up_to_tries), the method version, and could_not_check: the checks this input cannot run and why.",
    "Send trades (close_time and pnl each) or equity (date and equity each), kind, and tries: how many strategies, bots or settings were tried, counting this one. More tries make the luck check stricter, so ask the person.",
    "Add starting_balance for return-based checks and claim for what a seller says, to compare with the record.",
    "Example: {\"kind\": \"demo\", \"tries\": 12, \"starting_balance\": 10000, \"trades\": [{\"close_time\": \"2026-01-05\", \"pnl\": 120}, {\"close_time\": \"2026-01-06\", \"pnl\": -80}]}.",
    "Verify needs at least 30 trades or 60 daily values for a verdict other than not_enough_data. Runs in memory; nothing is stored. A check, not advice.",
  ].join(" "),
  inputSchema: tradesInput,
  annotations: READ("Verify a trade record"),
  run: runTrades,
};

// ---------------------------------------------------------------------------- verify_strategy

const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");

/** Candidates for "the closest tested strategies": named strategies and search variations. */
export function candidatesFrom(report: Report | null, search: SearchDoc | null): Candidate[] {
  const out: Candidate[] = [];
  for (const r of report?.runs ?? []) {
    if (r.is_benchmark) continue;
    const t = tagsOf(r);
    out.push({ id: r.strategy, name: nameOf(r), line: r.description ?? r.summary, family: t.family, asset: t.asset, style: t.style, from: "report",
      verdict: r.gauntlet?.verdict ?? "Not yet run through our tests", deflated: r.metrics.deflated_sharpe, sharpe: r.metrics.sharpe });
  }
  for (const s of search?.rows ?? []) {
    out.push({ id: s.id, name: s.name, line: s.line, family: s.family, asset: s.asset, style: s.style, from: "search", verdict: searchVerdict(s.deflated), deflated: s.deflated, sharpe: s.sharpe });
  }
  return out;
}

async function research(ctx: ToolContext) {
  const [report, search] = await Promise.all([
    ctx.data.json<Report>("/data/latest.json"),
    ctx.data.json<SearchDoc>("/data/search.json").catch(() => null),
  ]);
  if (!report) throw new ToolError("No research run has been published yet.");
  return { report, search };
}

function findRun(report: Report, q: string) {
  const runs = report.runs.filter((r) => !r.is_benchmark && r.equity.length > 30);
  const n = norm(q);
  const exact = runs.find((r) => r.strategy === q) ?? runs.find((r) => norm(r.strategy) === n || norm(nameOf(r)) === n);
  if (exact) return exact;
  const words = q.toLowerCase().trim();
  const hits = runs.filter((r) => searchTextOf(r).toLowerCase().includes(words));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    throw new ToolError(`More than one tested strategy matches "${q}": ${hits.slice(0, 8).map((r) => `${nameOf(r)} (${r.strategy})`).join(", ")}. Send one id.`);
  }
  throw new ToolError(`No strategy matches "${q}". Call search_strategies for the ids, or send it as description to get the closest strategies we have tested.`);
}

async function runStrategy(a: Record<string, unknown>, ctx: ToolContext) {
  const name = str(a.strategy).trim(), text = str(a.description).trim();
  if (!name && !text) throw new ToolError("Give strategy (an id or name from our tested list, such as fx_carry or \"The Gambit\") or description (a rule set in words).");
  const { report, search } = await research(ctx);
  const tries = (search?.trials ?? 0) + report.n_trials;
  if (name) {
    const r = findRun(report, name);
    const result = checkStrategy({ name: nameOf(r), equity: r.equity, tries, asset: tagsOf(r).asset,
      gauntlet: r.gauntlet ? { verdict: r.gauntlet.verdict, passed: r.gauntlet.passed, total: r.gauntlet.total } : null, holdup: r.holdup });
    return {
      mode: "strategy",
      strategy: { id: r.strategy, name: nameOf(r), tagline: tagline(r.strategy) || null, url: `${ctx.origin}/app/#/strategy/${encodeURIComponent(r.strategy)}` },
      gauntlet: result.gauntlet ?? null,
      tries_counted: { research: report.n_trials, search: search?.trials ?? 0, total: tries },
      research_as_of: report.generated_at,
      ...fullResult(result, ctx),
    };
  }
  const x = extract(text);
  const limit = typeof a.limit === "number" ? Math.min(Math.max(Math.round(a.limit), 1), 10) : 3;
  const matches = closest(x, candidatesFrom(report, search), limit);
  return tidy({
    mode: "description",
    found_in_text: x.found,
    closest: matches.map((m) => ({
      id: m.c.id, name: m.c.name, from: m.c.from === "report" ? "tested strategy" : "strategy search variation",
      verdict: m.c.verdict, luck_check: m.c.deflated, sharpe: m.c.sharpe, why_close: m.why,
      verify_with: m.c.from === "report" ? { tool: "verify_strategy", strategy: m.c.id } : null,
    })),
    claim_arithmetic: claimRows(x.claim),
    tries_counted: { research: report.n_trials, search: search?.trials ?? 0, total: tries },
    research_as_of: report.generated_at,
    could_not_check: [{ check: "This rule set's own results", why: "A described rule set has not been backtested by Parity. These are the closest strategies we have tested. Send the rule set's trade log to verify_trades to check its record." }],
    methodology: methodology(ctx),
    note: NOTE,
  }) as Record<string, unknown>;
}

export const verifyStrategy: Tool = {
  name: "verify_strategy",
  title: "Verify a tested strategy",
  description: [
    "Runs Parity Verify on one of the strategies Parity has tested, using our research numbers and the real number of tries our research and strategy search have counted (thousands), so the luck check is as strict as it should be.",
    "Send strategy: an id or a name, such as \"fx_carry\" or \"The Gambit\". Returns the verdict, one sentence, the five cards, survives_up_to_tries, the gauntlet result (tests passed of 11), the method version and could_not_check.",
    "Or send description: a rule set in words, such as \"buys the highest-yielding currency and sells the lowest, rebalanced monthly\". Returns the closest strategies we have tested, each with its verdict and luck check, and an id to verify next. A description is not backtested.",
    "Use search_strategies to browse the ids. Runs in memory; nothing is stored. A check, not advice.",
  ].join(" "),
  inputSchema: {
    type: "object",
    properties: {
      strategy: { type: "string", minLength: 1, maxLength: 120, description: "An id or name from Parity's tested list, such as fx_carry or The Gambit." },
      description: { type: "string", minLength: 1, maxLength: 4000, description: "A rule set in words, when it is not one of ours. Returns the closest tested strategies." },
      limit: { type: "integer", minimum: 1, maximum: 10, description: "How many close strategies to return for a description (default 3)." },
    },
    additionalProperties: false,
  },
  annotations: READ("Verify a tested strategy"),
  run: runStrategy,
};

// ---------------------------------------------------------------------------- verify_claim

type ClaimWord = "impossible" | "needs_more_data" | "loss_not_capped" | "adds_up";
const claimWord = (c: ClaimRow): ClaimWord =>
  c.status === "fail" ? (c.id === "uncapped" ? "loss_not_capped" : "impossible") : c.status === "warn" ? "needs_more_data" : "adds_up";

async function runClaim(a: Record<string, unknown>, ctx: ToolContext, strict = true) {
  const text = str(a.text).trim();
  if (strict && !text && !Object.keys(toClaim(a.claim)).length) {
    throw new ToolError("Nothing to check. Give text (the seller's words) or claim fields such as {\"winRate\": 0.92, \"takeProfit\": 0.05}.");
  }
  const x = text ? extract(text) : null;
  // Fields sent by the caller win over what was read from the text.
  const found: Claim = {};
  for (const [k, v] of Object.entries(x?.claim ?? {})) if (v !== undefined) (found as Record<string, unknown>)[k] = v;
  const claim: Claim = { ...found, ...toClaim(a.claim) };
  const settings = typeof a.settings === "number" ? a.settings : x?.settings || null;
  const trades = typeof a.trades === "number" ? a.trades : x?.trades ?? null;
  const r = checkDescription({ text, claim, settings, trades });
  const claims = r.claims.map((c) => ({ id: c.id, status: claimWord(c), text: c.text }));
  return tidy({
    verdict: r.verdict,
    sentence: r.verdict.sentence,
    claims,
    impossible: claims.filter((c) => c.status === "impossible").length,
    needs_more_data: claims.filter((c) => c.status === "needs_more_data").length,
    claim_used: claim,
    found_in_text: x?.found ?? [],
    settings_check: r.card5[3],
    claim_arithmetic: r.claims,
    signs_of_tuning: r.card5,
    could_not_check: [{ check: "Whether the claimed results happened", why: "A claim is not a record. Send the trade list or equity curve to verify_trades to check it." }],
    method_version: r.methodVersion,
    notes: r.notes,
    methodology: methodology(ctx),
    note: NOTE,
  }) as Record<string, unknown>;
}

export const verifyClaim: Tool = {
  name: "verify_claim",
  title: "Check a seller's claim",
  description: [
    "Checks the arithmetic of a trading claim, such as a bot or signal seller's page, and says which claims are impossible and which need more data before anyone could believe them.",
    "Send text (the seller's words), claim fields, or both; fields win over the text. Rates are fractions: 0.92 means 92%.",
    "Example: {\"text\": \"92% win rate, 5% take-profit, no stop loss\"} or {\"claim\": {\"winRate\": 0.92, \"takeProfit\": 0.05}}.",
    "Returns a verdict, one sentence, and claims, each marked impossible, needs_more_data, loss_not_capped or adds_up with the sums in words (for example the average loss a win rate and take-profit can afford), plus what was read from the text.",
    "A claim cannot show an edge; this only catches numbers that fail on their own. To check the record behind a claim, use verify_trades. Runs in memory; nothing is stored. A check, not advice.",
  ].join(" "),
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", minLength: 1, maxLength: 4000, description: "The claim in the seller's words. Win rate, take-profit, stop, monthly return, drawdown, trades a month, grid or martingale are read from it." },
      claim: claimSchema,
      settings: { type: "integer", minimum: 0, maximum: 10000, description: "How many adjustable settings the rules have, when known." },
      trades: { type: "integer", minimum: 0, maximum: 10000000, description: "How many trades the claimed record has, when known." },
    },
    additionalProperties: false,
  },
  annotations: READ("Check a seller's claim"),
  run: (a, ctx) => runClaim(a, ctx),
};

// ---------------------------------------------------------------------------- aliases

export const verifyRecordAlias: Tool = {
  ...verifyTrades,
  name: "verify_record",
  title: "Verify a trade record (old name)",
  description: "Deprecated: use verify_trades, which takes the same input and returns the same answer. Kept so existing connections keep working. Runs Parity Verify on a trade list or equity curve: give kind, and trades (close_time and pnl each) or equity (date and equity each).",
  annotations: READ("Verify a trade record (old name)"),
};

export const verifyDescriptionAlias: Tool = {
  name: "verify_description",
  title: "Check a described bot (old name)",
  description: "Deprecated: use verify_claim, which returns the same answer. Kept so existing connections keep working. Checks a bot described in words, and any numbers claimed for it, for arithmetic that cannot hold.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", minLength: 1, maxLength: 4000, description: "The description, as written by the seller or author." },
      settings: { type: "integer", minimum: 0, maximum: 10000, description: "How many settings the bot has that were tuned." },
      trades: { type: "integer", minimum: 0, maximum: 10000000, description: "How many trades the record is said to have." },
      claim: claimSchema,
    },
    required: ["text"],
    additionalProperties: false,
  },
  annotations: READ("Check a described bot (old name)"),
  run: (a, ctx) => runClaim(a, ctx, false),
};

export const VERIFY_TOOLS: Tool[] = [verifyTrades, verifyStrategy, verifyClaim, verifyRecordAlias, verifyDescriptionAlias];
