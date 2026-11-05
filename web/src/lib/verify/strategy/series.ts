// Indicators on a daily series, written to give the same numbers as Pine Script's ta.*
// functions: a value is missing (NaN) until there is enough history, the exponential
// averages start from a simple average, and the RSI uses Wilder's average. Pure functions.

export type Series = Float64Array;

const make = (n: number) => new Float64Array(n).fill(NaN);

export function sma(x: Series, len: number): Series {
  const out = make(x.length);
  let sum = 0, bad = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (Number.isNaN(v)) bad++; else sum += v;
    if (i >= len) { const o = x[i - len]; if (Number.isNaN(o)) bad--; else sum -= o; }
    if (i >= len - 1 && bad === 0) out[i] = sum / len;
  }
  return out;
}

/** An average with weight alpha on today, seeded with the simple average of the first `len` values (Pine's ta.ema and ta.rma). */
function seeded(x: Series, len: number, alpha: number): Series {
  const out = make(x.length);
  let prev = NaN, run = 0, sum = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (Number.isNaN(prev)) {
      if (Number.isNaN(v)) { run = 0; sum = 0; continue; }
      run++; sum += v;
      if (run === len) { prev = sum / len; out[i] = prev; }
      continue;
    }
    if (Number.isNaN(v)) { out[i] = prev; continue; }
    prev = alpha * v + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

export const ema = (x: Series, len: number) => seeded(x, len, 2 / (len + 1));
export const rma = (x: Series, len: number) => seeded(x, len, 1 / len);

export function wma(x: Series, len: number): Series {
  const out = make(x.length);
  const norm = (len * (len + 1)) / 2;
  for (let i = len - 1; i < x.length; i++) {
    let s = 0, ok = true;
    for (let j = 0; j < len; j++) { const v = x[i - j]; if (Number.isNaN(v)) { ok = false; break; } s += v * (len - j); }
    if (ok) out[i] = s / norm;
  }
  return out;
}

export function change(x: Series, len: number): Series {
  const out = make(x.length);
  for (let i = len; i < x.length; i++) out[i] = x[i] - x[i - len];
  return out;
}

export function prev(x: Series, len: number): Series {
  const out = make(x.length);
  for (let i = len; i < x.length; i++) out[i] = x[i - len];
  return out;
}

export function roc(x: Series, len: number): Series {
  const out = make(x.length);
  for (let i = len; i < x.length; i++) out[i] = (100 * (x[i] - x[i - len])) / x[i - len];
  return out;
}

export function rsi(x: Series, len: number): Series {
  const up = make(x.length), down = make(x.length);
  for (let i = 1; i < x.length; i++) {
    const d = x[i] - x[i - 1];
    if (Number.isNaN(d)) continue;
    up[i] = Math.max(d, 0); down[i] = Math.max(-d, 0);
  }
  const u = rma(up, len), d = rma(down, len);
  const out = make(x.length);
  for (let i = 0; i < x.length; i++) {
    if (Number.isNaN(u[i]) || Number.isNaN(d[i])) continue;
    out[i] = d[i] === 0 ? 100 : u[i] === 0 ? 0 : 100 - 100 / (1 + u[i] / d[i]);
  }
  return out;
}

/** Population standard deviation, as Pine's ta.stdev with its default biased=true. */
export function stdev(x: Series, len: number): Series {
  const m = sma(x, len);
  const out = make(x.length);
  for (let i = len - 1; i < x.length; i++) {
    if (Number.isNaN(m[i])) continue;
    let s = 0;
    for (let j = 0; j < len; j++) s += (x[i - j] - m[i]) ** 2;
    out[i] = Math.sqrt(s / len);
  }
  return out;
}

function extreme(x: Series, len: number, hi: boolean): Series {
  const out = make(x.length);
  for (let i = len - 1; i < x.length; i++) {
    let v = hi ? -Infinity : Infinity, ok = true;
    for (let j = 0; j < len; j++) { const a = x[i - j]; if (Number.isNaN(a)) { ok = false; break; } v = hi ? Math.max(v, a) : Math.min(v, a); }
    if (ok) out[i] = v;
  }
  return out;
}
export const highest = (x: Series, len: number) => extreme(x, len, true);
export const lowest = (x: Series, len: number) => extreme(x, len, false);

/** Commodity channel index on one series: (x - average) / (0.015 x mean deviation). */
export function cci(x: Series, len: number): Series {
  const m = sma(x, len);
  const out = make(x.length);
  for (let i = len - 1; i < x.length; i++) {
    if (Number.isNaN(m[i])) continue;
    let dev = 0;
    for (let j = 0; j < len; j++) dev += Math.abs(x[i - j] - m[i]);
    dev /= len;
    out[i] = dev === 0 ? 0 : (x[i] - m[i]) / (0.015 * dev);
  }
  return out;
}

export function macd(x: Series, fast: number, slow: number): Series {
  const a = ema(x, fast), b = ema(x, slow);
  return a.map((v, i) => v - b[i]);
}
export const macdSignal = (x: Series, fast: number, slow: number, sig: number) => ema(macd(x, fast, slow), sig);
export function macdHist(x: Series, fast: number, slow: number, sig: number): Series {
  const m = macd(x, fast, slow), s = ema(m, sig);
  return m.map((v, i) => v - s[i]);
}

export function bb(x: Series, len: number, mult: number, upper: boolean): Series {
  const m = sma(x, len), d = stdev(x, len);
  return m.map((v, i) => (upper ? v + mult * d[i] : v - mult * d[i]));
}
