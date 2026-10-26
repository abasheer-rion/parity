// "How it holds up": the numbers behind the section on every strategy page, Verify result
// and Workbench comparison. A line-for-line port of engine/src/parity/metrics/holdup.py,
// so Verify can build the same shape (types.ts, Holdup) from uploaded daily returns in
// the browser. web/tests/holdup.test.ts checks the two agree on a fixture written by
// scripts/holdup_fixture.py. Change both together.
//
// One honest difference: the bootstrap draws its random blocks from a small seeded
// generator here and from NumPy's in Python, so the two give slightly different ranges
// (the test allows for it). Everything else matches the Python to its rounding.
//
// Everything is fixed in advance: the windows, the bootstrap settings and the crisis
// dates are constants, not tuned to any result.
import type { Holdup, HoldupDrawdown, HoldupEstimate, HoldupMust, HoldupRegimeFamily, HoldupRegimeItem, HoldupSource } from "./types";
import { deflatedSharpe, minTrackRecord, moments, type Moments } from "./verify/dsr";
import { normCdf } from "./verify/stats";

export const TRADING_DAYS = 252;
export const SEED = 20261026;
export const N_BOOTSTRAP = 1000;
export const BLOCK_DAYS = 21;
export const HIST_BINS = 30;
export const MAX_POINTS = 260;
export const CORR_WINDOW = 252;
export const VOL_WINDOW = 63;
export const RATE_LOOKBACK = 252;
export const LUCK_LINE = 0.95;
export const MIN_DAYS = 30;

/** Named crisis windows (peak to trough of the S&P 500), the same list as the engine. */
export const CRISES: [string, string, string][] = [
  ["Dot-com crash", "2000-03-24", "2002-10-09"],
  ["Global financial crisis", "2007-10-09", "2009-03-09"],
  ["Euro debt crisis", "2011-04-29", "2011-10-03"],
  ["Covid crash", "2020-02-19", "2020-03-23"],
  ["2022 inflation bear market", "2022-01-03", "2022-10-12"],
];

/** A dated series: "YYYY-MM-DD" dates and one value per date. */
export interface Series { dates: string[]; values: number[] }

export interface HoldupInput {
  /** Daily total returns: yearly return, drawdowns, regimes, equity. */
  returns: Series;
  /** Daily returns above cash; drives Sharpe, luck and p-values (defaults to returns). */
  excess?: Series | null;
  benchmark?: Series | null;
  stocks?: Series | null;
  bonds?: Series | null;
  /** An interest rate level in percent, for rates rising or falling. */
  rates?: Series | null;
  nTrials?: number;
  crises?: [string, string, string][] | null;
  /** Other p-values for the same strategy, corrected together by Holm. */
  testPValues?: Record<string, number> | null;
  breakevenBps?: number | null;
  costBps?: number | null;
  names?: Partial<Record<"strategy" | "benchmark" | "stocks" | "bonds" | "rates", string>>;
  reasons?: Partial<Record<"benchmark" | "stocks" | "bonds" | "rates", string>>;
  seed?: number;
  nBoot?: number;
}

// ------------------------------------------------------------------ small helpers

/** A finite number rounded for display parity with the Python, or null. */
function f(v: number | null | undefined, digits = 6): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const k = 10 ** digits;
  return Math.round(v * k) / k;
}

const nan = Number.NaN;

/** Drop missing values and repeated dates (keeping the last), sorted by date; null when empty. */
function clean(s: Series | null | undefined): Series | null {
  if (!s) return null;
  const m = new Map<string, number>();
  for (let i = 0; i < s.dates.length; i++) {
    const v = s.values[i];
    if (v == null || !Number.isFinite(v)) continue;
    const d = s.dates[i].slice(0, 10);
    m.delete(d);
    m.set(d, v);
  }
  if (!m.size) return null;
  const dates = [...m.keys()].sort();
  return { dates, values: dates.map((d) => m.get(d)!) };
}

