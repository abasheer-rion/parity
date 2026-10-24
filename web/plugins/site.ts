// The public front page (web/index.html) at build time:
//   <!--field-poster-->     the hero field drawn as a still SVG (src/site/fieldModel.ts). It
//                           shows before the moving field starts, and instead of it for
//                           reduced motion, no WebGL or a low-power device.
//   <!--bot-chart-->,       the Bot Battle chart and its strip of trades (src/site/botPath.ts)
//   <!--bot-tape-->
//   <!--backers-->          the "Supported by" strip (src/site/backers.ts)
//   <!--stat:algorithms-->  ideas in the algorithm library (catalog/algorithms)
//   <!--stat:official-->    official runs sealed in the ledger (ledger/runs.jsonl)
//   <!--stat:lessons-->     public Academy lessons (academy/courses/*.json)
// These counts are read from files in the repo, so they are exact for the commit built.
//
// The live counts (strategies tested, variations searched, terminal series) and the
// market strip come from /stats.json, written at deploy by scripts/export_site_data.py
// and scripts/export_front_strip.py (DEC-0021). In development this serves the same
// numbers from engine/output/.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { backersHtml } from "../src/site/backers";
import { botChartSvg, botTapeSvg } from "../src/site/botPath";
import { line, makePaths, pathAlpha, pathY } from "../src/site/fieldModel";

const root = (p: string) => resolve(import.meta.dirname, "../..", p);

function countAlgorithms(): number {
  const dir = root("catalog/algorithms");
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).length : 0;
}

function countOfficial(): number {
  const file = root("ledger/runs.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).length : 0;
}

function countLessons(): number {
  const dir = root("academy/courses");
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith(".json"))
    .reduce((n, f) => n + ((JSON.parse(readFileSync(resolve(dir, f), "utf8")) as { lessons?: unknown[] }).lessons?.length ?? 0), 0);
}

const r2 = (n: number) => Math.round(n * 1000) / 1000;

// The hero field's still picture (DEC-0039): the same paths as the moving field, drawn in
// the field's own box (u from 0 to 1 across, y from -1 to 1), so CSS places both the same
// way. It shows before the field starts and instead of it with reduced motion, no WebGL,
// data saving or a low-power device.
export function fieldPoster(): string {
  const paths = makePaths(300, 11);
  const lines: string[] = [];
  for (const p of paths) {
    const end = p.survivor ? 1 : p.death;
    const pts: string[] = [];
    for (let u = 0; u <= end + 1e-9; u += 1 / 48) pts.push(`${r2(u)},${r2(-pathY(p, u))}`);
    const mid = Math.min(end, 0.4);
    const a = Math.max(0.04, pathAlpha(p, mid) * (p.survivor ? 0.9 : 0.32));
    lines.push(`<polyline class="${p.survivor ? "s" : ""}" points="${pts.join(" ")}" stroke-opacity="${r2(a)}"/>`);
  }
  const honest = Array.from({ length: 21 }, (_, i) => i / 20).filter((u) => u >= 0.55).map((u) => `${r2(u)},${r2(-line(u))}`).join(" ");
  return `<svg class="field-poster" viewBox="0 -1 1 2" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
    + `<g fill="none" stroke="#9a9eb0" stroke-width="1" vector-effect="non-scaling-stroke">${lines.join("")}</g>`
    + `<polyline points="${honest}" fill="none" stroke="#f7f8fc" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}

function liveStats(): Record<string, unknown> | null {
  const latest = root("engine/output/latest.json");
  const search = root("engine/output/search.json");
  const terminal = root("engine/output/terminal/index.json");
  if (!existsSync(latest) && !existsSync(terminal)) return null;
  const out: Record<string, unknown> = {};
  if (existsSync(terminal)) {
    try {
      Object.assign(out, JSON.parse(execFileSync("python3", [root("scripts/export_front_strip.py"), "--index", terminal], { encoding: "utf8" })));
    } catch { /* the page labels a missing strip */ }
  }
  if (!existsSync(latest)) return out;
  const report = JSON.parse(readFileSync(latest, "utf8")) as { generated_at: string; runs: { is_benchmark?: boolean; gauntlet?: unknown }[] };
  out.generated_at = report.generated_at;
  const tested = report.runs.filter((r) => !r.is_benchmark && r.gauntlet);
  out.strategies_tested = tested.length;
  out.strategies_beat_market = tested.filter((r) => (r.gauntlet as { beats_sp500?: boolean }).beats_sp500 === true).length;
  if (existsSync(search)) {
    const snap = JSON.parse(readFileSync(search, "utf8")) as { trials: number; passed_luck_check?: number };
    out.variations_searched = snap.trials;
    if (typeof snap.passed_luck_check === "number") out.search_passed_luck = snap.passed_luck_check;
  }
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
          .replace("<!--field-poster-->", fieldPoster())
          .replace("<!--bot-chart-->", botChartSvg())
          .replace("<!--bot-tape-->", botTapeSvg())
          .replace("<!--backers-->", backersHtml())
          .replace(/<!--stat:algorithms-->/g, String(countAlgorithms()))
          .replace(/<!--stat:official-->/g, String(countOfficial()))
          .replace(/<!--stat:lessons-->/g, String(countLessons()));
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
