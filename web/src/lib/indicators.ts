// Technical indicators for the Trade charts, computed in our own code so every number
// can be checked by a unit test (tests/indicators.test.ts). Every function takes bars
// (oldest first) and returns one value per bar, null until there is enough history.
//
// Conventions follow the original authors: RSI, ATR and ADX use Wilder's smoothing
// (an average with weight 1/n), EMA uses 2/(n+1), Bollinger uses the population
// standard deviation, and Stochastic is the slow %K and %D.

export interface Bar {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export type Line = (number | null)[];

const closes = (bars: Bar[]) => bars.map((b) => b.close);

/** Simple moving average of a list of numbers (nulls break the window). */
export function smaOf(values: Line, n: number): Line {
  const out: Line = new Array(values.length).fill(null);
  if (n < 1) return out;
  let sum = 0, count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) { sum = 0; count = 0; continue; }
    sum += v; count++;
    if (count > n) { sum -= values[i - n] as number; count = n; }
    if (count === n) out[i] = sum / n;
  }
  return out;
}

/** Exponential moving average, seeded with the simple average of the first n values. */
export function emaOf(values: Line, n: number): Line {
  const out: Line = new Array(values.length).fill(null);
  if (n < 1) return out;
  const k = 2 / (n + 1);
  let prev: number | null = null, seed = 0, count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      seed += v; count++;
      if (count === n) { prev = seed / n; out[i] = prev; }
      continue;
    }
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's smoothing: the first value is the simple average of n, then (prev*(n-1)+x)/n. */
export function wilderOf(values: Line, n: number): Line {
  const out: Line = new Array(values.length).fill(null);
  let prev: number | null = null, seed = 0, count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      seed += v; count++;
      if (count === n) { prev = seed / n; out[i] = prev; }
      continue;
    }
    prev = (prev * (n - 1) + v) / n;
    out[i] = prev;
  }
  return out;
}

export const sma = (bars: Bar[], n = 20) => smaOf(closes(bars), n);
export const ema = (bars: Bar[], n = 20) => emaOf(closes(bars), n);

export function bollinger(bars: Bar[], n = 20, k = 2): { mid: Line; upper: Line; lower: Line } {
  const c = closes(bars);
  const mid = smaOf(c, n);
  const upper: Line = [], lower: Line = [];
  for (let i = 0; i < c.length; i++) {
    const m = mid[i];
    if (m == null) { upper.push(null); lower.push(null); continue; }
    let ss = 0;
    for (let j = i - n + 1; j <= i; j++) ss += (c[j] - m) ** 2;
    const sd = Math.sqrt(ss / n);
    upper.push(m + k * sd); lower.push(m - k * sd);
  }
  return { mid, upper, lower };
}

/** Rolling volume-weighted average price over n bars, using the typical price (H+L+C)/3.
 *  Null wherever volume is missing: we never invent volume. */
export function vwap(bars: Bar[], n = 20): Line {
  const out: Line = new Array(bars.length).fill(null);
  for (let i = n - 1; i < bars.length; i++) {
    let pv = 0, v = 0, ok = true;
    for (let j = i - n + 1; j <= i; j++) {
      const vol = bars[j].volume;
      if (vol == null || !Number.isFinite(vol)) { ok = false; break; }
      pv += ((bars[j].high + bars[j].low + bars[j].close) / 3) * vol;
      v += vol;
    }
    if (ok && v > 0) out[i] = pv / v;
  }
  return out;
}

export function rsi(bars: Bar[], n = 14): Line {
  const c = closes(bars);
  const gains: Line = [null], losses: Line = [null];
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    gains.push(Math.max(d, 0)); losses.push(Math.max(-d, 0));
  }
  const g = wilderOf(gains, n), l = wilderOf(losses, n);
  return c.map((_, i) => {
    const a = g[i], b = l[i];
    if (a == null || b == null) return null;
    if (b === 0) return a === 0 ? 50 : 100;
    return 100 - 100 / (1 + a / b);
  });
}

export function macd(bars: Bar[], fast = 12, slow = 26, signal = 9): { macd: Line; signal: Line; hist: Line } {
  const c = closes(bars);
  const f = emaOf(c, fast), s = emaOf(c, slow);
  const line: Line = c.map((_, i) => (f[i] != null && s[i] != null ? (f[i] as number) - (s[i] as number) : null));
  const sig = emaOf(line, signal);
  const hist: Line = line.map((v, i) => (v != null && sig[i] != null ? v - (sig[i] as number) : null));
  return { macd: line, signal: sig, hist };
}

