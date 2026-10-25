// The tools the hosted MCP server offers AI apps (DEC-0051). Each reads the same files the
// signed-in site reads (/data/..., published by the deploy job) or the person's own rows in
// Supabase with their own token, so an app sees exactly what the person could see. The two
// tools that change anything are marked write: they are off unless the server flag is on AND
// the person allowed that app to make changes (ai_grants), and the database checks the grant
// again. Nothing here reads import.meta.env: Pages Functions import this file.
import type { McpCaller } from "./auth";
import { loadCourses, type McpCourse } from "./academy";
import type { Schema } from "./schema";
import type { Report, StrategyRun } from "../types";
import type { SearchDoc } from "../data";
import type { TermIndex, TermSeries } from "../../terminal/data";
import type { ImpactDoc, RankRow } from "../newsImpact";
import { evidenceWord } from "../newsImpact";
import { checkDescription, checkFile } from "../verify/checks";
import { priceBook, type PriceBook } from "../verify/prices";
import type { Claim, EquityPoint, InputKind, Parsed, Trade } from "../verify/types";

export const NOTE = "Research only, not investment advice.";

/** Static files published with the site, read without going back through the network. */
export interface Data { json<T>(path: string): Promise<T | null> }

/** The person's rows in Supabase, read and written with their own token. */
export interface Db {
  select<T>(table: string, query: string): Promise<T[]>;
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T>;
}

export interface ToolContext { caller: McpCaller; data: Data; db: Db; origin: string; now: Date }

/** A problem the AI app should read and fix (bad input, nothing found). Not a server fault. */
export class ToolError extends Error {}

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Schema & { type: "object" };
  annotations: { title: string; readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint: boolean };
  write?: boolean;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

// ---------------------------------------------------------------------------- helpers

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const int = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d);
const round = (v: number | null | undefined, d = 4): number | null => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));
const has = (hay: (string | undefined | null)[], needle: string) => hay.some((h) => (h ?? "").toLowerCase().includes(needle));

