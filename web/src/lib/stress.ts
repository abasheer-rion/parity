// Monte Carlo stress tests and the shock composer (DEC-0066). The same rules as
// engine/src/parity/stress.py: random 13-week blocks of real weekly returns shared by
// every asset, a mix rebalanced weekly, a real crash stretch spliced in when asked. The
// engine runs the preset mixes on 5,000 paths every sims cycle (stress.json); the page
// draws its own paths for any mix with seeded random numbers. History reshuffled, never
// a forecast.
import { isMissing, source } from "./data";
import { rng } from "./paths";
import type { Grid } from "./world";

export const BLOCK = 13;
export const QS = [0.05, 0.25, 0.5, 0.75, 0.95] as const;

export interface StressRun {
  n: number; final: number[]; worst1: number; p_loss: number; max_dd: [number, number]; fell: number;
  recover_weeks: [number, number] | null; unrecovered: number;
  bands: { weeks: number[]; q: number[][] };
}
export interface StressMix { id: string; label: string; weights: Record<string, number>; runs: Record<string, Record<string, StressRun>> }
export interface Crash { id: string; label: string; from: string; to: string }
export interface StressDoc {
  generated_at: string; data_from: string; data_through: string; weeks_of_history: number;
  block: number; paths: number; seed: number; horizons: number[]; crashes: Crash[]; mixes: StressMix[]; note: string;
}

export type StressLoaded = { status: "ok"; data: StressDoc } | { status: "missing"; message: string } | { status: "error"; message: string };

export async function loadStress(): Promise<StressLoaded> {
  const url = source === "local" ? "/local/stress.json" : "/data/stress.json";
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (isMissing(res)) return { status: "missing", message: source === "local" ? "Run `parity world stress` first." : "The stress file has not been published yet." };
    if (!res.ok) return { status: "error", message: `Could not load ${url} (${res.status}).` };
    return { status: "ok", data: (await res.json()) as StressDoc };
  } catch (e) {
    return { status: "error", message: `Could not load ${url}: ${(e as Error).message}` };
  }
}

/** The engine's crash stretches, so the page works before stress.json arrives. */
export const CRASHES: Crash[] = [
  { id: "crash1987", label: "1987 crash", from: "1987-10-02", to: "1987-12-04" },
  { id: "dotcom", label: "Dot-com crash", from: "2000-03-24", to: "2002-10-11" },
  { id: "gfc", label: "2008 crisis", from: "2007-10-12", to: "2009-03-13" },
  { id: "covid", label: "Covid crash", from: "2020-02-21", to: "2020-03-27" },
  { id: "inflation", label: "2022 inflation", from: "2022-01-07", to: "2022-10-14" },
];

export const PRESET_MIXES: { id: string; label: string; weights: Record<string, number> }[] = [
  { id: "sixty_forty", label: "60/40 stocks and bonds", weights: { stocks: 60, bonds10: 40 } },
  { id: "all_stocks", label: "All US stocks", weights: { stocks: 100 } },
  { id: "bonds_heavy", label: "30/70 stocks and bonds", weights: { stocks: 30, bonds10: 70 } },
  { id: "real_assets", label: "Stocks, bonds and oil", weights: { stocks: 50, bonds10: 30, oil: 20 } },
  { id: "defensive", label: "Defensive industries", weights: { "ind.Utils": 34, "ind.Hlth": 33, "ind.NoDur": 33 } },
  { id: "havens", label: "Stocks with yen and franc", weights: { stocks: 60, JPY: 20, CHF: 20 } },
];

export interface Weekly { dates: string[]; keys: string[]; rows: number[][] }

/** Simple weekly returns for `keys`, only weeks where every key has one (as the engine). */
export function weeklySimple(grid: Grid, keys: string[]): Weekly {
  const dates: string[] = [], rows: number[][] = [];
  for (let i = 1; i < grid.dates.length; i++) {
    const row: number[] = [];
    let ok = true;
    for (const k of keys) {
      const a = grid.series[k]?.[i - 1], b = grid.series[k]?.[i];
      if (a == null || b == null || a <= 0) { ok = false; break; }
      row.push(b / a - 1);
    }
    if (ok) { dates.push(grid.dates[i]); rows.push(row); }
  }
  return { dates, keys, rows };
}

const DAY = 86_400_000;

function blockStarts(dates: string[], block: number): number[] {
  const t = dates.map((d) => Date.parse(d));
  const out: number[] = [];
  for (let i = 0; i + block <= dates.length; i++) {
    let ok = true;
    for (let j = i + 1; j < i + block; j++) if (t[j] - t[j - 1] > 8 * DAY) { ok = false; break; }
    if (ok) out.push(i);
  }
  return out;
}

/** Values of each mix on shared draws: values[mix][path] is a Float64Array of weeks + 1, from 1. */
export function simulate(w: Weekly, mixes: Record<string, number>[], weeks: number, n: number, seed: number,
  crash?: { from: string; to: string } | null, crashAt = 0): Float64Array[][] {
  const port = mixes.map((m) => {
    const total = Object.values(m).reduce((s, v) => s + v, 0) || 1;
    const idx = Object.keys(m).map((k) => [w.keys.indexOf(k), m[k] / total] as const);
    return w.rows.map((row) => idx.reduce((s, [k, x]) => s + (k >= 0 ? row[k] * x : 0), 0));
  });
  const size = Math.min(BLOCK, weeks);
  const starts = blockStarts(w.dates, size);
  if (!starts.length) throw new Error("Not enough back-to-back weeks to draw from.");
  const crashRows = crash ? w.dates.map((d, i) => [d, i] as const).filter(([d]) => d >= crash.from && d <= crash.to).map(([, i]) => i) : [];
  const rand = rng(seed);
  const out = mixes.map(() => [] as Float64Array[]);
  for (let p = 0; p < n; p++) {
    // One set of draws for every mix: the comparison is like for like.
    const rows: number[] = [];
    while (rows.length < weeks) {
      const s = starts[Math.floor(rand() * starts.length)];
      for (let j = 0; j < size && rows.length < weeks; j++) rows.push(s + j);
    }
    for (let j = 0; j < crashRows.length && crashAt + j < weeks; j++) rows[crashAt + j] = crashRows[j];
    port.forEach((r, m) => {
      const v = new Float64Array(weeks + 1);
      v[0] = 1;
      for (let t = 0; t < weeks; t++) v[t + 1] = v[t] * (1 + r[rows[t]]);
      out[m].push(v);
    });
  }
  return out;
}