/** Slow stochastic: raw %K over n bars, smoothed by `smooth` into %K, and %D its d-bar average. */
export function stochastic(bars: Bar[], n = 14, smooth = 3, d = 3): { k: Line; d: Line } {
  const raw: Line = bars.map((_, i) => {
    if (i < n - 1) return null;
    let hi = -Infinity, lo = Infinity;
    for (let j = i - n + 1; j <= i; j++) { hi = Math.max(hi, bars[j].high); lo = Math.min(lo, bars[j].low); }
    return hi === lo ? 50 : ((bars[i].close - lo) / (hi - lo)) * 100;
  });
  const k = smooth > 1 ? smaOf(raw, smooth) : raw;
  return { k, d: smaOf(k, d) };
}

export function trueRange(bars: Bar[]): Line {
  return bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
}

export const atr = (bars: Bar[], n = 14) => wilderOf(trueRange(bars), n);

/** Average directional index with +DI and -DI (Wilder, 1978). */
export function adx(bars: Bar[], n = 14): { adx: Line; plusDI: Line; minusDI: Line } {
  const plusDM: Line = [null], minusDM: Line = [null], tr: Line = [null];
  for (let i = 1; i < bars.length; i++) {
    const up = bars[i].high - bars[i - 1].high, down = bars[i - 1].low - bars[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    const pc = bars[i - 1].close;
    tr.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - pc), Math.abs(bars[i].low - pc)));
  }
  const sTr = wilderOf(tr, n), sP = wilderOf(plusDM, n), sM = wilderOf(minusDM, n);
  const plusDI: Line = [], minusDI: Line = [], dx: Line = [];
  for (let i = 0; i < bars.length; i++) {
    const t = sTr[i], p = sP[i], m = sM[i];
    if (t == null || p == null || m == null || t === 0) { plusDI.push(null); minusDI.push(null); dx.push(null); continue; }
    const pdi = (100 * p) / t, mdi = (100 * m) / t;
    plusDI.push(pdi); minusDI.push(mdi);
    dx.push(pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi));
  }
  return { adx: wilderOf(dx, n), plusDI, minusDI };
}

/** On-balance volume. Null wherever volume is missing. */
export function obv(bars: Bar[]): Line {
  const out: Line = [];
  let total = 0;
  for (let i = 0; i < bars.length; i++) {
    const v = bars[i].volume;
    if (v == null || !Number.isFinite(v)) { out.push(null); continue; }
    if (i > 0) {
      const d = bars[i].close - bars[i - 1].close;
      total += d > 0 ? v : d < 0 ? -v : 0;
    }
    out.push(total);
  }
  return out;
}

/** Heikin-Ashi bars: smoothed candles that show the trend more than each day's move. */
export function heikinAshi(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const close = (b.open + b.high + b.low + b.close) / 4;
    const open = i === 0 ? (b.open + b.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    out.push({ time: b.time, open, close, high: Math.max(b.high, open, close), low: Math.min(b.low, open, close), volume: b.volume });
  }
  return out;
}

// ------------------------------------------------------------------ the menu

export type IndicatorType = "sma" | "ema" | "bollinger" | "vwap" | "rsi" | "macd" | "stochastic" | "atr" | "adx" | "obv" | "volume";

export interface IndicatorDef {
  type: IndicatorType;
  label: string;
  /** "overlay" draws on the price pane; "pane" gets a pane of its own under it. */
  place: "overlay" | "pane";
  params: { key: string; label: string; value: number; min: number; max: number; step?: number }[];
  needsVolume?: boolean;
  what: string;
}

