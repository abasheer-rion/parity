// Draws the installable site's maskable icon from the brand's starburst mark (DEC-0041):
// public/icon-maskable-512.png, the mark on the dark brand background. Run it after
// changing the mark: `node scripts/app-icons.mjs`. The desktop app's icons come from
// desktop/scripts/icons.mjs.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const BG = "#10101a";
const markSvg = readFileSync(resolve(root, "public/brand/2026-10-21-starburst/parity-mark.svg"), "utf8");
const inner = markSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>.*?<\/title>/, "");

await initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));

/** The mark centred on a w x h canvas, `share` of the shorter side wide. */
function svg(w, h, share, bg = BG) {
  const size = Math.min(w, h) * share;
  const x = (w - size) / 2, y = (h - size) / 2, k = size / 64;
  const fill = bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${fill}<g transform="translate(${x} ${y}) scale(${k})">${inner}</g></svg>`;
}

function png(path, w, h, share, bg) {
  const out = new Resvg(svg(w, h, share, bg), { fitTo: { mode: "width", value: w } }).render().asPng();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, out);
  console.log(`wrote ${path.replace(`${root}/`, "")} (${w}x${h})`);
}

// The installable site: a maskable icon keeps the mark inside the middle 80% safe zone.
png(resolve(root, "public/icon-maskable-512.png"), 512, 512, 0.56);