/** At most n points, evenly spaced, always keeping the last one. */
export function thin<T>(points: T[], n: number): T[] {
  if (points.length <= n) return points;
  const step = points.length / n;
  const out: T[] = [];
  for (let i = 0; i < n - 1; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

async function report(ctx: ToolContext): Promise<Report> {
  const r = await ctx.data.json<Report>("/data/latest.json");
  if (!r) throw new ToolError("No research run has been published yet.");
  return r;
}

async function termIndex(ctx: ToolContext): Promise<TermIndex> {
  const t = await ctx.data.json<TermIndex>("/data/terminal/index.json");
  if (!t) throw new ToolError("The market data has not been published yet.");
  return t;
}

const runName = (r: StrategyRun) => r.display_name || r.strategy;

function runSummary(r: StrategyRun) {
  return {
    id: r.strategy,
    name: runName(r),
    benchmark: r.is_benchmark,
    tags: r.tags ?? null,
    verdict: r.gauntlet?.verdict ?? null,
    tests_passed: r.gauntlet ? `${r.gauntlet.passed} of ${r.gauntlet.total}` : null,
    beats_sp500: r.gauntlet?.beats_sp500 ?? null,
    years: round(r.metrics.years, 1),
    cagr: round(r.metrics.cagr),
    sharpe: round(r.metrics.sharpe, 2),
    max_drawdown: round(r.metrics.max_drawdown),
    deflated_sharpe: round(r.metrics.deflated_sharpe, 3),
  };
}

const strategyUrl = (origin: string, id: string) => `${origin}/app/#/strategy/${encodeURIComponent(id)}`;
const lessonUrl = (origin: string, course: string, lesson: string) => `${origin}/learn/academy/${course}/${lesson}/`;

async function courses(ctx: ToolContext): Promise<McpCourse[]> {
  const list = await loadCourses(ctx.data);
  if (!list.length) throw new ToolError("The Academy lessons have not been published yet.");
  return list;
}

async function findLesson(ctx: ToolContext, course: string, lesson: string) {
  const c = (await courses(ctx)).find((x) => x.id === course);
  const l = c?.lessons.find((x) => x.id === lesson);
  if (!c || !l) throw new ToolError(`No lesson ${course}/${lesson}. Call list_academy_lessons for the ids.`);
  return { c, l };
}

function seriesRow(s: TermSeries) {
  return {
    key: s.key, name: s.label, short: s.short, class: s.class, unit: s.unit, frequency: s.freq,
    first: s.first, as_of: s.asof, last: s.last, change_1w: round(s.chg?.w1 ?? null), change_1m: round(s.chg?.m1 ?? null),
    source: s.source, licence: s.licence,
  };
}

// ---------------------------------------------------------------------------- Verify input

const claimSchema: Schema = {
  type: "object",
  description: "What was claimed, for example on a seller's page. Rates are fractions: 0.92 means 92%.",
  properties: {
    winRate: { type: "number", minimum: 0, maximum: 1 },
    monthlyReturn: { type: "number", minimum: -1, maximum: 100 },
    maxDrawdown: { type: "number", minimum: 0, maximum: 1 },
    takeProfit: { type: "number", minimum: 0, maximum: 10 },
    stopLoss: { type: "number", minimum: 0, maximum: 10 },
    maxLoss: { type: "number", minimum: 0, maximum: 1 },
    tradesPerMonth: { type: "number", minimum: 0, maximum: 100000 },
    trades: { type: "integer", minimum: 0, maximum: 10000000 },
    months: { type: "number", minimum: 0, maximum: 1200 },
    leverage: { type: "number", minimum: 0, maximum: 10000 },
    grid: { type: "boolean" },
    martingale: { type: "boolean" },
    maxLossCapped: { type: "boolean" },
  },
  additionalProperties: false,
};

function toClaim(v: unknown): Claim {
  const out: Claim = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x === "number" || typeof x === "boolean") (out as Record<string, unknown>)[k] = x;
  }
  return out;
}

const isoTime = (s: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s.replace(" ", "T").slice(0, 19));

