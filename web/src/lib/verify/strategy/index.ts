// Verify a strategy from its code (DEC-0083): Pine Script, a simple Python strategy, or rules
// written in Parity's rule format (from a plain-language description through the person's
// own model, or sent by a program). The code is read into rules, the rules are run on our
// daily prices with honest costs, nearby settings are run too, and the record goes through
// the same checks as an uploaded file. Pure functions: the page, the API and the MCP tools
// share them, so each gives the same answer.
import type { PriceBook } from "../prices";
import { DEFAULT_CAPITAL, pricesFor, runRules, type Prices, type RunResult } from "./backtest";
import { readPine, looksLikePine } from "./pine";
import { readPython, looksLikePython } from "./python";
import { FUNCS, MARKETS, marketOf, RulesError, validateRules, type Expr, type Rules } from "./rules";
import { ScriptError, type ScriptRead } from "./script";
import type { Series } from "./series";

export * from "./rules";
export { ScriptError, type ScriptRead, type Unsupported } from "./script";
export { runRules, pricesFor, DEFAULT_CAPITAL, type RunResult, type Prices } from "./backtest";
export { plainPrompt, readPlainReply } from "./plain";

export type Language = "pine" | "python" | "rules";

export interface CodeInput {
  /** Pine Script or Python source, or rule-format JSON as text. */
  code?: string;
  /** Rules as an object, instead of code. */
  rules?: unknown;
  language?: Language | "auto";
  /** One of MARKETS. Code does not say which market it runs on, so the person picks one. */
  market: string;
  capital?: number;
  from?: string;
  to?: string;
}

/** Which language a piece of code is in, from how it looks. */
export function detectLanguage(code: string): Language {
  const t = code.trim();
  if (t.startsWith("{")) return "rules";
  if (looksLikePine(t)) return "pine";
  if (looksLikePython(t)) return "python";
  return /\bta\.|strategy\.|:=/.test(t) ? "pine" : "python";
}

/** Reads code or rules into rules. Throws ScriptError for a syntax problem and RulesError for bad rules. */
export function readStrategy(x: CodeInput): ScriptRead {
  const market = marketOf(x.market);
  if (!market) throw new RulesError(`Pick a market we hold daily prices for: ${MARKETS.map((m) => m.id).join(", ")}.`);
  let read: ScriptRead;
  if (x.rules != null || (x.code ?? "").trim().startsWith("{")) {
    let raw = x.rules;
    if (raw == null) { try { raw = JSON.parse(x.code!); } catch { throw new ScriptError("this looks like rules in JSON, but the JSON cannot be read.", 1); } }
    const r = raw && typeof raw === "object" ? { market: market.id, inputs: {}, let: {}, ...(raw as object), format: "parity-rules-1" } : raw;
    read = { language: "rules", rules: validateRules(r), name: null, blocking: [], ignored: [], notes: [], capital: null };
  } else {
    const code = (x.code ?? "").trim();
    if (!code) throw new ScriptError("there is no code to read.", 1);
    const lang = x.language && x.language !== "auto" ? x.language : detectLanguage(code);
    read = lang === "pine" ? readPine(code, { market: market.id }) : readPython(code, { market: market.id });
    if (read.rules) {
      try { read.rules = validateRules(read.rules); } catch (e) {
        if (!(e instanceof RulesError)) throw e;
        read.blocking.push(...e.problems.map((p) => ({ what: "rules", line: 0, why: p })));
        read.rules = null;
      }
    }
  }
  return finishRead(read, market.id, x.from, x.to);
}

/** The last steps for every way in: numbers in indicators become settings, unused values go, and the market and dates are set. */
export function finishRead(read: ScriptRead, market: string, from?: string, to?: string): ScriptRead {
  if (!read.rules) return read;
  const rules = prune(liftLengths(read.rules));
  rules.market = market;
  if (from) rules.from = from;
  if (to) rules.to = to;
  return { ...read, rules };
}

const FAMILY: Record<string, string> = { macd_signal: "macd", macd_hist: "macd", bb_upper: "bb", bb_lower: "bb" };
const ROLE: Record<string, string[]> = { macd: ["", "fast", "slow", "signal"], bb: ["", "length", "width"] };

/**
 * Numbers written straight into an indicator, such as ta.sma(close, 20), are settings too: a
 * person could have tried 15 or 30. They become named inputs, so the sweep varies them and the
 * tries count them. The same number in the same place of the same indicator is one setting.
 */
