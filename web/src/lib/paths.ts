// Simulated paths for Sim World (DEC-0016): a block bootstrap of real weekly returns.
// The same rules as engine/src/parity/world.py (bootstrap_paths, risk, paths_csv), with
// the browser's own seeded random numbers, so a given seed repeats here but does not
// match the engine draw for draw. Paths reshuffle the past; they do not predict.
import type { Grid } from "./world";

/** A small, fast, seeded random number generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Returns { dates: string[]; keys: string[]; rows: number[][] }

/** Weekly log returns for `keys`, keeping only weeks where every key has one. */
export function weeklyReturns(grid: Grid, keys: string[]): Returns {
  const dates: string[] = [];
  const rows: number[][] = [];
  for (let i = 1; i < grid.dates.length; i++) {
    const row: number[] = [];
    let ok = true;
    for (const k of keys) {
      const s = grid.series[k];
      const a = s?.[i - 1], b = s?.[i];
      if (a == null || b == null || a <= 0 || b <= 0) { ok = false; break; }
      row.push(Math.log(b / a));
    }
    if (ok) { dates.push(grid.dates[i]); rows.push(row); }
  }
  return { dates, keys, rows };
}

const DAY = 86_400_000;

/** True for weeks ending after an event and within `weeks` weeks of it. */
export function analogueMask(dates: string[], eventDates: string[], weeks: number): boolean[] {
  const ev = eventDates.map((d) => Date.parse(d));
  return dates.map((d) => {
    const t = Date.parse(d);
    return ev.some((e) => t > e && t <= e + weeks * 7 * DAY);
  });
}

/** Row positions where a run of `block` pooled, back-to-back weeks begins. */
export function blockStarts(dates: string[], pool: boolean[], block: number): number[] {
  const out: number[] = [];
  const t = dates.map((d) => Date.parse(d));
  for (let i = 0; i + block <= dates.length; i++) {
    let ok = true;
    for (let j = i; j < i + block; j++) {
      if (!pool[j] || (j > i && t[j] - t[j - 1] > 8 * DAY)) { ok = false; break; }
    }
    if (ok) out.push(i);
  }
  return out;
}

export interface Sim {
  keys: string[];
  weeks: number;
  n: number;
  block: number;
  poolWeeks: number;
  /** levels[path][week][asset], starting at 100. */
  levels: Float64Array[];
  /** basket[path][week], equal weight rebalanced weekly, starting at 100. */
  basket: Float64Array[];
}

export function bootstrap(ret: Returns, weeks: number, n: number, block: number, seed: number, pool?: boolean[]): Sim {
  const k = ret.keys.length;
  const p = pool ?? ret.rows.map(() => true);
  const poolWeeks = p.filter(Boolean).length;
  if (!poolWeeks) throw new Error("No weeks to draw from.");
  let size = Math.max(1, Math.min(block, weeks));
  let starts = blockStarts(ret.dates, p, size);
  while (!starts.length && size > 1) { size -= 1; starts = blockStarts(ret.dates, p, size); }
  const rand = rng(seed);
  const levels: Float64Array[] = [];
  const basket: Float64Array[] = [];
  for (let path = 0; path < n; path++) {
    const lv = new Float64Array((weeks + 1) * k);
    const bk = new Float64Array(weeks + 1);
    const cum = new Array<number>(k).fill(0);
    let bcum = 0;
    for (let a = 0; a < k; a++) lv[a] = 100;
    bk[0] = 100;
    let t = 0;
    while (t < weeks) {
      const s = starts[Math.floor(rand() * starts.length)];
      for (let j = 0; j < size && t < weeks; j++, t++) {
        const row = ret.rows[s + j];
        let gross = 0;
        for (let a = 0; a < k; a++) {
          cum[a] += row[a];
          lv[(t + 1) * k + a] = 100 * Math.exp(cum[a]);
          gross += Math.exp(row[a]);
        }
        bcum += Math.log(gross / k);
        bk[t + 1] = 100 * Math.exp(bcum);
      }
    }
    levels.push(lv);
    basket.push(bk);
  }
  return { keys: ret.keys, weeks, n, block: size, poolWeeks, levels, basket };
}

/** Value of asset `a` (or the basket when a = -1) on week `t` of path `p`. */
export function valueOf(sim: Sim, p: number, t: number, a: number): number {
  return a < 0 ? sim.basket[p][t] : sim.levels[p][t * sim.keys.length + a];
}

function quantile(sorted: Float64Array | number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Band { day: number; median: number; q25: number; q75: number; min: number; max: number; count: number }

/** Percent change from the start, per week: median, middle half (25 to 75) and 5 to 95 as the outer band. */
export function bands(sim: Sim, a: number): Band[] {
  const out: Band[] = [];
  const col = new Float64Array(sim.n);
  for (let t = 0; t <= sim.weeks; t++) {
    for (let p = 0; p < sim.n; p++) col[p] = valueOf(sim, p, t, a) - 100;
    col.sort();
    out.push({ day: t, median: quantile(col, 0.5), q25: quantile(col, 0.25), q75: quantile(col, 0.75), min: quantile(col, 0.05), max: quantile(col, 0.95), count: sim.n });
  }
  return out;
}

export interface Risk { median: number; q25: number; q75: number; worst5: number; best5: number; tail5: number; pLoss: number; pLossGt: number; lossAt: number }

/** Risk of the end values (percent returns): see world.risk in the engine. */
export function risk(sim: Sim, a: number, lossAt: number): Risk {
  const r = new Float64Array(sim.n);
  for (let p = 0; p < sim.n; p++) r[p] = valueOf(sim, p, sim.weeks, a) - 100;
  r.sort();
  const q5 = quantile(r, 0.05);
  let tail = 0, nt = 0, loss = 0, lossGt = 0;
  for (const v of r) {
    if (v <= q5) { tail += v; nt++; }
    if (v < 0) loss++;
    if (v < -lossAt) lossGt++;
  }
  return {
    median: quantile(r, 0.5), q25: quantile(r, 0.25), q75: quantile(r, 0.75), worst5: q5, best5: quantile(r, 0.95),
    tail5: nt ? tail / nt : q5, pLoss: loss / sim.n, pLossGt: lossGt / sim.n, lossAt,
  };
}

/** Wide CSV: one row per path and week, a column per asset and the basket. Same layout as `parity world paths`. */
export function toCsv(sim: Sim): string {
  const lines = [["path", "week", ...sim.keys, "basket"].join(",")];
  for (let p = 0; p < sim.n; p++) {
    for (let t = 0; t <= sim.weeks; t++) {
      const cells = [String(p + 1), String(t)];
      for (let a = 0; a < sim.keys.length; a++) cells.push(valueOf(sim, p, t, a).toFixed(4));
      cells.push(sim.basket[p][t].toFixed(4));
      lines.push(cells.join(","));
    }
  }
  return lines.join("\n") + "\n";
}
