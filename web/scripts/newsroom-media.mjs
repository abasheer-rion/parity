// Image work for the newsroom pages (DEC-0053). scripts/newsroom/build.py runs this once per
// build and passes a JSON job on stdin:
//
//   { "og":     [{ "svg": "<svg ...>", "out": "/abs/dist/og/newsroom/<slug>.png" }],
//     "images": [{ "src": "/abs/content/newsroom/images/x.png", "outDir": "/abs/dist/newsroom/img/<slug>",
//                  "name": "hero", "widths": [480, 960, 1600] }] }
//
// It prints one JSON object: for each image its width and height, the files it wrote per format
// (AVIF, WebP and a JPEG fallback, never wider than the original) and a tiny blurred WebP as a
// data URI, shown while the real image loads. Share cards are drawn from SVG with resvg and the
// same Inter font files as the /og/ cards (DEC-0038). If sharp cannot load, images come back
// with "error" and the page falls back to the original file.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const job = JSON.parse(readFileSync(0, "utf8"));
const result = { images: {}, og: [] };

if (job.og?.length) {
  const resvg = await import("@resvg/resvg-wasm");
  await resvg.initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
  const fonts = ["inter-400", "inter-600"].map((f) => new Uint8Array(readFileSync(join(here, `../src/lib/og/fonts/${f}.bin`))));
  for (const card of job.og) {
    const r = new resvg.Resvg(card.svg, { fitTo: { mode: "original" }, font: { fontBuffers: fonts, defaultFontFamily: "Inter" } });
    try {
      mkdirSync(dirname(card.out), { recursive: true });
      writeFileSync(card.out, r.render().asPng());
      result.og.push(card.out);
    } finally {
      r.free();
    }
  }
}

if (job.images?.length) {
  let sharp = null;
  try {
    sharp = (await import("sharp")).default;
  } catch (err) {
    for (const img of job.images) result.images[img.src] = { error: `sharp not available: ${err.message}` };
  }
  for (const img of sharp ? job.images : []) {
    try {
      const meta = await sharp(img.src).metadata();
      const widths = [...new Set((img.widths ?? [480, 960, 1600]).map((w) => Math.min(w, meta.width)))].sort((a, b) => a - b);
      mkdirSync(img.outDir, { recursive: true });
      const variants = { avif: [], webp: [], jpg: [] };
      for (const w of widths) {
        const base = sharp(img.src).rotate().resize({ width: w, withoutEnlargement: true });
        const files = {
          avif: [base.clone().avif({ quality: 52, effort: 4 }), `${img.name}-${w}.avif`],
          webp: [base.clone().webp({ quality: 74 }), `${img.name}-${w}.webp`],
          jpg: [base.clone().flatten({ background: "#07080d" }).jpeg({ quality: 78, mozjpeg: true }), `${img.name}-${w}.jpg`],
        };
        for (const [fmt, [pipe, file]] of Object.entries(files)) {
          await pipe.toFile(join(img.outDir, file));
          variants[fmt].push([w, file]);
        }
      }
      const blur = await sharp(img.src).resize({ width: 24 }).blur(1.2).webp({ quality: 40 }).toBuffer();
      result.images[img.src] = {
        width: meta.width, height: meta.height, variants,
        blur: `data:image/webp;base64,${blur.toString("base64")}`, name: basename(img.src),
      };
    } catch (err) {
      result.images[img.src] = { error: String(err.message || err) };
    }
  }
}

process.stdout.write(JSON.stringify(result));
