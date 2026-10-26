// Page metadata and share images at build time (DEC-0038).
//
//   parityMeta()  writes every page's <head> tags (title, description, canonical, share
//                 cards, icons, theme colour, structured data) from src/lib/meta.ts, in dev
//                 and in every build. It runs last, so it also replaces any such tags a page
//                 or another plugin wrote: edit the table in src/lib/meta.ts, not the HTML.
//   parityOg()    draws the static share images, /og/<key>.png, one per OG_CARDS entry,
//                 into the site build, and serves them (and /og/strategy/<id>.png) in dev.
//                 The live cards for badges and strategies come from functions/og/.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { LOGO_PATH, OG_CARDS, PAGES, withHead } from "../src/lib/meta";
import { cardSvg, pageCardSvg } from "../src/lib/og/card";
import { isStrategyId, strategyCard } from "../src/lib/og/share";

const here = (p: string) => resolve(import.meta.dirname, p);

export function parityMeta(): Plugin {
  return {
    name: "parity-meta",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const page = PAGES[ctx.path.replace(/^\//, "")];
        if (!page) {
          console.warn(`parity-meta: no entry in src/lib/meta.ts PAGES for ${ctx.path}`);
          return html;
        }
        return withHead(html, page);
      },
    },
  };
}

let wasm: Promise<typeof import("@resvg/resvg-wasm")> | null = null;

/** SVG to PNG in Node, with the same renderer and fonts as the Cloudflare functions. */
export async function renderPng(svg: string): Promise<Uint8Array> {
  wasm ??= (async () => {
    const mod = await import("@resvg/resvg-wasm");
    const require = createRequire(import.meta.url);
    await mod.initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
    return mod;
  })();
  const { Resvg } = await wasm;
  const fonts = ["inter-400", "inter-600"].map((f) => new Uint8Array(readFileSync(here(`../src/lib/og/fonts/${f}.bin`))));
  const r = new Resvg(svg, { fitTo: { mode: "original" }, font: { fontBuffers: fonts, defaultFontFamily: "Inter" } });
  try {
    return r.render().asPng();
  } finally {
    r.free();
  }
}

const logo = () => readFileSync(here(`../public${LOGO_PATH}`), "utf8");

export function parityOg(): Plugin {
  let site = false;
  return {
    name: "parity-og",
    configResolved(config) { site = config.command === "build" && config.mode === "site"; },
    async generateBundle() {
      if (!site) return;
      const svgLogo = logo();
      for (const key of Object.keys(OG_CARDS)) {
        this.emitFile({ type: "asset", fileName: `og/${key}.png`, source: await renderPng(pageCardSvg(key, svgLogo)) });
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = (req.url ?? "").split("?")[0].match(/^\/og\/(?:(strategy)\/)?([a-z0-9_]+)\.png$/);
        if (!m || (m[1] ? !isStrategyId(m[2]) : !OG_CARDS[m[2]])) return next();
        const svg = m[1] ? cardSvg(strategyCard(m[2]), logo()) : pageCardSvg(m[2], logo());
        res.setHeader("Content-Type", "image/png");
        res.end(Buffer.from(await renderPng(svg)));
      });
    },
  };
}
