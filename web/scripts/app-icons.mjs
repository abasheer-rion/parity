// Draws the app icons and splash screens from the brand's starburst mark (DEC-0041).
// Run after changing the mark: `npm run app:icons`. It writes:
//   public/icon-maskable-512.png               the installable site's maskable icon
//   ios/App/App/Assets.xcassets/...            the iOS app icon and splash, when ios/ exists
//   android/app/src/main/res/...               the Android launcher icons and splash, when android/ exists
// Every picture is the mark on the dark brand background. Nothing here is a secret.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// iOS: one 1024 icon (Xcode makes the rest) and a square splash image.
const ios = resolve(root, "ios/App/App/Assets.xcassets");
if (existsSync(ios)) {
  png(resolve(ios, "AppIcon.appiconset/AppIcon-512@2x.png"), 1024, 1024, 0.72);
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    png(resolve(ios, `Splash.imageset/${name}`), 2732, 2732, 0.16);
  }
}

// Android: legacy, round and adaptive (foreground on a plain background) launcher icons,
// and the splash drawable.
const res = resolve(root, "android/app/src/main/res");
if (existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    png(resolve(res, `mipmap-${d}/ic_launcher.png`), 48 * k, 48 * k, 0.72);
    png(resolve(res, `mipmap-${d}/ic_launcher_round.png`), 48 * k, 48 * k, 0.62);
    png(resolve(res, `mipmap-${d}/ic_launcher_foreground.png`), 108 * k, 108 * k, 0.42, null);
  }
  png(resolve(res, "drawable/splash.png"), 1280, 1280, 0.2);
  for (const [d, k] of Object.entries(dens)) {
    for (const o of ["port", "land"]) {
      const [w, h] = o === "port" ? [320 * k, 480 * k] : [480 * k, 320 * k];
      if (existsSync(resolve(res, `drawable-${o}-${d}`))) png(resolve(res, `drawable-${o}-${d}/splash.png`), w, h, 0.3);
    }
  }
}