export function quantile(sorted: ArrayLike<number>, q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Worst fall of one path and the weeks from its peak until it was made back (-1: never). */
export function drawdown(v: ArrayLike<number>): { worst: number; recover: number } {
  let peak = v[0], peakAt = 0, worst = 0, wPeakAt = 0, trough = 0;
  for (let t = 1; t < v.length; t++) {
    if (v[t] > peak) { peak = v[t]; peakAt = t; }
    const dd = v[t] / peak - 1;
    if (dd < worst) { worst = dd; wPeakAt = peakAt; trough = t; }
  }
  if (worst === 0) return { worst: 0, recover: 0 };
  const target = v[wPeakAt];
  for (let t = trough + 1; t < v.length; t++) if (v[t] >= target) return { worst, recover: t - wPeakAt };
  return { worst, recover: -1 };
}

export function summarise(paths: Float64Array[]): StressRun {
  const n = paths.length, weeks = paths[0].length - 1;
  const final = Float64Array.from(paths, (v) => v[weeks]).sort();
  const dd = paths.map(drawdown);
  const worst = Float64Array.from(dd, (d) => d.worst).sort();
  const rec = Float64Array.from(dd.filter((d) => d.recover > 0), (d) => d.recover).sort();
  const step = Math.max(1, Math.floor(weeks / 52));
  const cols: number[] = [];
  for (let t = 0; t <= weeks; t += step) cols.push(t);
  if (cols[cols.length - 1] !== weeks) cols.push(weeks);
  const col = new Float64Array(n);
  const q = QS.map(() => [] as number[]);
  for (const t of cols) {
    for (let p = 0; p < n; p++) col[p] = paths[p][t];
    col.sort();
    QS.forEach((x, k) => q[k].push(quantile(col, x)));
  }
  return {
    n, final: QS.map((x) => quantile(final, x)), worst1: quantile(final, 0.01),
    p_loss: final.filter((v) => v < 1).length / n, max_dd: [quantile(worst, 0.05), quantile(worst, 0.5)],
    fell: worst.filter((v) => v < 0).length / n,
    recover_weeks: rec.length ? [Math.round(quantile(rec, 0.5)), Math.round(quantile(rec, 0.9))] : null,
    unrecovered: dd.filter((d) => d.recover < 0).length / n, bands: { weeks: cols, q },
  };
}

// ---------- the shock composer ----------

/**
 * A distribution-free interval for the median from order statistics (engine:
 * scenarios.median_interval): the narrowest symmetric pair of sorted values that holds the
 * median with at least `level` probability. Null below 5 values at 90%.
 */
export function medianInterval(values: number[], level = 0.9): [number, number] | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (n < 2) return null;
  const pmf: number[] = [];
  let c = 1;
  for (let i = 0; i <= n; i++) { pmf.push(c / 2 ** n); c = (c * (n - i)) / (i + 1); }
  for (let j = Math.floor(n / 2); j >= 0; j--) {
    const k = n - 1 - j;
    if (j >= k) continue;
    let cover = 0;
    for (let i = j + 1; i <= k; i++) cover += pmf[i];
    if (cover >= level) return [v[j], v[k]];
  }
  return null;
}

export const confidenceWord = (n: number) => (n >= 20 ? "solid" : n >= 10 ? "fair" : n >= 5 ? "thin" : "too few");

export interface Shock { key: string; size: number }
export interface Episode { start: number; end: number }

/** A move over `weeks` from frame i: percent for prices, basis points for yields, points for the VIX. */
export function moveAt(grid: Grid, key: string, unit: "pct" | "bp" | "pts", i: number, weeks: number): number | null {
  const s = grid.series[key];
  const a = s?.[i], b = s?.[i + weeks];
  if (a == null || b == null) return null;
  if (unit === "pct") return a > 0 ? (b / a - 1) * 100 : null;
  return unit === "bp" ? (b - a) * 100 : b - a;
}

/**
 * Past windows of `weeks` in which every shock happened: a move in the asked direction of
 * at least `share` of its size. Windows do not overlap; the first one in a run is kept, so
 * one long episode counts once.
 */
export function findEpisodes(grid: Grid, shocks: Shock[], units: Record<string, "pct" | "bp" | "pts">, weeks: number, share: number): Episode[] {
  const out: Episode[] = [];
  let next = 0;
  for (let i = 0; i + weeks < grid.dates.length; i++) {
    if (i < next) continue;
    const ok = shocks.every((s) => {
      const m = moveAt(grid, s.key, units[s.key], i, weeks);
      return m != null && (s.size >= 0 ? m >= s.size * share : m <= s.size * share);
    });
    if (ok) { out.push({ start: i, end: i + weeks }); next = i + weeks; }
  }
  return out;
}
