// Pairs (statistical arbitrage): the engine's pairs.json, read by the research Pairs page and
// the Workbench's Pairs view. The file holds derived numbers only (z-scores, hedge ratios,
// p-values, half-lives, strategy returns). It never holds prices, and a file that does is
// refused before anything draws: some sources allow research use but not showing their
// values (DEC-0064, engine/src/parity/registry/rights.py).
//
// Where it comes from: /data/pairs.json, signed in only. The committed snapshot is
// web/public/data/pairs.json, which the site build copies there. In development
// /local/pairs.json (engine/output/pairs.json) is read first, then the snapshot.
import type { Point } from "./types";
import { isMissing, MissingFile, source } from "./data";

export type Rights = "public" | "internal" | "research" | "none";
export type Verdict = "luck" | "real but small" | "beats the market" | "fails";
export type Regime = "calm" | "nervous" | "stressed";
export type BreakKind = "stop-out" | "window end" | "broke";

export interface PairsSource { id: string; name: string; rights: Rights | string; licence: string | null; terms_url: string | null; shown: string | null }
export interface PairsMethod { id: string; name: string; plain: string | null }
export interface PairsRecipe {
  id: string; name: string; method: string; universe: string | null; description: string | null;
  sharpe: number | null; deflated_sharpe: number | null; cagr: number | null; max_drawdown: number | null;
  trades: number | null; win_rate: number | null; avg_hold_days: number | null; cost_bps: number | null; borrow_bps: number | null;
  trials: number | null; tests_passed: number | null; tests_total: number | null; verdict: Verdict | string | null; verdict_plain: string | null;
}
export interface PairSeries { dates: string[]; z: (number | null)[]; hedge: (number | null)[]; pvalue: (number | null)[]; halflife: (number | null)[]; position: (number | null)[] }
export interface Pair {
  id: string; a: string; b: string; label_a: string; label_b: string; group: string | null; rights: Rights | string; recipe: string;
  entry: number | null; exit: number | null; stop: number | null;
  series: PairSeries;
  stats: { pvalue_now: number | null; halflife_now: number | null; hedge_now: number | null; johansen_trace: number | null; johansen_5pct: number | null; correlation: number | null };
  results: { sharpe: number | null; total_return: number | null; trades: number | null; wins: number | null; losses: number | null };
}
export interface YearRow { recipe: string; year: number; return: number | null; wins: number | null; losses: number | null }
export interface RegimeRow { recipe: string; regime: Regime | string; return: number | null; sharpe: number | null; wins: number | null; losses: number | null }
export interface BreakRow { recipe: string; pair: string; date: string; kind: BreakKind | string; z_at_exit: number | null; return: number | null }
export interface CostRow { recipe: string; cost_bps: number; borrow_bps: number; sharpe: number | null }
export interface DecayRow { recipe: string; period: string; sharpe: number | null }

export interface PairsDoc {
  version: 1; generated_at: string | null; git_sha: string | null;
  data: { start: string | null; end: string | null; sources: PairsSource[] };
  trials: { total: number | null; recipes: number | null; search: number | null };
  methods: PairsMethod[]; leaderboard: PairsRecipe[]; pairs: Pair[];
  by_year: YearRow[]; by_regime: RegimeRow[]; breakdowns: BreakRow[]; cost_sensitivity: CostRow[]; decay: DecayRow[];
}

// ---------------------------------------------------------------- the no-prices guard

/** Words that name a price in a field name: price, close, level and their plurals. */
const PRICE_WORDS = new Set(["price", "prices", "close", "closes", "closing", "level", "levels"]);

