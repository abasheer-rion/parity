// The Parity price (DEC-0065): one price per asset from many sources, the way Pyth combines
// its publishers. Each source gives a price, a confidence (how far off it may be) and a
// weight. Each casts three votes, at price minus confidence, price, and price plus
// confidence, all with its weight. The aggregate is the weighted median of the votes, and
// its confidence is the larger distance from it to the votes' 25th and 75th percentiles.
// Before that, sources older than the stale limit are left out (unless none is fresh), and
// with three or more sources, any more than 5% from the first median is dropped as an
// outlier. Pure code, no network.

export interface SourceQuote {
  /** Price in USD. */
  p: number;
  /** Confidence: half the band the true price likely sits in, USD. */
  c: number;
  /** Weight: recent dollar volume plus a depth prior. */
  w: number;
  /** When this price was set (exchange time, ms). */
  at: number;
}

export interface Aggregate {
  p: number;
  c: number;
  /** Sources used. */
  n: number;
  /** Newest time among the sources used. */
  at: number;
  /** True when every source was older than the stale limit. */
  stale: boolean;
}

export interface AggregateOptions {
  /** A source older than this is left out while any fresh one exists. */
  staleMs?: number;
  /** With three or more sources, drop those further than this from the median (fraction). */
  outlier?: number;
}

type Vote = [value: number, weight: number];

/** The value at fraction q of the total weight (votes sorted by value). */
export function weightedQuantile(votes: Vote[], q: number): number {
  const v = votes.filter(([x, w]) => Number.isFinite(x) && w > 0).sort((a, b) => a[0] - b[0]);
  if (!v.length) return Number.NaN;
  const total = v.reduce((s, [, w]) => s + w, 0);
  const target = q * total;
  const eps = total * 1e-12;
  let cum = 0;
  for (let i = 0; i < v.length; i += 1) {
    cum += v[i][1];
    if (cum > target + eps) return v[i][0];
    // Exactly on the boundary between two votes: halfway, as a median of an even count.
    if (cum >= target - eps) return i + 1 < v.length ? (v[i][0] + v[i + 1][0]) / 2 : v[i][0];
  }
  return v[v.length - 1][0];
}

const votesOf = (qs: SourceQuote[]): Vote[] => qs.flatMap((q) => [[q.p - q.c, q.w], [q.p, q.w], [q.p + q.c, q.w]] as Vote[]);

export function aggregate(quotes: SourceQuote[], now: number, opts: AggregateOptions = {}): Aggregate | null {
  const staleMs = opts.staleMs ?? 600_000, outlier = opts.outlier ?? 0.05;
  const valid = quotes.filter((q) => Number.isFinite(q.p) && q.p > 0 && Number.isFinite(q.c) && q.c >= 0 && q.w > 0 && Number.isFinite(q.at));
  if (!valid.length) return null;
  const fresh = valid.filter((q) => now - q.at <= staleMs);
  let used = fresh.length ? fresh : valid;
  let mid = weightedQuantile(votesOf(used), 0.5);
  if (used.length >= 3) {
    const kept = used.filter((q) => Math.abs(q.p - mid) / mid <= outlier);
    if (kept.length && kept.length < used.length) { used = kept; mid = weightedQuantile(votesOf(used), 0.5); }
  }
  const votes = votesOf(used);
  const lo = weightedQuantile(votes, 0.25), hi = weightedQuantile(votes, 0.75);
  return { p: mid, c: Math.max(mid - lo, hi - mid, 0), n: used.length, at: Math.max(...used.map((q) => q.at)), stale: !fresh.length };
}