export const INDICATORS: IndicatorDef[] = [
  { type: "sma", label: "Simple moving average", place: "overlay", params: [{ key: "n", label: "Length", value: 50, min: 2, max: 400 }], what: "The average close of the last n bars." },
  { type: "ema", label: "Exponential moving average", place: "overlay", params: [{ key: "n", label: "Length", value: 20, min: 2, max: 400 }], what: "An average that weights recent closes more." },
  { type: "bollinger", label: "Bollinger bands", place: "overlay", params: [{ key: "n", label: "Length", value: 20, min: 2, max: 200 }, { key: "k", label: "Width (standard deviations)", value: 2, min: 0.5, max: 5, step: 0.5 }], what: "A moving average with bands k standard deviations above and below." },
  { type: "vwap", label: "VWAP (rolling)", place: "overlay", needsVolume: true, params: [{ key: "n", label: "Bars", value: 20, min: 2, max: 200 }], what: "The average price weighted by volume over the last n bars. Only where volume exists." },
  { type: "volume", label: "Volume", place: "pane", needsVolume: true, params: [], what: "How much traded in each bar. Only where the source gives volume." },
  { type: "rsi", label: "RSI", place: "pane", params: [{ key: "n", label: "Length", value: 14, min: 2, max: 100 }], what: "Relative strength index: recent gains against recent losses, from 0 to 100." },
  { type: "macd", label: "MACD", place: "pane", params: [{ key: "fast", label: "Fast", value: 12, min: 2, max: 100 }, { key: "slow", label: "Slow", value: 26, min: 3, max: 200 }, { key: "signal", label: "Signal", value: 9, min: 2, max: 50 }], what: "The gap between a fast and a slow average, with a signal line and a histogram." },
  { type: "stochastic", label: "Stochastic", place: "pane", params: [{ key: "n", label: "Length", value: 14, min: 2, max: 100 }, { key: "smooth", label: "%K smoothing", value: 3, min: 1, max: 10 }, { key: "d", label: "%D", value: 3, min: 1, max: 10 }], what: "Where the close sits in the recent high to low range, from 0 to 100." },
  { type: "atr", label: "ATR", place: "pane", params: [{ key: "n", label: "Length", value: 14, min: 2, max: 100 }], what: "Average true range: how far the price usually moves in a bar." },
  { type: "adx", label: "ADX", place: "pane", params: [{ key: "n", label: "Length", value: 14, min: 2, max: 100 }], what: "Average directional index: how strong a trend is, whichever way it goes." },
  { type: "obv", label: "On-balance volume", place: "pane", needsVolume: true, params: [], what: "A running total that adds volume on up bars and takes it away on down bars." },
];

export const indicatorDef = (t: IndicatorType) => INDICATORS.find((d) => d.type === t)!;

export interface IndicatorInstance { id: string; type: IndicatorType; params: Record<string, number> }

export function defaultParams(t: IndicatorType): Record<string, number> {
  return Object.fromEntries(indicatorDef(t).params.map((p) => [p.key, p.value]));
}

export function instanceLabel(i: IndicatorInstance): string {
  const short: Record<IndicatorType, string> = { sma: "SMA", ema: "EMA", bollinger: "BB", vwap: "VWAP", rsi: "RSI", macd: "MACD", stochastic: "Stoch", atr: "ATR", adx: "ADX", obv: "OBV", volume: "Volume" };
  const ps = indicatorDef(i.type).params.map((p) => i.params[p.key] ?? p.value);
  return ps.length ? `${short[i.type]} ${ps.join(", ")}` : short[i.type];
}

/** The lines one indicator draws, by name, for the chart and for the screener. */
export function compute(i: IndicatorInstance, bars: Bar[]): Record<string, Line> {
  const p = { ...defaultParams(i.type), ...i.params };
  switch (i.type) {
    case "sma": return { sma: sma(bars, p.n) };
    case "ema": return { ema: ema(bars, p.n) };
    case "bollinger": { const b = bollinger(bars, p.n, p.k); return { mid: b.mid, upper: b.upper, lower: b.lower }; }
    case "vwap": return { vwap: vwap(bars, p.n) };
    case "rsi": return { rsi: rsi(bars, p.n) };
    case "macd": { const m = macd(bars, p.fast, p.slow, p.signal); return { macd: m.macd, signal: m.signal, hist: m.hist }; }
    case "stochastic": { const s = stochastic(bars, p.n, p.smooth, p.d); return { k: s.k, d: s.d }; }
    case "atr": return { atr: atr(bars, p.n) };
    case "adx": { const a = adx(bars, p.n); return { adx: a.adx, plusDI: a.plusDI, minusDI: a.minusDI }; }
    case "obv": return { obv: obv(bars) };
    case "volume": return { volume: bars.map((b) => (b.volume != null && Number.isFinite(b.volume) ? b.volume : null)) };
  }
}