/** Rows on dates both series have, in date order. */
function inner(a: Series, b: Series): { dates: string[]; a: number[]; b: number[] } {
  const mb = new Map(b.dates.map((d, i) => [d, b.values[i]]));
  const dates: string[] = [], xa: number[] = [], xb: number[] = [];
  for (let i = 0; i < a.dates.length; i++) {
    const v = mb.get(a.dates[i]);
    if (v === undefined) continue;
    dates.push(a.dates[i]); xa.push(a.values[i]); xb.push(v);
  }
  return { dates, a: xa, b: xb };
}

function growth(r: readonly number[]): number {
  if (!r.length) return nan;
  let g = 1;
  for (const v of r) g *= 1 + v;
  return g;
}

/** Compound annual return of a set of days (they need not be contiguous). */
function ann(r: readonly number[]): number {
  const g = growth(r);
  return r.length && g > 0 ? g ** (TRADING_DAYS / r.length) - 1 : nan;
}

function hit(r: readonly number[]): number {
  let n = 0, up = 0;
  for (const v of r) if (v !== 0) { n++; if (v > 0) up++; }
  return n ? up / n : nan;
}

function mean(x: readonly number[]): number {
  let s = 0;
  for (const v of x) s += v;
  return s / x.length;
}

function sd(x: readonly number[]): number {
  if (x.length < 2) return nan;
  const m = mean(x);
  let s = 0;
  for (const v of x) s += (v - m) ** 2;
  return Math.sqrt(s / (x.length - 1));
}

/** Annualised Sharpe of daily returns. */
export function sharpeAnnual(r: readonly number[]): number {
  if (r.length < 2) return nan;
  const s = sd(r);
  return s > 0 ? (mean(r) / s) * Math.sqrt(TRADING_DAYS) : nan;
}

function corr(a: readonly number[], b: readonly number[], lo = 0, hi = a.length): number {
  const n = hi - lo;
  if (n < 2) return nan;
  let ma = 0, mb = 0;
  for (let i = lo; i < hi; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = lo; i < hi; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : nan;
}

/** Evenly spaced row numbers, always ending on the last row, at most maxPoints. */
function decimate(n: number, maxPoints = MAX_POINTS): number[] {
  if (n <= maxPoints) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil(n / (maxPoints - 1));
  const idx: number[] = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  return idx;
}

/** The last known value of s on or before each date (NaN before its first date). */
function asof(s: Series, dates: string[]): number[] {
  const out: number[] = [];
  let j = -1;
  for (const d of dates) {
    while (j + 1 < s.dates.length && s.dates[j + 1] <= d) j++;
    out.push(j >= 0 ? s.values[j] : nan);
  }
  return out;
}

function source(name: string | null | undefined, s: Series | null, reason?: string): HoldupSource {
  if (!s) return { name: name ?? null, available: false, reason: reason || "not_provided" };
  return { name: name ?? null, available: true, start: s.dates[0], end: s.dates[s.dates.length - 1], n: s.dates.length };
}

const year = (d: string) => Number(d.slice(0, 4));
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / 86_400_000);