/** True when a field name is about prices, such as "close", "price_a", "levelB" or "midprice". */
export function isPriceField(key: string): boolean {
  if (/price/i.test(key)) return true;
  return key.split(/[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/).some((w) => PRICE_WORDS.has(w.toLowerCase()));
}

/** Every path in the value whose field name is about prices, such as "pairs[0].series.close". */
export function priceFields(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => priceFields(v, `${path}[${i}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
    const here = path ? `${path}.${k}` : k;
    return isPriceField(k) ? [here, ...priceFields(v, here)] : priceFields(v, here);
  });
}

/** A pairs file that carries price fields. Nothing from it is drawn. */
export class PriceFieldError extends Error {
  constructor(readonly fields: string[]) {
    super(`This pairs file has price fields (${fields.slice(0, 3).join(", ")}${fields.length > 3 ? ` and ${fields.length - 3} more` : ""}). Parity shows only results computed from prices, so nothing from it is shown.`);
  }
}

export function assertNoPrices(value: unknown): void {
  const found = priceFields(value);
  if (found.length) throw new PriceFieldError(found);
}

// ---------------------------------------------------------------- parsing

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const s = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const str = (v: unknown, fallback = ""): string => s(v) ?? fallback;

/** A numeric series the same length as its dates: missing or bad points become null. */
const line = (v: unknown, len: number): (number | null)[] => {
  const a = arr(v);
  return Array.from({ length: len }, (_, i) => n(a[i]));
};

/**
 * Checks and normalises a pairs file. Refuses one with price fields or another version.
 * Every field may be null and every list may be empty; rows without the key they are
 * found by (an id, a recipe, a date) are dropped.
 */
export function parsePairs(raw: unknown): PairsDoc {
  assertNoPrices(raw);
  const r = obj(raw);
  if (r.version !== 1) throw new Error(`This pairs file is version ${String(r.version ?? "unknown")}; this page reads version 1.`);
  const data = obj(r.data);
  const trials = obj(r.trials);
  return {
    version: 1,
    generated_at: s(r.generated_at),
    git_sha: s(r.git_sha),
    data: {
      start: s(data.start),
      end: s(data.end),
      sources: arr(data.sources).map(obj).filter((x) => s(x.id)).map((x) => ({
        id: str(x.id), name: str(x.name, str(x.id)), rights: str(x.rights, "none"), licence: s(x.licence), terms_url: s(x.terms_url), shown: s(x.shown),
      })),
    },
    trials: { total: n(trials.total), recipes: n(trials.recipes), search: n(trials.search) },
    methods: arr(r.methods).map(obj).filter((x) => s(x.id)).map((x) => ({ id: str(x.id), name: str(x.name, str(x.id)), plain: s(x.plain) })),
    leaderboard: arr(r.leaderboard).map(obj).filter((x) => s(x.id)).map((x) => ({
      id: str(x.id), name: str(x.name, str(x.id)), method: str(x.method), universe: s(x.universe), description: s(x.description),
      sharpe: n(x.sharpe), deflated_sharpe: n(x.deflated_sharpe), cagr: n(x.cagr), max_drawdown: n(x.max_drawdown),
      trades: n(x.trades), win_rate: n(x.win_rate), avg_hold_days: n(x.avg_hold_days), cost_bps: n(x.cost_bps), borrow_bps: n(x.borrow_bps),
      trials: n(x.trials), tests_passed: n(x.tests_passed), tests_total: n(x.tests_total), verdict: s(x.verdict), verdict_plain: s(x.verdict_plain),
    })),
    pairs: arr(r.pairs).map(obj).filter((x) => s(x.id)).map((x) => {
      const sr = obj(x.series);
      const dates = arr(sr.dates).map((d) => (typeof d === "string" ? d : ""));
      const st = obj(x.stats);
      const rs = obj(x.results);
      return {
        id: str(x.id), a: str(x.a), b: str(x.b), label_a: str(x.label_a, str(x.a)), label_b: str(x.label_b, str(x.b)),
        group: s(x.group), rights: str(x.rights, "none"), recipe: str(x.recipe),
        entry: n(x.entry), exit: n(x.exit), stop: n(x.stop),
        series: { dates, z: line(sr.z, dates.length), hedge: line(sr.hedge, dates.length), pvalue: line(sr.pvalue, dates.length), halflife: line(sr.halflife, dates.length), position: line(sr.position, dates.length) },
        stats: { pvalue_now: n(st.pvalue_now), halflife_now: n(st.halflife_now), hedge_now: n(st.hedge_now), johansen_trace: n(st.johansen_trace), johansen_5pct: n(st.johansen_5pct), correlation: n(st.correlation) },
        results: { sharpe: n(rs.sharpe), total_return: n(rs.total_return), trades: n(rs.trades), wins: n(rs.wins), losses: n(rs.losses) },
      };
    }),
    by_year: arr(r.by_year).map(obj).filter((x) => s(x.recipe) && n(x.year) != null)
      .map((x) => ({ recipe: str(x.recipe), year: n(x.year)!, return: n(x.return), wins: n(x.wins), losses: n(x.losses) })),
    by_regime: arr(r.by_regime).map(obj).filter((x) => s(x.recipe) && s(x.regime))
      .map((x) => ({ recipe: str(x.recipe), regime: str(x.regime), return: n(x.return), sharpe: n(x.sharpe), wins: n(x.wins), losses: n(x.losses) })),
    breakdowns: arr(r.breakdowns).map(obj).filter((x) => s(x.recipe) && s(x.date))
      .map((x) => ({ recipe: str(x.recipe), pair: str(x.pair), date: str(x.date), kind: str(x.kind), z_at_exit: n(x.z_at_exit), return: n(x.return) })),
    cost_sensitivity: arr(r.cost_sensitivity).map(obj).filter((x) => s(x.recipe) && n(x.cost_bps) != null && n(x.borrow_bps) != null)
      .map((x) => ({ recipe: str(x.recipe), cost_bps: n(x.cost_bps)!, borrow_bps: n(x.borrow_bps)!, sharpe: n(x.sharpe) })),
    decay: arr(r.decay).map(obj).filter((x) => s(x.recipe) && s(x.period)).map((x) => ({ recipe: str(x.recipe), period: str(x.period), sharpe: n(x.sharpe) })),
  };
}

// ---------------------------------------------------------------- loading

/** The committed snapshot, copied to /data/ by the site build (signed in only). */
export const PAIRS_FILE = "/data/pairs.json";
/** The engine's own output in development (engine/output/pairs.json). */
export const PAIRS_LOCAL_FILE = "/local/pairs.json";

export async function loadPairs(): Promise<PairsDoc> {
  const urls = source === "local" ? [PAIRS_LOCAL_FILE, PAIRS_FILE] : [PAIRS_FILE];
  for (const url of urls) {
    const res = await fetch(url, { cache: "no-cache" });
    if (isMissing(res)) continue;
    if (!res.ok) throw new Error(`Could not load the pairs results (${res.status}).`);
    return parsePairs(await res.json());
  }
  throw new MissingFile("No pairs results have been published yet.");
}

// ---------------------------------------------------------------- helpers for the views

/** The dated points of a series, without the missing ones. */
export function points(dates: string[], values: (number | null)[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < dates.length; i++) {
    const v = values[i];
    if (dates[i] && v != null) out.push([dates[i], v]);
  }
  return out;
}

export interface Span { from: string; to: string; side: 1 | -1 }

/**
 * The stretches with a position open: 1 bought the spread (first leg bought, second sold),
 * -1 sold it. Each stretch runs from its first week to its last.
 */
export function positionSpans(dates: string[], position: (number | null)[]): Span[] {
  const out: Span[] = [];
  let cur: Span | null = null;
  for (let i = 0; i < dates.length; i++) {
    const p = position[i];
    const side = p != null && p > 0 ? 1 : p != null && p < 0 ? -1 : 0;
    if (cur && side === cur.side) { cur.to = dates[i]; continue; }
    if (cur) { out.push(cur); cur = null; }
    if (side !== 0 && dates[i]) cur = { from: dates[i], to: dates[i], side };
  }
  if (cur) out.push(cur);
  return out;
}

/** Weeks with a position open, out of weeks with a known position. */
export function timeInMarket(position: (number | null)[]): number | null {
  const known = position.filter((p) => p != null) as number[];
  return known.length ? known.filter((p) => p !== 0).length / known.length : null;
}

export const VERDICT_LABEL: Record<string, string> = {
  luck: "Could be luck", "real but small": "Real but small", "beats the market": "Beats the market", fails: "Fails",
};
export function verdictTone(v: string | null): "good" | "warning" | "bad" | "neutral" {
  if (v === "beats the market") return "good";
  if (v === "real but small") return "warning";
  if (v === "luck" || v === "fails") return "bad";
  return "neutral";
}

export const KIND_LABEL: Record<string, string> = { "stop-out": "Stopped out", "window end": "Ran out of time", broke: "Stopped being a pair" };
export const REGIME_LABEL: Record<string, string> = { calm: "Calm", nervous: "Nervous", stressed: "Stressed" };
const REGIME_ORDER = ["calm", "nervous", "stressed"];

export function forRecipe<T extends { recipe: string }>(rows: T[], recipe: string): T[] {
  return rows.filter((r) => r.recipe === recipe);
}

export function regimesOf(rows: RegimeRow[], recipe: string): RegimeRow[] {
  const rank = (r: string) => { const i = REGIME_ORDER.indexOf(r); return i < 0 ? 99 : i; };
  return forRecipe(rows, recipe).sort((a, b) => rank(a.regime) - rank(b.regime));
}

/** Cost sensitivity as a grid: trading costs down, borrow fees across. */
export function costGrid(rows: CostRow[], recipe: string): { costs: number[]; borrows: number[]; at: (cost: number, borrow: number) => number | null } {
  const mine = forRecipe(rows, recipe);
  const costs = [...new Set(mine.map((r) => r.cost_bps))].sort((a, b) => a - b);
  const borrows = [...new Set(mine.map((r) => r.borrow_bps))].sort((a, b) => a - b);
  const map = new Map(mine.map((r) => [`${r.cost_bps}:${r.borrow_bps}`, r.sharpe]));
  return { costs, borrows, at: (c, b) => map.get(`${c}:${b}`) ?? null };
}

/** The pair's two names, for headings and lists. */
export const pairName = (p: Pair) => `${p.label_a} and ${p.label_b}`;

/** True when the source's terms allow showing its values. Pages still show results only. */
export const valuesAllowed = (rights: string) => rights === "public";
