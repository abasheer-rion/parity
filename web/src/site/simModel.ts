// The front page's "large scale sim": thousands of illustrative price paths fanning
// out from today. Shared by the animated canvas (paths.ts) and the still picture drawn
// at build time (plugins/site.ts), so the two look alike.
//
// This is a simple random model, not Parity's research and not a forecast:
//   - each week's move is a small drift plus noise with fat tails (one week in twelve
//     is two and a half times as wild);
//   - calm and rough weeks cluster, as they do in real markets;
//   - the "shock" scenario adds one sudden fall, of a different size on each path.
// The page labels it as illustrative. Rules: DEC-0017 and DEC-0020.

export interface Scenario {
  id: string;
  /** Plain words shown on the page. */
  label: string;
  drift: number;
  vol: number;
  shock?: { week: number; mean: number; spread: number };
}

export const SCENARIOS: Scenario[] = [
  { id: "calm", label: "Calm years", drift: 0.0014, vol: 0.017 },
  { id: "rough", label: "Rough years", drift: 0.0011, vol: 0.031 },
  { id: "shock", label: "A sudden shock, then recovery", drift: 0.0024, vol: 0.021, shock: { week: 22, mean: -0.16, spread: 0.07 } },
];

/** Weeks drawn from today: two years. */
export const WEEKS = 104;
/** The vertical range shown, as growth of 1: from a 48% fall to a 115% gain. */
export const Y_MIN = Math.log(0.52);
export const Y_MAX = Math.log(2.15);

/** A small, fixed random number generator, so the same seed draws the same paths. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * `count` paths of WEEKS + 1 points each, as the log of growth of 1, in one flat
 * Float32Array (path i, week w is at i * (WEEKS + 1) + w). Week 0 is today, at 0.
 */
export function simulate(count: number, scenario: Scenario, seed: number): Float32Array {
  const rand = rng(seed);
  const n = WEEKS + 1;
  const out = new Float32Array(count * n);
  for (let i = 0; i < count; i++) {
    let v = 0;
    let heat = 1;
    const base = i * n;
    for (let w = 1; w < n; w++) {
      let z = gauss(rand);
      if (rand() < 1 / 12) z *= 2.5;
      heat = 0.85 * heat + 0.15 * (0.55 + 0.9 * Math.min(Math.abs(z), 3));
      v += scenario.drift + scenario.vol * heat * z;
      if (scenario.shock && w === scenario.shock.week) v += scenario.shock.mean + scenario.shock.spread * gauss(rand);
      out[base + w] = v;
    }
  }
  return out;
}

/** Where a path ends, as a rank from 0 (worst) to 1 (best), for colouring. */
export function finalRanks(paths: Float32Array, count: number): Float32Array {
  const n = WEEKS + 1;
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => paths[a * n + WEEKS] - paths[b * n + WEEKS]);
  const rank = new Float32Array(count);
  order.forEach((p, k) => { rank[p] = count > 1 ? k / (count - 1) : 0.5; });
  return rank;
}

/** The 5th, 50th and 95th percentile at each week, as three arrays of log growth. */
export function bands(paths: Float32Array, count: number): [Float32Array, Float32Array, Float32Array] {
  const n = WEEKS + 1;
  const lo = new Float32Array(n), mid = new Float32Array(n), hi = new Float32Array(n);
  const col = new Float32Array(count);
  for (let w = 0; w < n; w++) {
    for (let i = 0; i < count; i++) col[i] = paths[i * n + w];
    col.sort();
    lo[w] = col[Math.floor(0.05 * (count - 1))];
    mid[w] = col[Math.floor(0.5 * (count - 1))];
    hi[w] = col[Math.floor(0.95 * (count - 1))];
  }
  return [lo, mid, hi];
}

/** Colours from the worst ending to the best: deep blue, the brand blue, the team's light blues, mint. */
export const RAMP = ["#4a55c8", "#3f6df0", "#5b8cff", "#7fa6ff", "#a9bff7", "#cfe6fb", "#bfeedd", "#8fe0bf"];
