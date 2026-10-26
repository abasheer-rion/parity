// Small statistics helpers for Verify (REF-0016). Pure functions, no React. The moment
// definitions match the engine's Python: the mean, a sample standard deviation (n - 1,
// as pandas uses), and the biased skew and kurtosis that scipy.stats returns by default.

export function mean(x: readonly number[]): number {
  if (!x.length) return NaN;
  let s = 0;
  for (const v of x) s += v;
  return s / x.length;
}

/** Sample standard deviation (divides by n - 1, as pandas does). */
export function std(x: readonly number[]): number {
  const n = x.length;
  if (n < 2) return NaN;
  const m = mean(x);
  let s = 0;
  for (const v of x) s += (v - m) ** 2;
  return Math.sqrt(s / (n - 1));
}

/** Skew as scipy.stats.skew(bias=True): m3 / m2^1.5 with population moments. */
export function skew(x: readonly number[]): number {
  const n = x.length;
  if (n < 3) return NaN;
  const m = mean(x);
  let m2 = 0, m3 = 0;
  for (const v of x) { const d = v - m; m2 += d * d; m3 += d * d * d; }
  m2 /= n; m3 /= n;
  return m2 > 0 ? m3 / m2 ** 1.5 : NaN;
}

/** Kurtosis as scipy.stats.kurtosis(fisher=False, bias=True): m4 / m2^2 (3 for a normal). */
export function kurtosis(x: readonly number[]): number {
  const n = x.length;
  if (n < 4) return NaN;
  const m = mean(x);
  let m2 = 0, m4 = 0;
  for (const v of x) { const d = v - m; m2 += d * d; m4 += d ** 4; }
  m2 /= n; m4 /= n;
  return m2 > 0 ? m4 / (m2 * m2) : NaN;
}

/** Sharpe of a list of returns, not annualised (mean over sample standard deviation). */
export function sharpe(x: readonly number[]): number {
  const s = std(x);
  return s > 0 ? mean(x) / s : NaN;
}

/** Lag autocorrelation, as engine/src/parity/unsmooth.py ac(): 0 when undefined. */
export function autocorr(x: readonly number[], lag = 1): number {
  if (x.length <= lag + 2) return 0;
  const m = mean(x);
  const d = x.map((v) => v - m);
  let den = 0, num = 0;
  for (const v of d) den += v * v;
  for (let i = lag; i < d.length; i++) num += d[i] * d[i - lag];
  return den ? num / den : 0;
}

/** Value at a quantile with linear interpolation (numpy's default). */
export function quantile(x: readonly number[], q: number): number {
  if (!x.length) return NaN;
  const s = [...x].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// ---------------------------------------------------------------- the normal distribution

/** erfc by its power series near zero and a continued fraction in the tails (about 1e-13). */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return 2 - erfc(-x);
  if (x < 2.5) {
    // erf(x) = 2/sqrt(pi) * sum (-1)^n x^(2n+1) / (n! (2n+1))
    let term = x, sum = x;
    for (let n = 1; n < 200; n++) {
      term *= -x * x / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return 1 - (2 / Math.sqrt(Math.PI)) * sum;
  }
  if (x > 27) return 0;
  // Lentz's method for erfc(x) = exp(-x^2)/sqrt(pi) * 1/(x + 1/2/(x + 1/(x + 3/2/(x + ...)))).
  const tiny = 1e-300;
  let f = x, c = x, d = 0;
  for (let i = 1; i < 500; i++) {
    const a = i / 2;
    d = x + a * d;
    d = Math.abs(d) < tiny ? tiny : d;
    c = x + a / c;
    c = Math.abs(c) < tiny ? tiny : c;
    d = 1 / d;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / (Math.sqrt(Math.PI) * f);
}

/** Standard normal cumulative probability. */
export function normCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Standard normal quantile: Acklam's approximation, then one Halley step on normCdf. */
export function normPpf(p: number): number {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425, hi = 1 - lo;
  let x: number;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= hi) {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