function toTrades(raw: unknown[]): Trade[] {
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

function compactResult(r: ReturnType<typeof checkFile>) {
  return {
    verdict: r.verdict,
    what: r.what, kind: r.kind, tries: r.tries, method_version: r.methodVersion,
    date_from: r.dateFrom, date_to: r.dateTo, trades: r.trades, starting_balance: r.balance,
    profit_per_trade: r.card1, worst_losses: r.card2, luck_check: r.card3,
    signs_of_peeking_or_editing: r.card4, signs_of_tuning: r.card5, claim_arithmetic: r.claims,
    notes: r.notes,
  };
}

// ---------------------------------------------------------------------------- the tools

const READ = (title: string) => ({ title, readOnlyHint: true, openWorldHint: false });

export const TOOLS: Tool[] = [
  {
    name: "search_strategies",
    title: "Search tested strategies",
    description: "Find strategies Parity has tested against the S&P 500, with each one's verdict from the 11-test gauntlet and key numbers (CAGR, Sharpe, worst fall, deflated Sharpe). Use get_strategy for the full results of one.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 100, description: "Words to match in the name, description or tags, such as carry, trend or oil." },
        asset: { type: "string", maxLength: 40, description: "Only strategies on this asset tag, such as fx or equities." },
        beats_sp500: { type: "boolean", description: "Only strategies that do (true) or do not (false) beat the S&P 500 in the gauntlet." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Most rows to return (default 20)." },
      },
      additionalProperties: false,
    },
    annotations: READ("Search tested strategies"),
    async run(a, ctx) {
      const r = await report(ctx);
      const q = str(a.query).toLowerCase().trim();
      const asset = str(a.asset).toLowerCase();
      const rows = r.runs.filter((run) =>
        (!q || has([run.strategy, run.display_name, run.description, run.summary, ...Object.values(run.tags ?? {})], q))
        && (!asset || (run.tags?.asset ?? "").toLowerCase() === asset)
        && (typeof a.beats_sp500 !== "boolean" || (run.gauntlet?.beats_sp500 ?? false) === a.beats_sp500));
      return {
        generated_at: r.generated_at, total_trials: r.n_trials, matches: rows.length,
        strategies: rows.slice(0, int(a.limit, 20)).map(runSummary), note: NOTE,
      };
    },
  },
  {
    name: "get_strategy",
    title: "Get one strategy's results",
    description: "Full results for one tested strategy: what it does, its settings, its numbers against the S&P 500, each of the 11 gauntlet tests with its bar and value, yearly returns and a thinned equity curve.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", minLength: 1, maxLength: 120, description: "The strategy id from search_strategies." } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: READ("Get one strategy's results"),
    async run(a, ctx) {
      const r = await report(ctx);
      const run = r.runs.find((x) => x.strategy === a.id);
      if (!run) throw new ToolError(`No strategy with id ${str(a.id)}. Call search_strategies for the ids.`);
      return {
        ...runSummary(run),
        description: run.description ?? run.summary,
        reference_doc: run.reference,
        settings: run.params,
        metrics: run.metrics,
        gauntlet: run.gauntlet,
        yearly_returns: run.yearly,
        equity: thin(run.equity, 120),
        url: strategyUrl(ctx.origin, run.strategy),
        generated_at: r.generated_at,
        note: NOTE,
      };
    },
  },
  {
    name: "search_leads",
    title: "Strategy search leads",
    description: "The best variations found by Parity's always-on strategy search, with the luck check (deflated Sharpe) over every variation tried. Most leads fail once luck and costs are counted.",
    inputSchema: {
      type: "object",
      properties: {
        family: { type: "string", maxLength: 40, description: "Only this family, such as carry or trend." },
        asset: { type: "string", maxLength: 40 },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Most rows to return (default 15)." },
      },
      additionalProperties: false,
    },
    annotations: READ("Strategy search leads"),
    async run(a, ctx) {
      const s = await ctx.data.json<SearchDoc>("/data/search.json");
      if (!s) throw new ToolError("The strategy search has not published results yet.");
      const fam = str(a.family).toLowerCase(), asset = str(a.asset).toLowerCase();
      const rows = s.rows
        .filter((x) => (!fam || x.family.toLowerCase() === fam) && (!asset || x.asset.toLowerCase() === asset))
        .sort((x, y) => (y.deflated ?? -1) - (x.deflated ?? -1) || (y.sharpe ?? -9) - (x.sharpe ?? -9))
        .slice(0, int(a.limit, 15))
        .map((x) => ({ id: x.id, name: x.name, line: x.line, family: x.family, asset: x.asset, years: x.years, cagr: round(x.cagr), sharpe: round(x.sharpe, 2), max_drawdown: round(x.max_dd), breakeven_cost_bps: round(x.breakeven_bps, 1), beats_market: x.beats_market, deflated_sharpe: round(x.deflated, 3), spec: x.spec }));
      return { generated_at: s.generated_at, trials: s.trials, beat_market: s.beat_market, passed_luck_check: s.passed_luck_check, leads: rows, note: NOTE };
    },
  },
  {
    name: "verify_record",
    title: "Run Verify on a trading record",
    description: "Runs Parity Verify's checks on a trade list or an equity curve you supply: profit per trade, worst losses, a luck check that counts how many things were tried, signs of peeking or edited history, signs of tuning, and whether stated claims add up. The numbers are checked in memory and are not stored. Give trades (each with close_time and pnl) or equity (each with date and equity).",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["real", "demo", "backtest"], description: "Real money, a demo account, or a backtest." },
        trades: {
          type: "array", maxItems: 5000, description: "Closed trades, any order.",
          items: {
            type: "object",
            properties: {
              close_time: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}", description: "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS" },
              pnl: { type: "number", description: "Profit after fees, in the account's money." },
              fees: { type: "number" }, open_time: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}" },
              symbol: { type: "string", maxLength: 40 }, side: { type: "string", enum: ["buy", "sell"] },
              size: { type: "number" }, entry: { type: "number" }, exit: { type: "number" },
            },
            required: ["close_time", "pnl"],
          },
        },
        equity: {
          type: "array", maxItems: 5000, description: "Account value by date, oldest first.",
          items: { type: "object", properties: { date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, equity: { type: "number" }, cashflow: { type: "number" } }, required: ["date", "equity"] },
        },
        starting_balance: { type: "number", minimum: 0, maximum: 1e12, description: "Needed to turn a trade list into returns." },
        tries: { type: "integer", minimum: 1, maximum: 10000000, description: "How many strategies, bots or settings were tried before this one. Default 1." },
        claim: claimSchema,
      },
      required: ["kind"],
      additionalProperties: false,
    },
    annotations: READ("Run Verify on a trading record"),
    async run(a, ctx) {
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
      const tries = int(a.tries, 1);
      const balance = typeof a.starting_balance === "number" && a.starting_balance > 0 ? a.starting_balance : null;
      const result = checkFile({
        parsed, prices, triesDefaulted: a.tries == null,
        answers: { kind: str(a.kind) as InputKind, balance, tries, claim: toClaim(a.claim), noCashflows: true },
      });
      return { ...compactResult(result), note: NOTE };
    },
  },
  {
    name: "verify_description",
    title: "Run Verify on a described bot",
    description: "Checks a trading bot or signal described in words, and any numbers claimed for it, for arithmetic that cannot hold (for example a win rate and payoff that cannot make money, or an uncapped loss). A description cannot show an edge; this only catches claims that fail on their own numbers.",
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
    annotations: READ("Run Verify on a described bot"),
    async run(a) {
      const r = checkDescription({ text: str(a.text), claim: toClaim(a.claim), settings: typeof a.settings === "number" ? a.settings : null, trades: typeof a.trades === "number" ? a.trades : null });
      return { verdict: r.verdict, claim_arithmetic: r.claims, signs_of_tuning: r.card5, notes: r.notes, note: NOTE };
    },
  },
  {
    name: "list_market_series",
    title: "List market data series",
    description: "Market series Parity publishes (currencies, rates, commodities, stock indices, crypto and more): key, name, last value, recent change, as-of date, source and licence. Use get_market_series for the history of one.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 80, description: "Words to match in the key or name, such as EUR, oil or 10y." },
        class: { type: "string", maxLength: 40, description: "Only this class: fx, rates, commodities, equities, crypto, positioning or macro." },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Most rows to return (default 50)." },
      },
      additionalProperties: false,
    },
    annotations: READ("List market data series"),
    async run(a, ctx) {
      const t = await termIndex(ctx);
      const q = str(a.query).toLowerCase().trim(), cls = str(a.class).toLowerCase();
      const rows = t.series.filter((s) => (!q || has([s.key, s.label, s.short], q)) && (!cls || s.class === cls));
      return { data_through: t.data_through, matches: rows.length, series: rows.slice(0, int(a.limit, 50)).map(seriesRow), note: "Delayed, end-of-day data. " + NOTE };
    },
  },
  {
    name: "get_market_series",
    title: "Get a market series",
    description: "The history of one market series by key (from list_market_series), optionally between two dates, thinned to at most max_points points.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", minLength: 1, maxLength: 80 },
        from: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        to: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        max_points: { type: "integer", minimum: 10, maximum: 1000, description: "Default 300." },
      },
      required: ["key"],
      additionalProperties: false,
    },
    annotations: READ("Get a market series"),
    async run(a, ctx) {
      const t = await termIndex(ctx);
      const s = t.series.find((x) => x.key === a.key);
      if (!s) throw new ToolError(`No series with key ${str(a.key)}. Call list_market_series for the keys.`);
      // The file name comes from our own index, never from the caller.
      const doc = await ctx.data.json<{ points: [string, number | null][] }>(`/data/terminal/${s.file}`);
      if (!doc) throw new ToolError(`The file for ${s.short} is missing from the export.`);
      const from = str(a.from), to = str(a.to);
      const pts = doc.points.filter((p): p is [string, number] => p[1] != null && Number.isFinite(p[1]) && (!from || p[0] >= from) && (!to || p[0] <= to));
      return { ...seriesRow(s), points_in_range: pts.length, points: thin(pts, int(a.max_points, 300)), note: "Delayed, end-of-day data. " + NOTE };
    },
  },
  {
    name: "news_impact",
    title: "News impact",
    description: "What markets did after kinds of news, compared with random days. With a topic: which assets moved most after it. With an asset: which kinds of news came before its moves. With both: the detailed study at 1, 5 and 20 days. With neither: the topics and assets available. Evidence words account for how many comparisons were tried.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", maxLength: 60, description: "A topic id, such as opec or rate_hike." },
        asset: { type: "string", maxLength: 60, description: "An asset key from the list this tool returns with no arguments." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Most rows to return (default 15)." },
      },
      additionalProperties: false,
    },
    annotations: READ("News impact"),
    async run(a, ctx) {
      const doc = await ctx.data.json<ImpactDoc>("/data/news/impact.json");
      if (!doc) throw new ToolError("The news impact study has not been published yet.");
      const topic = str(a.topic), asset = str(a.asset), limit = int(a.limit, 15);
      const rank = (rows: RankRow[]) => rows.slice(0, limit).map((r) => ({ ...r, evidence: evidenceWord(r.q, r.n_events, doc.min_events) }));
      if (topic && asset) {
        const study = doc.studies[asset]?.[topic];
        if (!study) throw new ToolError(`No study for ${topic} on ${asset}. Call news_impact with no arguments for the ids.`);
        return { topic, asset, headlines: study.n_headlines, events: study.n_events, first: study.first, last: study.last, horizons: study.horizons, warnings: study.warnings, recent_events: (study.events ?? []).slice(-10), note: NOTE };
      }
      if (topic) {
        const r = doc.by_topic[topic];
        if (!r) throw new ToolError(`No topic ${topic}. Call news_impact with no arguments for the ids.`);
        return { topic, horizon: r.horizon, compared: r.tried, rows: rank(r.rows), warnings: r.warnings, note: NOTE };
      }
      if (asset) {
        const r = doc.by_asset[asset];
        if (!r) throw new ToolError(`No asset ${asset}. Call news_impact with no arguments for the keys.`);
        return { asset, horizon: r.horizon, compared: r.tried, rows: rank(r.rows), warnings: r.warnings, note: NOTE };
      }
      return { generated_at: doc.generated_at, horizons: doc.horizons, topics: doc.topics, assets: doc.assets.map((x) => ({ key: x.key, label: x.label, first: x.first, last: x.last })), note: NOTE };
    },
  },
  {
    name: "list_academy_lessons",
    title: "List Academy lessons",
    description: "Parity Academy's short courses and their lessons (reading a backtest, luck and skill, how markets move, currencies, rates, crypto and more), with ids for get_academy_lesson.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", maxLength: 80, description: "Words to match in a course or lesson title, or a lesson's terms." } },
      additionalProperties: false,
    },
    annotations: READ("List Academy lessons"),
    async run(a, ctx) {
      const q = str(a.query).toLowerCase().trim();
      const list = (await courses(ctx)).map((c) => ({
        id: c.id, title: c.title, level: c.level, summary: c.summary,
        lessons: c.lessons.filter((l) => !q || has([c.title, l.title, ...l.terms], q)).map((l) => ({ id: l.id, title: l.title, minutes: l.minutes, url: lessonUrl(ctx.origin, c.id, l.id) })),
      })).filter((c) => c.lessons.length);
      return { courses: list };
    },
  },
  {
    name: "get_academy_lesson",
    title: "Read an Academy lesson",
    description: "The text of one Academy lesson, its key terms and its quick-check questions with answers and reasons.",
    inputSchema: {
      type: "object",
      properties: { course: { type: "string", minLength: 1, maxLength: 80 }, lesson: { type: "string", minLength: 1, maxLength: 80 } },
      required: ["course", "lesson"],
      additionalProperties: false,
    },
    annotations: READ("Read an Academy lesson"),
    async run(a, ctx) {
      const { c, l } = await findLesson(ctx, str(a.course), str(a.lesson));
      return { course: c.title, id: l.id, title: l.title, minutes: l.minutes, text: l.body.join("\n\n"), terms: l.terms, check: l.check, url: lessonUrl(ctx.origin, c.id, l.id) };
    },
  },
  {
    name: "search",
    title: "Search Parity",
    description: "Search Parity's tested strategies, Academy lessons and market series. Returns ids to pass to fetch.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 200 } },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: READ("Search Parity"),
    async run(a, ctx) {
      const words = str(a.query).toLowerCase().split(/\s+/).filter((w) => w.length > 1);
      const hit = (hay: (string | undefined)[]) => words.length > 0 && words.some((w) => has(hay, w));
      const results: { id: string; title: string; url: string }[] = [];
      const r = await ctx.data.json<Report>("/data/latest.json");
      for (const run of r?.runs ?? []) if (hit([run.strategy, run.display_name, run.description, run.summary])) results.push({ id: `strategy:${run.strategy}`, title: `Strategy: ${runName(run)}`, url: strategyUrl(ctx.origin, run.strategy) });
      for (const c of await loadCourses(ctx.data)) for (const l of c.lessons) if (hit([c.title, l.title, ...l.terms])) results.push({ id: `lesson:${c.id}/${l.id}`, title: `Lesson: ${l.title}`, url: lessonUrl(ctx.origin, c.id, l.id) });
      const t = await ctx.data.json<TermIndex>("/data/terminal/index.json");
      for (const s of t?.series ?? []) if (hit([s.key, s.label])) results.push({ id: `series:${s.key}`, title: `Market series: ${s.label}`, url: `${ctx.origin}/trade/` });
      return { results: results.slice(0, 20) };
    },
  },
  {
    name: "fetch",
    title: "Fetch a Parity item",
    description: "The full text of an item found with search, by its id (strategy:..., lesson:.../..., or series:...).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", minLength: 3, maxLength: 200 } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: READ("Fetch a Parity item"),
    async run(a, ctx) {
      const id = str(a.id);
      const [kind, rest] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
      if (kind === "strategy") {
        const s = (await byName("get_strategy").run({ id: rest }, ctx)) as Record<string, unknown>;
        return { id, title: String(s.name), text: JSON.stringify(s, null, 1), url: String(s.url), metadata: { kind } };
      }
      if (kind === "lesson") {
        const [course, lesson] = rest.split("/");
        const { c, l } = await findLesson(ctx, course ?? "", lesson ?? "");
        return { id, title: l.title, text: `${l.body.join("\n\n")}\n\nTerms: ${l.terms.join(", ")}`, url: lessonUrl(ctx.origin, c.id, l.id), metadata: { kind, course: c.title } };
      }
      if (kind === "series") {
        const s = (await byName("get_market_series").run({ key: rest, max_points: 250 }, ctx)) as Record<string, unknown>;
        return { id, title: String(s.name), text: JSON.stringify(s), url: `${ctx.origin}/trade/`, metadata: { kind } };
      }
      throw new ToolError("Unknown id. Use an id from search.");
    },
  },
  {
    name: "list_demo_accounts",
    title: "List my demo accounts",
    description: "Your Parity Trade demo accounts (virtual money, no real trading): id, name, cash and starting cash. Needed for place_demo_order.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: READ("List my demo accounts"),
    async run(_a, ctx) {
      const rows = await ctx.db.select<{ id: string; name: string; cash: number; starting_cash: number; created_at: string }>(
        "paper_accounts", "select=id,name,cash,starting_cash,created_at&order=created_at.asc&limit=20");
      return { accounts: rows, note: "Virtual money only. Open Parity Trade to see positions and fills." };
    },
  },
  {
    name: "place_demo_order",
    title: "Place a demo order",
    description: "Places a limit or stop order in one of your Parity Trade demo accounts (virtual money, delayed prices, no real trading). The order waits until Parity Trade checks it against new prices the next time you open it. Only works if you allowed this app to make changes in Parity.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", pattern: "^[0-9a-f-]{36}$", description: "From list_demo_accounts." },
        symbol: { type: "string", minLength: 1, maxLength: 64, description: "A market key from list_market_series, such as fx.EUR or crypto.BTC." },
        side: { type: "string", enum: ["buy", "sell"] },
        type: { type: "string", enum: ["limit", "stop"] },
        qty: { type: "number", minimum: 0.000001, maximum: 1000000000 },
        price: { type: "number", minimum: 0.0000001, description: "The limit or stop price." },
      },
      required: ["account_id", "symbol", "side", "type", "qty", "price"],
      additionalProperties: false,
    },
    annotations: { title: "Place a demo order", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    write: true,
    async run(a, ctx) {
      const t = await ctx.data.json<TermIndex>("/data/terminal/index.json");
      if (t && !t.series.some((s) => s.key === a.symbol)) throw new ToolError(`No market ${str(a.symbol)}. Call list_market_series for the keys.`);
      const res = await ctx.db.rpc<{ id: string; status: string; placed_on: string }>("mcp_place_demo_order", {
        p_account: a.account_id, p_symbol: a.symbol, p_side: a.side, p_type: a.type, p_qty: a.qty,
        p_limit_price: a.type === "limit" ? a.price : null, p_stop_price: a.type === "stop" ? a.price : null,
        p_placed_on: ctx.now.toISOString().slice(0, 10),
      });
      return { order: res, note: "Demo order with virtual money. It is checked against delayed daily prices when you open Parity Trade." };
    },
  },
  {
    name: "save_trade_layout",
    title: "Save a Trade layout",
    description: "Saves a named chart layout to your Parity Trade account: a 1, 2 or 4 chart grid with the markets and timeframe you choose. Open it from Layouts in Parity Trade. Only works if you allowed this app to make changes in Parity.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 60 },
        grid: { type: "integer", enum: [1, 2, 4] },
        symbols: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 64 }, description: "Market keys from list_market_series, one per chart." },
        timeframe: { type: "string", enum: ["D", "W", "M"], description: "Daily, weekly or monthly bars. Default D." },
      },
      required: ["name", "grid", "symbols"],
      additionalProperties: false,
    },
    annotations: { title: "Save a Trade layout", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    write: true,
    async run(a, ctx) {
      const symbols = (a.symbols as string[]).slice(0, 4);
      const t = await ctx.data.json<TermIndex>("/data/terminal/index.json");
      const bad = t ? symbols.find((s) => !t.series.some((x) => x.key === s)) : undefined;
      if (bad) throw new ToolError(`No market ${bad}. Call list_market_series for the keys.`);
      const tf = str(a.timeframe, "D");
      // Parity Trade checks every field when it loads a layout (cleanLayout), filling the rest.
      const state = { grid: a.grid, cells: symbols.map((symbol) => ({ symbol, tf })), active: 0, max: null, type: "candles" };
      const res = await ctx.db.rpc<{ id: string; name: string }>("mcp_save_trade_layout", { p_name: str(a.name).trim(), p_state: state });
      return { layout: res, open: `${ctx.origin}/trade/` };
    },
  },
];

export function byName(name: string): Tool {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new ToolError(`Unknown tool ${name}`);
  return t;
}

/** What tools/list shows: every read tool, and the write tools only while the server flag is on. */
export function listed(writeEnabled: boolean) {
  return TOOLS.filter((t) => writeEnabled || !t.write).map((t) => ({
    name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations,
  }));
}