/** Linear-interpolated percentile of a sorted list (NumPy's default). */
function pctSorted(s: readonly number[], q: number): number {
  const pos = (s.length - 1) * (q / 100);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** A seeded generator (mulberry32), so every visitor gets the same ranges for the same file. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ the sections

function equityVsBenchmark(r: Series, bench: Series | null): Holdup["equity_vs_benchmark"] {
  let dates = r.dates, a = r.values, b: number[] | null = null;
  if (bench) { const j = inner(r, bench); dates = j.dates; a = j.a; b = j.b; }
  const idx = decimate(a.length);
  const cum = (x: number[]) => { let g = 1; return x.map((v) => (g *= 1 + v)); };
  const ea = cum(a), eb = b ? cum(b) : null;
  return {
    dates: idx.map((i) => dates[i]),
    strategy: idx.map((i) => f(ea[i], 5)),
    benchmark: eb ? idx.map((i) => f(eb[i], 5)) : null,
  };
}

function luck(ex: number[], nTrials: number): Holdup["luck"] {
  const p = deflatedSharpe(ex, nTrials);
  const p1 = deflatedSharpe(ex, 1);
  const verdict = p == null || !Number.isFinite(p) ? "not_enough_data" : p >= LUCK_LINE ? "unlikely_luck" : p >= 0.8 ? "borderline" : "could_be_luck";
  return { sharpe: f(sharpeAnnual(ex), 4), n_trials: Math.floor(nTrials), probability: f(p, 4), probability_one_try: f(p1, 4), line: LUCK_LINE, verdict };
}

function summary(x: number[], point: number, digits = 4): HoldupEstimate {
  const s = x.filter(Number.isFinite).sort((p, q) => p - q);
  if (!s.length) return { point: f(point, digits), median: null, ci95: null, ci80: null };
  return {
    point: f(point, digits), median: f(pctSorted(s, 50), digits),
    ci95: [f(pctSorted(s, 2.5), digits), f(pctSorted(s, 97.5), digits)],
    ci80: [f(pctSorted(s, 10), digits), f(pctSorted(s, 90), digits)],
  };
}

/**
 * Block-bootstrap ranges for the yearly return (from total returns) and Sharpe (from
 * returns above cash), resampling the same days for both: moving blocks of 21 days.
 */
function bootstrap(r: Series, ex: Series, seed: number, nBoot: number, block = BLOCK_DAYS): Holdup["bootstrap"] {
  const j = inner(r, ex);
  const n = j.dates.length;
  if (n < Math.max(MIN_DAYS, 2 * block)) return null;
  const a = j.a, e = j.b;
  const next = rng(seed);
  const nBlocks = Math.ceil(n / block);
  const cagr = new Array<number>(nBoot), shp = new Array<number>(nBoot);
  for (let k = 0; k < nBoot; k++) {
    let logg = 0, s = 0, s2 = 0, m = 0;
    for (let bI = 0; bI < nBlocks && m < n; bI++) {
      const start = Math.floor(next() * (n - block + 1));
      for (let t = 0; t < block && m < n; t++, m++) {
        logg += Math.log1p(a[start + t]);
        const v = e[start + t];
        s += v; s2 += v * v;
      }
    }
    cagr[k] = Math.expm1((logg * TRADING_DAYS) / n);
    const mu = s / n, varr = (s2 - n * mu * mu) / (n - 1);
    const sdv = varr > 0 ? Math.sqrt(varr) : 0;
    shp[k] = sdv > 0 ? (mu / sdv) * Math.sqrt(TRADING_DAYS) : nan;
  }
  const finite = shp.filter(Number.isFinite);
  let hist: { edges: (number | null)[]; counts: number[] } = { edges: [], counts: [] };
  if (finite.length) {
    let lo = Math.min(...finite), hi = Math.max(...finite);
    if (hi <= lo) hi = lo + 1e-9;
    const counts = new Array<number>(HIST_BINS).fill(0);
    for (const v of finite) counts[Math.min(HIST_BINS - 1, Math.floor(((v - lo) / (hi - lo)) * HIST_BINS))]++;
    hist = { edges: Array.from({ length: HIST_BINS + 1 }, (_, i) => f(lo + ((hi - lo) * i) / HIST_BINS, 4)), counts };
  }
  return {
    n: nBoot, block_days: block, seed, days: n,
    sharpe: summary(shp, sharpeAnnual(e)),
    cagr: summary(cagr, ann(a), 5),
    prob_sharpe_above_zero: f(finite.length ? finite.filter((v) => v > 0).length / finite.length : null, 4),
    histogram: hist,
  };
}

/** Holm's step-down correction across a family of tests, in the input order. */
export function holm(pValues: Record<string, number | null | undefined>): { name: string; raw: number | null; adjusted: number | null }[] {
  const items = Object.entries(pValues).filter((x): x is [string, number] => x[1] != null && Number.isFinite(x[1]));
  const m = items.length;
  const order = items.map((_, i) => i).sort((p, q) => items[p][1] - items[q][1]);
  const adjusted = new Array<number>(m).fill(0);
  let running = 0;
  order.forEach((i, rank) => { running = Math.max(running, Math.min(1, (m - rank) * items[i][1])); adjusted[i] = running; });
  return items.map(([k, p], i) => ({ name: k, raw: f(p, 6), adjusted: f(adjusted[i], 6) }));
}

const denom = (m: Moments) => Math.sqrt(Math.max(1 - m.skew * m.sr + ((m.kurt - 1) / 4) * m.sr ** 2, 1e-12));

/**
 * One-sided p-value that the true Sharpe is above zero, from the Sharpe's t-statistic with
 * the skew and fat-tail adjustment of the probabilistic Sharpe ratio, then corrected for
 * the number of strategies tried.
 */
function pValues(ex: number[], nTrials: number, tests?: Record<string, number> | null): Holdup["p_values"] {
  const m = moments(ex);
  const n = Math.max(Math.floor(nTrials), 1);
  const t = m ? (m.sr * Math.sqrt(m.t - 1)) / denom(m) : nan;
  const raw = m ? normCdf(-t) : nan;
  const fin = Number.isFinite(raw);
  const bonf = fin ? Math.min(1, raw * n) : nan;
  const sidak = fin ? (raw < 1 ? -Math.expm1(n * Math.log1p(-raw)) : 1) : nan;
  return {
    method: "psr_t", t_stat: f(t, 4), raw: f(raw, 6), n_trials: n,
    bonferroni: f(bonf, 6), sidak: f(sidak, 6),
    holm: tests ? holm({ sharpe_above_zero: raw, ...tests }) : null,
    significant: {
      raw: fin ? raw < 0.05 : null,
      bonferroni: Number.isFinite(bonf) ? bonf < 0.05 : null,
      sidak: Number.isFinite(sidak) ? sidak < 0.05 : null,
    },
  };
}

/** 252-day rolling correlation of daily returns, sampled at each month's last day. */
function rollingCorrelation(r: Series, others: Record<string, Series>): Holdup["rolling_correlation"] {
  const keys = Object.keys(others) as ("stocks" | "bonds")[];
  if (!keys.length) return null;
  // Rows every series has.
  const maps = keys.map((k) => new Map(others[k].dates.map((d, i) => [d, others[k].values[i]])));
  const dates: string[] = [], a: number[] = [];
  const cols: number[][] = keys.map(() => []);
  for (let i = 0; i < r.dates.length; i++) {
    const vs = maps.map((mp) => mp.get(r.dates[i]));
    if (vs.some((v) => v === undefined)) continue;
    dates.push(r.dates[i]); a.push(r.values[i]);
    vs.forEach((v, k) => cols[k].push(v!));
  }
  const n = dates.length;
  const obj = <T>(fn: (k: number) => T) => Object.fromEntries(keys.map((key, k) => [key, fn(k)]));
  if (n < CORR_WINDOW + 1) {
    return {
      window_days: CORR_WINDOW, dates: [], series: obj(() => []),
      full_period: obj((k) => (n > 2 ? f(corr(a, cols[k]), 3) : null)),
      latest: obj(() => null),
    };
  }
  const rows: number[] = [];
  for (let i = 0; i < n; i++) {
    const lastOfMonth = i === n - 1 || dates[i + 1].slice(0, 7) !== dates[i].slice(0, 7);
    if (lastOfMonth && i >= CORR_WINDOW - 1) rows.push(i);
  }
  const roll = (k: number, i: number) => corr(a, cols[k], i - CORR_WINDOW + 1, i + 1);
  return {
    window_days: CORR_WINDOW,
    dates: rows.map((i) => dates[i]),
    series: obj((k) => rows.map((i) => f(roll(k, i), 3))),
    full_period: obj((k) => f(corr(a, cols[k]), 3)),
    latest: obj((k) => f(roll(k, n - 1), 3)),
  };
}

function regimeItem(key: string, label: string, mask: boolean[], a: number[], b: number[] | null, total: number, extra: { start?: string; end?: string } = {}): HoldupRegimeItem | null {
  const ra: number[] = [], rb: number[] = [];
  mask.forEach((on, i) => { if (on) { ra.push(a[i]); if (b) rb.push(b[i]); } });
  const days = ra.length;
  if (!days) return null;
  const sa = growth(ra) - 1;
  const sb = b ? growth(rb) - 1 : nan;
  return {
    key, label, ...extra, days, share: f(days / total, 4),
    strategy_total: f(sa), benchmark_total: f(sb),
    strategy_ann: f(ann(ra)), benchmark_ann: b ? f(ann(rb)) : null,
    strategy_hit: f(hit(ra), 4), benchmark_hit: b ? f(hit(rb), 4) : null,
    wins: b && Number.isFinite(sa) && Number.isFinite(sb) ? sa > sb : null,
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function median(x: number[]): number {
  const s = [...x].sort((p, q) => p - q);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

function regimes(r: Series, bench: Series | null, rates: Series | null, crises: [string, string, string][], volSource: string | null): HoldupRegimeFamily[] {
  let idx = r.dates, a = r.values, b: number[] | null = null;
  if (bench) { const j = inner(r, bench); idx = j.dates; a = j.a; b = j.b; }
  const total = a.length;
  const out: HoldupRegimeFamily[] = [];
  const keep = (xs: (HoldupRegimeItem | null)[]) => xs.filter((x): x is HoldupRegimeItem => !!x);

  // Rates rising or falling: 12-month change in the rate series, as known on each day.
  if (!rates) out.push({ family: "rates", available: false, reason: "no_rate_series", items: [] });
  else {
    const lvl = asof(rates, idx);
    const chg = idx.map((_, i) => (i >= RATE_LOOKBACK ? lvl[i] - lvl[i - RATE_LOOKBACK] : nan));
    const ok = chg.map(Number.isFinite);
    if (ok.filter(Boolean).length < VOL_WINDOW) out.push({ family: "rates", available: false, reason: "too_short", items: [] });
    else out.push({
      family: "rates", available: true, reason: null, lookback_days: RATE_LOOKBACK,
      items: keep([
        regimeItem("rising", "Rates rising", chg.map((c, i) => ok[i] && c > 0), a, b, total),
        regimeItem("falling", "Rates falling", chg.map((c, i) => ok[i] && c <= 0), a, b, total),
      ]),
    });
  }

  // Volatility high or low: the benchmark's 63-day realised volatility against its median.
  if (!b) out.push({ family: "volatility", available: false, reason: "no_benchmark", items: [] });
  else {
    const vol = b.map((_, i) => (i >= VOL_WINDOW - 1 ? sd(b.slice(i - VOL_WINDOW + 1, i + 1)) * Math.sqrt(TRADING_DAYS) : nan));
    const ok = vol.map(Number.isFinite);
    const good = vol.filter(Number.isFinite);
    if (good.length < VOL_WINDOW) out.push({ family: "volatility", available: false, reason: "too_short", items: [] });
    else {
      const med = median(good);
      out.push({
        family: "volatility", available: true, reason: null, window_days: VOL_WINDOW, median_vol: f(med, 4), source: volSource,
        items: keep([
          regimeItem("high", "Volatile markets", vol.map((v, i) => ok[i] && v > med), a, b, total),
          regimeItem("low", "Calm markets", vol.map((v, i) => ok[i] && v <= med), a, b, total),
        ]),
      });
    }
  }

  // Named crises.
  const crisisItems: HoldupRegimeItem[] = [];
  for (const [name, start, end] of crises) {
    const mask = idx.map((d) => d >= start && d <= end);
    if (mask.filter(Boolean).length < 5) continue;
    const it = regimeItem(slug(name), name, mask, a, b, total, { start: start.slice(0, 10), end: end.slice(0, 10) });
    if (it) crisisItems.push(it);
  }
  out.push({ family: "crises", available: crisisItems.length > 0, reason: crisisItems.length ? null : "no_overlap", items: crisisItems });

  // Decades.
  const decade = idx.map((d) => Math.floor(year(d) / 10) * 10);
  const decadeItems: HoldupRegimeItem[] = [];
  for (const d of [...new Set(decade)].sort((p, q) => p - q)) {
    const mask = decade.map((x) => x === d);
    if (mask.filter(Boolean).length < VOL_WINDOW) continue;
    const it = regimeItem(`${d}s`, `${d}s`, mask, a, b, total);
    if (it) decadeItems.push(it);
  }
  out.push({ family: "decades", available: decadeItems.length > 0, reason: decadeItems.length ? null : "too_short", items: decadeItems });
  return out;
}

/** The deepest separate drawdowns: peak, trough, recovery (null if not yet back). */
export function drawdownEpisodes(r: Series, top = 5): HoldupDrawdown[] {
  let g = 1;
  const eq = r.values.map((v) => (g *= 1 + v));
  const dates = r.dates;
  const episodes: [number, number, number | null][] = [];
  let peak = 0, trough = 0, inDd = false;
  for (let i = 1; i < eq.length; i++) {
    if (eq[i] >= eq[peak]) {
      if (inDd) { episodes.push([peak, trough, i]); inDd = false; }
      peak = trough = i;
    } else {
      if (!inDd) { inDd = true; trough = i; }
      if (eq[i] < eq[trough]) trough = i;
    }
  }
  if (inDd) episodes.push([peak, trough, null]);
  const rows = episodes.map(([p, t, rec]) => {
    const end = rec != null ? dates[rec] : dates[dates.length - 1];
    return {
      start: dates[p], trough: dates[t], recovery: rec != null ? dates[rec] : null,
      depth: f(eq[t] / eq[p] - 1), days: daysBetween(dates[p], end), days_to_trough: daysBetween(dates[p], dates[t]),
    };
  });
  rows.sort((x, y) => (x.depth ?? 0) - (y.depth ?? 0) || (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
  return rows.slice(0, top);
}

function yearly(s: Series): Map<number, number> {
  const out = new Map<number, number>();
  s.dates.forEach((d, i) => { const y = year(d); out.set(y, (out.get(y) ?? 1) * (1 + s.values[i])); });
  for (const [y, g] of out) out.set(y, g - 1);
  return out;
}

function worstPeriods(r: Series, bench: Series | null): Holdup["worst_periods"] {
  const years = yearly(r);
  let worstYear: Holdup["worst_periods"]["worst_year"] = null;
  if (years.size) {
    // The first year holding the lowest value, as pandas' idxmin does.
    let y = 0, lo = Infinity;
    for (const [k, v] of [...years.entries()].sort((p, q) => p[0] - q[0])) if (v < lo) { lo = v; y = k; }
    let by: number | null = null;
    if (bench) {
      const bb = bench.values.filter((_, i) => year(bench.dates[i]) === y);
      by = bb.length ? f(growth(bb) - 1) : null;
    }
    worstYear = { year: y, return: f(lo), benchmark: by };
  }
  let worst12: Holdup["worst_periods"]["worst_12m"] = null;
  if (r.values.length >= TRADING_DAYS) {
    const csum = [0];
    for (const v of r.values) csum.push(csum[csum.length - 1] + Math.log1p(v));
    let j = 0, lo = Infinity;
    for (let i = 0; i + TRADING_DAYS < csum.length; i++) {
      const w = csum[i + TRADING_DAYS] - csum[i];
      if (w < lo) { lo = w; j = i; }
    }
    worst12 = { start: r.dates[j], end: r.dates[j + TRADING_DAYS - 1], return: f(Math.expm1(lo)) };
  }
  return { drawdowns: drawdownEpisodes(r), worst_year: worstYear, worst_12m: worst12 };
}

function mustBeTrue(r: Series, ex: Series, nTrials: number, corrBlock: Holdup["rolling_correlation"], crises: [string, string, string][], lk: Holdup["luck"], breakevenBps: number | null | undefined, costBps: number | null | undefined): HoldupMust[] {
  const out: HoldupMust[] = [];
  if (breakevenBps != null && Number.isFinite(breakevenBps)) {
    out.push({ key: "costs_below_breakeven", holds: costBps == null ? null : breakevenBps > costBps, values: { breakeven_bps: f(breakevenBps, 2), assumed_bps: f(costBps, 2) } });
  }
  if (corrBlock?.series) {
    for (const [k, vals] of Object.entries(corrBlock.series) as ["stocks" | "bonds", (number | null)[]][]) {
      const v = (vals ?? []).filter((x): x is number => x != null);
      if (!v.length) continue;
      out.push({
        key: `correlation_to_${k}_persists`, holds: null,
        values: { full_period: corrBlock.full_period[k] ?? null, latest: corrBlock.latest[k] ?? null, min: f(Math.min(...v), 3), max: f(Math.max(...v), 3) },
      });
    }
  }
  const logs = r.values.map(Math.log1p);
  const totalLog = logs.reduce((s, v) => s + v, 0);
  const inCrisis = r.dates.map((d) => crises.some(([, s, e]) => d >= s && d <= e));
  if (inCrisis.some(Boolean) && totalLog > 0) {
    const share = logs.reduce((s, v, i) => s + (inCrisis[i] ? v : 0), 0) / totalLog;
    out.push({ key: "not_reliant_on_crises", holds: share <= 0.5, values: { crisis_return_share: f(share, 4), crisis_day_share: f(inCrisis.filter(Boolean).length / inCrisis.length, 4) } });
  }
  const years = yearly(r);
  if (years.size >= 3) {
    let best = 0, hi = -Infinity;
    for (const [k, v] of [...years.entries()].sort((p, q) => p[0] - q[0])) if (v > hi) { hi = v; best = k; }
    const rest = ex.values.filter((_, i) => year(ex.dates[i]) !== best);
    const s = sharpeAnnual(rest);
    out.push({ key: "not_one_lucky_year", holds: Number.isFinite(s) ? s > 0 : null, values: { best_year: best, best_year_return: f(hi), sharpe_without: f(s, 4) } });
  }
  const m = moments(ex.values);
  if (m) {
    const need = minTrackRecord(m, nTrials);
    const have = m.t / TRADING_DAYS;
    const yearsNeed = Number.isFinite(need) ? need / TRADING_DAYS : null;
    out.push({ key: "enough_history", holds: yearsNeed != null && have >= yearsNeed, values: { years: f(have, 2), observations: m.t, years_needed: f(yearsNeed, 2), n_trials: Math.floor(nTrials) } });
  }
  if (lk.probability != null) {
    out.push({ key: "survives_trial_count", holds: lk.probability >= LUCK_LINE, values: { probability: lk.probability, n_trials: Math.floor(nTrials), line: LUCK_LINE } });
  }
  return out;
}

// ------------------------------------------------------------------ the entry point

/** All the "how it holds up" numbers for one strategy; null under 30 days of returns. */
export function holdup(input: HoldupInput): Holdup | null {
  const names = input.names ?? {};
  const reasons = input.reasons ?? {};
  const nTrials = Math.max(1, Math.floor(input.nTrials ?? 1));
  const r = clean(input.returns);
  if (!r || r.dates.length < MIN_DAYS) return null;
  const ex = (input.excess ? clean(input.excess) : null) ?? r;
  const bench = clean(input.benchmark), stk = clean(input.stocks), bnd = clean(input.bonds), rt = clean(input.rates);
  const crisisList = input.crises?.length ? input.crises : CRISES;

  const lk = luck(ex.values, nTrials);
  const others: Record<string, Series> = {};
  if (stk) others.stocks = stk;
  if (bnd) others.bonds = bnd;
  const corrBlock = rollingCorrelation(r, others);
  return {
    equity_vs_benchmark: equityVsBenchmark(r, bench),
    luck: lk,
    bootstrap: bootstrap(r, ex, input.seed ?? SEED, input.nBoot ?? N_BOOTSTRAP),
    p_values: pValues(ex.values, nTrials, input.testPValues),
    rolling_correlation: corrBlock,
    regimes: regimes(r, bench, rt, crisisList, bench ? names.benchmark ?? "benchmark" : null),
    worst_periods: worstPeriods(r, bench),
    must_be_true: mustBeTrue(r, ex, nTrials, corrBlock, crisisList, lk, input.breakevenBps, input.costBps),
    sources: {
      strategy: source(names.strategy ?? "strategy", r),
      benchmark: source(names.benchmark, bench, reasons.benchmark),
      stocks: source(names.stocks, stk, reasons.stocks),
      bonds: source(names.bonds, bnd, reasons.bonds),
      rates: source(names.rates, rt, reasons.rates),
      crises: { name: input.crises?.length ? "given" : "built_in", n: crisisList.length },
    },
  };
}

/** Daily returns from a list of [date, account value] points (a strategy's equity curve). */
export function returnsFromEquity(points: readonly [string, number][]): Series {
  const dates: string[] = [], values: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1][1], v = points[i][1];
    if (p > 0 && Number.isFinite(v)) { dates.push(points[i][0]); values.push(v / p - 1); }
  }
  return { dates, values };
}
