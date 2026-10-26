// The arithmetic behind a number ticker (AnimatedNumber, CountUp): where the number is
// part-way through its glide, and how wide to hold it so the text around it never moves.
// Kept free of React and the DOM so it can be tested on its own.

/** Fast at first, settling gently: the curve every ticker uses. */
export function easeOutCubic(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return 1 - Math.pow(1 - t, 3);
}

/** The value shown at progress `p` (0 to 1) of a glide from `from` to `to`. */
export function tickAt(from: number, to: number, p: number): number {
  if (p >= 1) return to;
  if (p <= 0) return from;
  return from + (to - from) * easeOutCubic(p);
}

/** Progress of a glide that started at `t0` and lasts `ms`, at time `t`. */
export function progressAt(t0: number, t: number, ms: number): number {
  if (ms <= 0) return 1;
  return Math.min(1, Math.max(0, (t - t0) / ms));
}

/**
 * Width to hold, in characters, while gliding between two values: the longer of the two
 * formatted texts. With tabular figures every digit is the same width, so a value
 * passing through shorter or longer numbers never pushes the text beside it.
 */
export function tickerWidth(format: (v: number) => string, from: number, to: number): number {
  return Math.max(format(from).length, format(to).length);
}
