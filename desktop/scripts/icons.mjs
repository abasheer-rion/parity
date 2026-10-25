// Draws the desktop app's icons from the brand's starburst icon (DEC-0041):
//   assets/icon.png   1024 square, the source electron-builder also understands
//   assets/icon.icns  macOS, a rounded square inset like other Mac apps (made with iconutil, Mac only)
//   assets/icon.ico   Windows, 16 to 256 pixels
// The results are committed, so the release builds do not need to run this.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const here = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(here, "../web/package.json"));
const resvgDir = dirname(require.resolve("@resvg/resvg-wasm/index_bg.wasm"));
const { initWasm, Resvg } = await import(pathToFileURL(join(resvgDir, "index.mjs")).href);
await initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));

const iconSvg = readFileSync(resolve(here, "../web/public/brand/2026-10-21-starburst/parity-icon-dark.svg"), "utf8");
const inner = iconSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>.*?<\/title>/, "");

/** The 64-unit icon drawn into a size x size canvas, inset by `pad` of the size on each side. */
function png(size, pad = 0) {
  const s = size * (1 - 2 * pad), o = size * pad;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g transform="translate(${o} ${o}) scale(${s / 64})">${inner}</g></svg>`;
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
}

const assets = join(here, "assets");
mkdirSync(assets, { recursive: true });
writeFileSync(join(assets, "icon.png"), png(1024, 0.098));

// macOS: Apple's grid leaves about 10% clear on each side of a 1024 icon.
try {
  const set = join(assets, "icon.iconset");
  rmSync(set, { recursive: true, force: true });
  mkdirSync(set);
  for (const s of [16, 32, 128, 256, 512]) {
    writeFileSync(join(set, `icon_${s}x${s}.png`), png(s, 0.098));
    writeFileSync(join(set, `icon_${s}x${s}@2x.png`), png(s * 2, 0.098));
  }
  execFileSync("iconutil", ["-c", "icns", set, "-o", join(assets, "icon.icns")]);
  rmSync(set, { recursive: true, force: true });
} catch (e) {
  console.warn(`icon.icns not made (${e.message}); electron-builder will use icon.png`);
}

// Windows: an .ico holding PNG images, which Windows Vista and later read.
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map((s) => png(s, 0));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1);
  head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(images[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
writeFileSync(join(assets, "icon.ico"), Buffer.concat([head, ...images]));
console.log("wrote assets/icon.png, icon.icns, icon.ico");
