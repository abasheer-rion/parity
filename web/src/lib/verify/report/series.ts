// The pictures' numbers for a Verify report (DEC-0088), worked out where the record is
// still whole (checks/index.ts) and kept small enough to travel in a link: a sampled growth
// curve, the spread of a result when the record is reshuffled, and where it made and lost
// money. Pure functions with fixed settings and a fixed seed, so the same record always
// draws the same pictures.
import type { Trade } from "../types";

/** A record's value over time: growth of 1 when returns are known, else profit so far in money. */
export interface Curve {
  unit: "growth" | "money";
  dates: string[];
  values: number[];
  /** The same days for the benchmark, growth of 1, when one was compared. */
  bench?: (number | null)[] | null;
  benchName?: string | null;
}

/** The spread of one number across reshuffles of the record, with its 95% range. */
export interface Spread {
  /** "sharpe": the Sharpe ratio, from daily returns in one-month blocks. "perTrade": profit per trade, trades drawn one by one. */
  what: "sharpe" | "perTrade";
  n: number;
  /** Block length in days for "sharpe"; 1 for trades. */
  block: number;
  edges: number[];
  counts: number[];
  point: number | null;
  ci95: [number, number] | null;
  ci80: [number, number] | null;
  /** Share of reshuffles above zero. */
  above: number | null;
}

/** One way of splitting a record: by kind of market, year, symbol or side. */
export interface GroupFamily {
  family: string;
  title: string;
  /** "return": a share of the account (a year's return, or the total over a crisis). "money": profit in the account's money. */
  unit: "return" | "money";
  items: { label: string; value: number; bench?: number | null; n?: number }[];
}

/** Where it made and lost money. */
export interface Groups { families: GroupFamily[] }

export const CURVE_POINTS = 240;
export const SEED = 20261103;

/**
 * At most `max` points from a long series, keeping each stretch's lowest and highest
 * point so the deepest fall and the highest high survive the thinning.
 */
export function thin<T>(dates: string[], values: number[], max = CURVE_POINTS, extra?: T[]): { dates: string[]; values: number[]; extra?: T[] } {
  if (dates.length <= max) return { dates: [...dates], values: [...values], extra: extra ? [...extra] : undefined };
  const keep = new Set<number>([0, dates.length - 1]);
  const buckets = Math.max(1, Math.floor((max - 2) / 2));
  const size = (dates.length - 2) / buckets;
  for (let b = 0; b < buckets; b++) {
    const a = 1 + Math.floor(b * size), z = Math.min(dates.length - 1, 1 + Math.floor((b + 1) * size));
    let lo = a, hi = a;
    for (let i = a; i < z; i++) { if (values[i] < values[lo]) lo = i; if (values[i] > values[hi]) hi = i; }
    keep.add(lo); keep.add(hi);
  }
  const idx = [...keep].sort((x, y) => x - y);
  return { dates: idx.map((i) => dates[i]), values: idx.map((i) => values[i]), extra: extra ? idx.map((i) => extra[i]) : undefined };
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Growth of 1 from an account's values, thinned for a link. */
export function growthCurve(dates: string[], equity0: number, equity: number[]): Curve | null {
  if (dates.length < 2 || !(equity0 > 0)) return null;
  const t = thin(dates, equity.map((v) => v / equity0));
  return { unit: "growth", dates: t.dates, values: t.values.map(r6) };
}

/** Profit so far after each closing day, for a trade list with no starting balance. */
export function moneyCurve(trades: readonly Trade[]): Curve | null {
  if (trades.length < 2) return null;
  const byDay = new Map<string, number>();
  for (const t of trades) byDay.set(t.closeTime.slice(0, 10), (byDay.get(t.closeTime.slice(0, 10)) ?? 0) + t.pnl);
  const dates = [...byDay.keys()].sort();
  let sum = 0;
  const values = dates.map((d) => (sum += byDay.get(d)!));
  const t = thin(dates, values);
  return { unit: "money", dates: t.dates, values: t.values.map((v) => Math.round(v * 100) / 100) };
}

/** A small seeded generator (mulberry32), so a reshuffle draws the same numbers every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** A histogram of `values` in `bins` equal bins between their 1st and 99th percentile. */
export function histogram(values: number[], bins = 30): { edges: number[]; counts: number[] } {
  const s = [...values].sort((a, b) => a - b);
  let lo = quantile(s, 0.005), hi = quantile(s, 0.995);
  if (!(hi > lo)) { lo -= Math.abs(lo) * 0.1 + 1e-9; hi += Math.abs(hi) * 0.1 + 1e-9; }
  const w = (hi - lo) / bins;
  const edges = Array.from({ length: bins + 1 }, (_, i) => r6(lo + i * w));
  const counts = new Array<number>(bins).fill(0);
  for (const v of s) counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w)))]++;
  return { edges, counts };
}

