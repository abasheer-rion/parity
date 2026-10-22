// The front page's globe of market "nodes", shared by the 3D hero (hero3d.ts) and the
// static picture drawn at build time for people who ask for reduced motion
// (plugins/site.ts). Same seed, same points, so the two match.
//
// Each node stands for one market in a family: currencies, stocks, bonds or
// commodities. Arcs join near neighbours. In the middle sits the Parity starburst.

export type Vec3 = [number, number, number];

export const FAMILIES = [
  { name: "Currencies", color: "#2f6bff" },
  { name: "Stocks", color: "#5cc2f5" },
  { name: "Bonds", color: "#a9bff7" },
  { name: "Commodities", color: "#6fdcb4" },
] as const;

export const NODE_COUNT = 220;
export const RAYS = 16;

/** A small, fixed random number generator, so every build draws the same globe. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Globe {
  nodes: { p: Vec3; family: number; size: number }[];
  arcs: [number, number][];
}

/** Points spread evenly over a sphere (a Fibonacci lattice), lightly jittered. */
export function makeGlobe(): Globe {
  const rand = rng(20261022);
  const nodes: Globe["nodes"] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NODE_COUNT; i++) {
    const y = 1 - ((i + 0.5) / NODE_COUNT) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden + (rand() - 0.5) * 0.25;
    const p: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r];
    // Families cluster loosely by longitude, like markets grouped by region and kind.
    const family = Math.floor(((Math.atan2(p[2], p[0]) + Math.PI) / (2 * Math.PI)) * 4 + (rand() - 0.5) * 0.9 + 4) % 4;
    nodes.push({ p, family, size: 0.6 + rand() * 0.8 });
  }
  const arcs: [number, number][] = [];
  for (let i = 0; i < NODE_COUNT; i += 3) {
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < NODE_COUNT; j++) {
      if (j === i) continue;
      const d = dist(nodes[i].p, nodes[j].p);
      if (d > 0.32 && d < bestD && rand() > 0.35) { best = j; bestD = d; }
    }
    if (best >= 0 && bestD < 0.75) arcs.push([i, best]);
  }
  return { nodes, arcs };
}

function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Points along the great circle from a to b, lifted off the surface in the middle. */
export function arcPoints(a: Vec3, b: Vec3, steps = 24, lift = 0.18): Vec3[] {
  const out: Vec3[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    const len = Math.hypot(x, y, z) || 1;
    const h = 1 + Math.sin(Math.PI * t) * lift;
    out.push([(x / len) * h, (y / len) * h, (z / len) * h]);
  }
  return out;
}

/** The starburst's ray tips and widths in its own plane, long and short rays alternating. */
export function starRays(radius = 0.62): { angle: number; length: number; width: number }[] {
  return Array.from({ length: RAYS }, (_, i) => ({
    angle: (i / RAYS) * Math.PI * 2 - Math.PI / 2,
    length: radius * (i % 2 === 0 ? 1 : 0.62),
    width: radius * 0.085,
  }));
}

/** The view used for the static picture and the 3D scene's starting pose. */
export const START_POSE = { rx: 0.32, ry: -0.5 };

/** Rotates a point by rx about x, then ry about y. */
export function rotate([x, y, z]: Vec3, rx: number, ry: number): Vec3 {
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  return [x1, y2, z2];
}