export function liftLengths(rules: Rules): Rules {
  const inputs = { ...rules.inputs };
  const byKey = new Map<string, string>();
  const nameFor = (fn: string, pos: number, v: number) => {
    const fam = FAMILY[fn] ?? fn;
    const key = `${fam}:${pos}:${v}`;
    let name = byKey.get(key);
    if (name) return name;
    const base = `${fam}_${ROLE[fam]?.[pos] || "length"}`;
    name = base;
    for (let k = 2; inputs[name] != null || rules.let[name] != null; k++) name = `${base}_${k}`;
    inputs[name] = v; byKey.set(key, name);
    return name;
  };
  const walk = (e: Expr): Expr => {
    if (!Array.isArray(e)) return e;
    const [fn, ...a] = e as [string, ...Expr[]];
    const spec = FUNCS[fn];
    const liftable = new Set([...(fn === "prev" ? [] : spec?.lengths ?? []), ...(FAMILY[fn] === "bb" ? [2] : [])]);
    return [fn, ...a.map((x, k) => (typeof x === "number" && liftable.has(k) && x !== 0 && x !== 1 ? nameFor(fn, k, x) : walk(x)))] as Expr;
  };
  const side = (s: Rules["long"]) => s && Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === "number" ? v : walk(v as Expr)])) as Rules["long"];
  const out: Rules = { ...rules, let: Object.fromEntries(Object.entries(rules.let).map(([k, v]) => [k, walk(v)])) };
  if (rules.long) out.long = side(rules.long);
  if (rules.short) out.short = side(rules.short);
  out.inputs = inputs;
  return out;
}

/** Drops values and settings no order uses, so the sweep varies only settings that matter. */
export function prune(rules: Rules): Rules {
  const need = new Set<string>();
  const visit = (e: Expr | undefined) => {
    if (e == null) return;
    if (typeof e === "string") {
      if (need.has(e)) return;
      need.add(e);
      if (rules.let[e] != null) visit(rules.let[e]);
      return;
    }
    if (Array.isArray(e)) e.slice(1).forEach(visit);
  };
  for (const s of [rules.long, rules.short]) if (s) for (const k of ["entry", "exit", "stop", "limit"] as const) visit(s[k]);
  return {
    ...rules,
    inputs: Object.fromEntries(Object.entries(rules.inputs).filter(([k]) => need.has(k))),
    let: Object.fromEntries(Object.entries(rules.let).filter(([k]) => need.has(k))),
  };
}

/** Inputs used as a number of days somewhere: the sweep keeps these whole numbers of at least 1. */
export function lengthInputs(rules: Rules): Set<string> {
  const out = new Set<string>();
  const walk = (e: Expr) => {
    if (!Array.isArray(e)) return;
    const [fn, ...a] = e as [string, ...Expr[]];
    a.forEach((x, k) => { if (typeof x === "string" && FUNCS[fn]?.lengths?.includes(k)) out.add(x); else walk(x); });
  };
  Object.values(rules.let).forEach(walk);
  for (const s of [rules.long, rules.short]) if (s) for (const k of ["entry", "exit", "stop", "limit"] as const) if (s[k] != null) walk(s[k]!);
  return out;
}

// ---------------------------------------------------------------- the runs

export interface RunStats { totalReturn: number; sharpe: number | null; trades: number; maxDrawdown: number }

const DAY = 86_400_000;

export function statsOf(run: RunResult): RunStats {
  const e = run.equity;
  const rets: number[] = [];
  let prev = run.capital, peak = run.capital, dd = 0;
  for (const v of e) { if (prev > 0) rets.push(v / prev - 1); prev = v; peak = Math.max(peak, v); dd = Math.max(dd, peak > 0 ? 1 - v / peak : 0); }
  const m = rets.reduce((s, v) => s + v, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, rets.length - 1));
  const span = e.length > 1 ? (Date.parse(run.dates[e.length - 1]) - Date.parse(run.dates[0])) / DAY / 365.25 : 0;
  const perYear = span > 0 ? (e.length - 1) / span : 252;
  return { totalReturn: e.length ? e[e.length - 1] / run.capital - 1 : 0, sharpe: sd > 1e-12 ? (m / sd) * Math.sqrt(perYear) : null, trades: run.trades.length, maxDrawdown: dd };
}

/** The settings next to the person's: each input at half to one and a half times its value. */
export function sweepGrid(inputs: Record<string, number>, lengths: Set<string> = new Set()): Record<string, number>[] {
  const keys = Object.keys(inputs).filter((k) => inputs[k] !== 0);
  if (!keys.length) return [];
  const levels = (k: string, factors: number[]) => {
    const v = inputs[k];
    const whole = lengths.has(k) || (Number.isInteger(v) && Math.abs(v) >= 2);
    const out = factors.map((f) => (whole ? Math.max(lengths.has(k) ? 1 : -Infinity, Math.round(v * f)) : Number((v * f).toPrecision(6))));
    return [...new Set(out)];
  };
  const five = [0.5, 0.75, 1, 1.25, 1.5], three = [0.75, 1, 1.25];
  const grid = (factors: number[]) => keys.reduce<Record<string, number>[]>((acc, k) => acc.flatMap((c) => levels(k, factors).map((v) => ({ ...c, [k]: v }))), [{ ...inputs }]);
  if (keys.length <= 3) return grid(five);
  if (keys.length === 4) return grid(three);
  // Many settings: change one at a time.
  const out: Record<string, number>[] = [{ ...inputs }];
  for (const k of keys) for (const v of levels(k, five)) if (v !== inputs[k]) out.push({ ...inputs, [k]: v });
  return out;
}

