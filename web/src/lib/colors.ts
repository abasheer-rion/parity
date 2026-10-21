import type { StrategyRun } from "./types";

// Categorical slots from the validated reference palette (blue, orange, aqua first;
// those three pass the all-pairs colour-blind check in both modes). The benchmark is
// always the neutral ink colour so it reads as the reference line, not a contender.
// Past three strategies, lines stay distinguishable through the legend and direct
// labels, and slots 4 to 8 follow the same validated order.
const SLOTS = 8;

/** Colour follows the strategy name, never its rank in a filtered list. */
export function colorMap(runs: StrategyRun[]): Record<string, string> {
  const names = runs.filter((r) => !r.is_benchmark).map((r) => r.strategy).sort();
  const out: Record<string, string> = {};
  names.forEach((n, i) => (out[n] = `var(--series-${(i % SLOTS) + 1})`));
  runs.filter((r) => r.is_benchmark).forEach((r) => (out[r.strategy] = "var(--benchmark)"));
  return out;
}
