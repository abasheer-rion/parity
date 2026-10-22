// The public front page (web/index.html) at build time:
//   <!--hero-poster-->      the globe and starburst drawn as a still SVG. It shows before
//                           the 3D scene loads, and instead of it for people who ask for
//                           reduced motion or whose browser has no WebGL.
//   <!--stat:algorithms-->  ideas in the algorithm library (catalog/algorithms)
//   <!--stat:official-->    official runs sealed in the ledger (ledger/runs.jsonl)
// Both counts are read from files in the repo, so they are exact for the commit built.
//
// The two live counts (strategies tested, variations searched) come from /stats.json,
// written at deploy by scripts/export_site_data.py. In development this serves the
// same numbers from engine/output/.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { arcPoints, FAMILIES, makeGlobe, rotate, START_POSE, starRays, type Vec3 } from "../src/site/nodes";

const root = (p: string) => resolve(import.meta.dirname, "../..", p);

function countAlgorithms(): number {
  const dir = root("catalog/algorithms");
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).length : 0;
}

function countOfficial(): number {
  const file = root("ledger/runs.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).length : 0;
}

// Same camera as the 3D scene: 36 degree field of view, 3.4 units away, square frame.
const F = 1 / Math.tan((36 / 2) * (Math.PI / 180));
const D = 3.4;
const project = (p: Vec3): [number, number, number] => {
  const [x, y, z] = rotate(p, START_POSE.rx, START_POSE.ry);
  const s = F / (D - z);
  return [x * s * 100, -y * s * 100, z];
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export function heroPoster(): string {
  const { nodes, arcs } = makeGlobe();
  const arcPaths = arcs.map(([a, b]) => {
    const pts = arcPoints(nodes[a].p, nodes[b].p, 12).map(project);
    const front = pts.reduce((s, p) => s + p[2], 0) / pts.length > 0;
    return `<path d="M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join("L")}" opacity="${front ? 0.32 : 0.1}"/>`;
  }).join("");
  const dots = nodes
    .map((n) => ({ n, q: project(n.p) }))
    .sort((a, b) => a.q[2] - b.q[2])
    .map(({ n, q }) => {
      const front = (q[2] + 1) / 2;
      return `<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="${r1((0.5 + n.size * 0.7) * (0.55 + front * 0.6))}" fill="${FAMILIES[n.family].color}" opacity="${r1(0.25 + front * 0.75)}"/>`;
    }).join("");
  const rays = starRays(47).map(({ angle, length, width }) => {
    const tip = [Math.cos(angle) * length, Math.sin(angle) * length];
    const side = [Math.cos(angle + Math.PI / 2) * width, Math.sin(angle + Math.PI / 2) * width];
    return `<polygon points="0,0 ${r1(side[0])},${r1(side[1])} ${r1(tip[0])},${r1(tip[1])}" fill="#3fb3f0"/>`
      + `<polygon points="0,0 ${r1(tip[0])},${r1(tip[1])} ${r1(-side[0])},${r1(-side[1])}" fill="#1d4f8f"/>`;
  }).join("");
  return `<svg class="hero-poster" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">`
    + `<defs><radialGradient id="hp-glow"><stop offset="0" stop-color="#2f6bff" stop-opacity=".35"/><stop offset="1" stop-color="#2f6bff" stop-opacity="0"/></radialGradient></defs>`
    + `<circle r="70" fill="url(#hp-glow)"/>`
    + `<g fill="none" stroke="#7fa6ff" stroke-width=".5">${arcPaths}</g>${dots}<g>${rays}<circle r="4.2" fill="#5cc2f5"/></g></svg>`;
}

function liveStats(): Record<string, number | string> | null {
  const latest = root("engine/output/latest.json");
  const search = root("engine/output/search.json");
  if (!existsSync(latest)) return null;
  const report = JSON.parse(readFileSync(latest, "utf8")) as { generated_at: string; runs: { is_benchmark?: boolean; gauntlet?: unknown }[] };
  const out: Record<string, number | string> = {
    generated_at: report.generated_at,
    strategies_tested: report.runs.filter((r) => !r.is_benchmark && r.gauntlet).length,
  };
  if (existsSync(search)) out.variations_searched = (JSON.parse(readFileSync(search, "utf8")) as { trials: number }).trials;
  return out;
}

export function paritySite(): Plugin {
  return {
    name: "parity-site",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (ctx.path !== "/index.html") return html;
        return html
          .replace("<!--hero-poster-->", heroPoster())
          .replace(/<!--stat:algorithms-->/g, String(countAlgorithms()))
          .replace(/<!--stat:official-->/g, String(countOfficial()));
      },
    },
    configureServer(server) {
      server.middlewares.use("/stats.json", (_req, res, next) => {
        const stats = liveStats();
        if (!stats) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(stats));
      });
    },
  };
}