export interface Sweep {
  /** Runs, the person's own settings included. */
  runs: number;
  /** Share of the runs that made money after costs. */
  profitable: number;
  /** Where the person's settings rank by Sharpe among the runs: 1 is the best. */
  rank: number | null;
  medianSharpe: number | null;
  bestSharpe: number | null;
  /** The settings that varied, in words: "fast from 5 to 15". */
  ranges: string[];
}

export interface CodeRun {
  read: ScriptRead;
  rules: Rules;
  run: RunResult;
  stats: RunStats;
  /** The same rules with every order filled one day after its signal. */
  delayed: RunStats;
  sweep: Sweep;
  buyHold: { totalReturn: number; sharpe: number | null };
  prices: { from: string; to: string; days: number; source: string };
}

/** Runs read rules on the price book: once as written, once a day late, and over the nearby settings. */
export function runStrategy(read: ScriptRead & { rules: Rules }, book: PriceBook, capital?: number): CodeRun {
  const rules = read.rules;
  const p = pricesFor(book, rules.market);
  if (!p || p.dates.length < 60) throw new RulesError(`We do not hold enough daily prices for ${rules.market} to run this.`);
  const cap = capital ?? read.capital ?? DEFAULT_CAPITAL;
  const cache = new Map<string, Series>();
  const run = runRules(rules, p, rules.inputs, { capital: cap, cache });
  const delayedRun = runRules(rules, p, rules.inputs, { capital: cap, cache, lagDays: 1 });
  const grid = sweepGrid(rules.inputs, lengthInputs(rules));
  const stats = statsOf(run);
  const all = grid.length ? grid.map((inp) => statsOf(runRules(rules, p, inp, { capital: cap, cache }))) : [stats];
  const sharpes = all.map((s) => s.sharpe).filter((v): v is number => v != null).sort((a, b) => a - b);
  const rank = stats.sharpe == null ? null : 1 + all.filter((s) => s.sharpe != null && s.sharpe > stats.sharpe! + 1e-12).length;
  const ranges = Object.keys(rules.inputs).filter((k) => new Set(grid.map((g) => g[k])).size > 1).map((k) => {
    const vs = grid.map((g) => g[k]);
    return `${k} from ${Math.min(...vs)} to ${Math.max(...vs)}`;
  });
  return {
    read, rules, run, stats, delayed: statsOf(delayedRun),
    sweep: {
      runs: all.length, profitable: all.filter((s) => s.totalReturn > 0).length / all.length, rank,
      medianSharpe: sharpes.length ? sharpes[Math.floor(sharpes.length / 2)] : null, bestSharpe: sharpes.length ? sharpes[sharpes.length - 1] : null, ranges,
    },
    buyHold: buyAndHold(p, run.start, rules),
    prices: { from: run.dates[0] ?? p.dates[0], to: run.dates[run.dates.length - 1] ?? p.dates[p.dates.length - 1], days: run.dates.length, source: p.source },
  };
}

function buyAndHold(p: Prices, start: number, rules: Rules): { totalReturn: number; sharpe: number | null } {
  let lo = 0, hi = p.dates.length;
  if (rules.from) lo = Math.max(0, p.dates.findIndex((d) => d >= rules.from!));
  if (rules.to) { const k = p.dates.findIndex((d) => d > rules.to!); if (k >= 0) hi = k; }
  const c = p.close.slice(lo, hi).slice(start);
  if (c.length < 2) return { totalReturn: 0, sharpe: null };
  const r: number[] = [];
  for (let i = 1; i < c.length; i++) r.push(c[i] / c[i - 1] - 1);
  const m = r.reduce((s, v) => s + v, 0) / r.length;
  const sd = Math.sqrt(r.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, r.length - 1));
  const perYear = p.dates.length > 1 ? r.length / ((Date.parse(p.dates[hi - 1]) - Date.parse(p.dates[lo + start])) / DAY / 365.25) : 252;
  return { totalReturn: c[c.length - 1] / c[0] - 1, sharpe: sd > 0 ? (m / sd) * Math.sqrt(perYear) : null };
}

export { MARKETS };