/**
 * Profit per trade when the trades are drawn again at random, with replacement: how much
 * the average could move by luck of the draw. 1,000 draws (fewer for very long records,
 * at least 200), seeded.
 */
export function tradeSpread(pnls: readonly number[]): Spread | null {
  const n = pnls.length;
  if (n < 10) return null;
  const draws = n <= 2000 ? 1000 : Math.max(200, Math.floor(2_000_000 / n));
  const rand = seeded(SEED);
  const means: number[] = [];
  for (let d = 0; d < draws; d++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += pnls[Math.floor(rand() * n)];
    means.push(s / n);
  }
  const sorted = [...means].sort((a, b) => a - b);
  const point = pnls.reduce((a, b) => a + b, 0) / n;
  return {
    what: "perTrade", n: draws, block: 1, ...histogram(means), point: r6(point),
    ci95: [r6(quantile(sorted, 0.025)), r6(quantile(sorted, 0.975))],
    ci80: [r6(quantile(sorted, 0.1)), r6(quantile(sorted, 0.9))],
    above: means.filter((m) => m > 0).length / draws,
  };
}

/** Profit by calendar year, by symbol (the six with most trades) and by side, for a trade list. */
export function tradeGroups(trades: readonly Trade[]): Groups | null {
  if (trades.length < 2) return null;
  const sum = (key: (t: Trade) => string | undefined) => {
    const m = new Map<string, { v: number; n: number }>();
    for (const t of trades) { const k = key(t); if (!k) continue; const g = m.get(k) ?? { v: 0, n: 0 }; g.v += t.pnl; g.n++; m.set(k, g); }
    return m;
  };
  const families: GroupFamily[] = [];
  const years = sum((t) => t.closeTime.slice(0, 4));
  if (years.size >= 1) families.push({ family: "years", title: "Each year", unit: "money", items: [...years].sort(([a], [b]) => a.localeCompare(b)).map(([label, g]) => ({ label, value: round2(g.v), n: g.n })) });
  const syms = sum((t) => t.symbol?.trim() || undefined);
  if (syms.size >= 2) families.push({ family: "symbols", title: "Each market", unit: "money", items: [...syms].sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([label, g]) => ({ label, value: round2(g.v), n: g.n })) });
  const sides = sum((t) => (t.side === "buy" ? "Long (bought first)" : t.side === "sell" ? "Short (sold first)" : undefined));
  if (sides.size >= 2) families.push({ family: "sides", title: "Long and short", unit: "money", items: [...sides].map(([label, g]) => ({ label, value: round2(g.v), n: g.n })) });
  return families.length ? { families } : null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Return by calendar year from daily returns, compounded. */
export function yearGroups(dates: readonly string[], returns: readonly number[]): GroupFamily | null {
  const m = new Map<string, number>();
  for (let i = 0; i < dates.length; i++) { const y = dates[i].slice(0, 4); m.set(y, (m.get(y) ?? 1) * (1 + returns[i])); }
  if (m.size < 1) return null;
  return { family: "years", title: "Each year", unit: "return", items: [...m].sort(([a], [b]) => a.localeCompare(b)).map(([label, g]) => ({ label, value: r6(g - 1) })) };
}
