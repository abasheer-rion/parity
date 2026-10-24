// The front page hero's field (DEC-0039): many noisy paths drifting left to right.
// Each path stands for one try in a strategy search. Most fade out part way, the way
// most tries turn out to be luck. A few survive and settle onto one thin line.
//
// The same numbers drive two pictures, so they always match:
//   - the WebGL field (field.ts), which moves, computes y(u) in its vertex shader;
//   - the still SVG drawn at build time (plugins/site.ts), shown first and kept for
//     reduced motion, no WebGL and low-power devices.
// It is an illustration, not research data.

/** Seeded random numbers (mulberry32), so the build and the browser draw the same field. */
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

export interface Path {
  /** Phases of the three waves that make up its noise. */
  p1: number; p2: number; p3: number;
  /** Frequencies of those waves. */
  f1: number; f2: number; f3: number;
  /** Where in the cloud it starts, -1 (bottom) to 1 (top). */
  y0: number;
  /** How far along (0 to 1) it fades out. Survivors never fade. */
  death: number;
  survivor: boolean;
  /** Seconds to cross the field. */
  cross: number;
}

export const SURVIVOR_SHARE = 0.012;

export function makePaths(count: number, seed = 7): Path[] {
  const r = rng(seed);
  const gauss = () => {
    // Sum of uniforms, close enough to a bell for a cloud.
    const g = (r() + r() + r() + r() - 2) / 2;
    return Math.max(-1, Math.min(1, g * 1.25));
  };
  const out: Path[] = [];
  for (let i = 0; i < count; i++) {
    const survivor = r() < SURVIVOR_SHARE;
    out.push({
      p1: r() * Math.PI * 2, p2: r() * Math.PI * 2, p3: r() * Math.PI * 2,
      f1: 2.4 + r() * 3.2, f2: 6.5 + r() * 6, f3: 15 + r() * 12,
      y0: gauss(),
      death: 0.18 + Math.pow(r(), 0.8) * 0.66,
      survivor,
      cross: 16 + r() * 12,
    });
  }
  return out;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The honest line the survivors settle on, in the same -1..1 units. */
export const line = (u: number) => -0.1 + 0.32 * u;

/** Height of a path at u (0 = left edge of the field, 1 = right), -1..1, up is positive. */
export function pathY(p: Path, u: number): number {
  const n = 0.5 * Math.sin(u * p.f1 + p.p1) + 0.3 * Math.sin(u * p.f2 + p.p2) + 0.2 * Math.sin(u * p.f3 + p.p3);
  const c = smooth(0.18, 1, u);
  const cloud = (p.y0 * 0.82 + n * 0.3) * (1 - 0.45 * c);
  if (!p.survivor) return cloud;
  return cloud + (line(u) - cloud) * Math.pow(c, 0.75);
}

/** Opacity of a path at u, 0..1, before the picture's own scale. */
export function pathAlpha(p: Path, u: number): number {
  const fadeIn = smooth(0, 0.08, u);
  if (p.survivor) return fadeIn * (0.55 + 0.45 * smooth(0.3, 0.9, u)) * (1 - smooth(0.985, 1, u));
  return fadeIn * (1 - smooth(p.death - 0.1, p.death, u)) * (0.75 - 0.35 * u);
}
