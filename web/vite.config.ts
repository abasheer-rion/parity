import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { parityAnalytics } from "./plugins/analytics";
import { parityBoot } from "./plugins/boot";
import { parityDocs } from "./plugins/docs";
import { parityLegal } from "./plugins/legal";
import { parityMeta, parityOg } from "./plugins/meta";
import { parityNotFound } from "./plugins/notFound";
import { paritySite } from "./plugins/site";
import react from "@vitejs/plugin-react";

// The engine's output folder. PARITY_OUTPUT_DIR points the dev server at another one, such
// as the small fixture the CI smoke test uses (web/tests/fixtures/smoke).
const OUTPUT = process.env.PARITY_OUTPUT_DIR ? resolve(process.env.PARITY_OUTPUT_DIR) : resolve(import.meta.dirname, "../engine/output");

// In local development the dashboard can read the engine's latest run straight
// from disk, so you can see results without Supabase. This never runs in a build.
// The download page's links (DEC-0072) are a Pages Function in production. The dev server
// (and the smoke test that runs on it) answers them with a fixed sample and never calls GitHub.
function localDownload(): Plugin {
  const sample = {
    version: "0.0.0", published: "2026-01-01T00:00:00Z", notes: "https://github.com/abasheer-rion/parity/releases",
    files: [
      { platform: "mac-arm64", label: "Mac with Apple silicon", name: "Parity-0.0.0-arm64.dmg", size: 141_000_000, sha256: "0".repeat(64), url: "https://github.com/abasheer-rion/parity/releases" },
      { platform: "mac-intel", label: "Mac with Intel", name: "Parity-0.0.0-x64.dmg", size: 148_000_000, sha256: "0".repeat(64), url: "https://github.com/abasheer-rion/parity/releases" },
      { platform: "windows", label: "Windows", name: "Parity-Setup-0.0.0.exe", size: 132_000_000, sha256: "0".repeat(64), url: "https://github.com/abasheer-rion/parity/releases" },
    ],
  };
  return {
    name: "parity-local-download",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/download/latest", (req, res) => {
        const what = (req.url ?? "").replace(/^\//, "").split("?")[0];
        if (what === "info") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(sample)); return; }
        res.statusCode = 302;
        res.setHeader("Location", sample.notes);
        res.end();
      });
    },
  };
}

function localResults(): Plugin {
  const file = resolve(OUTPUT, "./latest.json");
  return {
    name: "parity-local-results",
    apply: "serve",
    configureServer(server) {
      // `parity news export ../engine/output` writes the News page's files here.
      server.middlewares.use("/local/news", (req, res, next) => {
        const name = (req.url ?? "").replace(/^\//, "").split("?")[0];
        const path = resolve(OUTPUT, "./news", name);
        if (!/^(archive\/)?[a-z0-9]+\.json$/.test(name) || !existsSync(path)) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
      // `parity markets export ../engine/output` writes the Markets pages' files here.
      server.middlewares.use("/local/markets", (req, res, next) => {
        const name = (req.url ?? "").replace(/^\//, "").split("?")[0];
        const path = resolve(OUTPUT, "./markets", name);
        if (!/^[a-z]+\.json$/.test(name) || !existsSync(path)) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
      // `parity search export` writes the strategy search's results here (DEC-0014).
      server.middlewares.use("/local/search.json", (_req, res, next) => {
        const path = resolve(OUTPUT, "./search.json");
        if (!existsSync(path)) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
      // `parity sims export` (or the sims service) writes the sims' summary here (DEC-0037).
      server.middlewares.use("/local/sims.json", (_req, res, next) => {
        const path = resolve(OUTPUT, "./sims.json");
        if (!existsSync(path)) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
      // `parity profiles export` (or the sims service) writes the competitor feedback counts here (DEC-0047).
      server.middlewares.use("/local/profiles.json", (_req, res, next) => {
        const path = resolve(OUTPUT, "./profiles.json");
        if (!existsSync(path)) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
      server.middlewares.use("/local/latest.json", (_req, res) => {
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end("Run `make run` first.");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(file));
      });
    },
  };
}

// The scenario simulator's file, written by `parity scenario export`. Dev only too.
// PARITY_SCENARIOS_FILE points it at another file (a test fixture, say).
// The public Verify badge pages live at /v/<id> (REF-0016). In production
// functions/v/[id].ts serves the built /v/ page for all of them; this does the same in dev.
function badgePages(): Plugin {
  return {
    name: "parity-badge-pages",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        // Any one-part address, as in production: the page itself says when there is no such badge.
        if (req.url && /^\/v\/[^/?]+\/?(\?.*)?$/.test(req.url)) req.url = "/v/index.html";
        next();
      });
    },
  };
}

function localScenarios(): Plugin {
  const file = process.env.PARITY_SCENARIOS_FILE ?? resolve(OUTPUT, "./scenarios.json");
  // Sim World's map file, written by `parity world export` (DEC-0016).
  const world = process.env.PARITY_WORLD_FILE ?? resolve(OUTPUT, "./world.json");
  return {
    name: "parity-local-scenarios",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/local/scenarios.json", (_req, res) => {
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end("Run `parity scenario export` first.");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(file));
      });
      server.middlewares.use("/local/stress.json", (_req, res) => {
        const file = resolve(OUTPUT, "./stress.json");
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end("Run `parity world stress` first.");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(file));
      });
      server.middlewares.use("/local/world.json", (_req, res) => {
        if (!existsSync(world)) {
          res.statusCode = 404;
          res.end("Run `parity world export` first.");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(world));
      });
      // Bot Battle's files, written by `parity bots export` (DEC-0031): index.json and
      // one file per replay, named by its id only.
      server.middlewares.use("/local/bots", (req, res) => {
        const name = (req.url ?? "").replace(/^\//, "").split("?")[0];
        const path = resolve(OUTPUT, "./bots", name);
        if (!/^[A-Za-z0-9-]+\.json$/.test(name) || !existsSync(path)) {
          res.statusCode = 404;
          res.end("Run `parity bots export` first.");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
      // Parity Terminal's files, written by `parity terminal export`: index.json and
      // s/<key>.json only, so a request can never reach outside the folder.
      server.middlewares.use("/local/terminal", (req, res) => {
        const name = (req.url ?? "").replace(/^\//, "").split("?")[0];
        const path = resolve(OUTPUT, "./terminal", name);
        if (!/^(index|s\/[A-Za-z0-9_.+-]+)\.json$/.test(name) || name.includes("..") || !existsSync(path)) {
          res.statusCode = 404;
          res.end("Run `parity terminal export` first.");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
    },
  };
}

// Three builds share this file (see package.json "build"):
//   vite build --mode site   the public pages: / (marketing), /login/, /signup/, /reset/,
//                            /verify/, the Verify badge pages (/v/<id>), the legal pages under /legal/ and
//                            404.html (served for any address that does not exist, DEC-0055), with their assets
//                            in /assets/. Empties dist/.
//   vite build               the app, /app/, with every asset under /app/assets/ so the
//                            sign-in check in functions/_middleware.ts covers all of it.
//   vite build --mode sim    Sim World on its own (DEC-0020), /sim/, with every asset under
//                            /sim/assets/: sim.paritytrading.app sends /app/* away, so the sim
//                            must not load anything from /app/.
//   vite build --mode trade  Parity Trade on its own (DEC-0040), /trade/, assets under
//                            /trade/assets/, for the same reason (trade.paritytrading.app).
//   vite build --mode academy  Parity Academy on its own (DEC-0042), /academy/, assets
//                            under /academy/assets/ (academy.paritytrading.app).
//   vite build --mode lab    Parity Workbench on its own (DEC-0043), /lab/, assets under
//                            /lab/assets/ (lab.paritytrading.app).
// `vite` (dev) serves all of them from one server.
const SITE_PAGES = [
  "index", "404", "login/index", "signup/index", "reset/index", "verify/index", "v/index",
  "connect/index", "oauth/consent/index", "oauth/openrouter/index",
  "developers/index", "legal/index", "legal/privacy/index", "legal/terms/index", "legal/cookies/index", "legal/accessibility/index", "legal/risk/index", "legal/regulatory/index",
  "download/index",
];
const here = (p: string) => resolve(import.meta.dirname, p);
// Libraries that change rarely get their own files, so a deploy that only changes Parity's
// code leaves them cached in the browser (REF-0024).
const VENDOR = {
  codeSplitting: {
    groups: [
      { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
      { name: "supabase", test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
    ],
  },
};

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), parityAnalytics(), parityBoot(), localResults(), localDownload(), localScenarios(), badgePages(), parityNotFound(), parityDocs(), paritySite(), parityLegal(), parityMeta(), parityOg()],
  // The glossary is imported from ../docs, outside this folder.
  server: { fs: { allow: [".."] } },
  // The catalog and glossary are bundled on purpose (about 170 kB gzipped); the docs
  // chunk (about 350 kB gzipped) loads after first paint.
  build: command === "build" && mode === "site"
    ? {
        sourcemap: false,
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
          input: {
            ...Object.fromEntries(SITE_PAGES.map((p) => [p.replace("/index", ""), here(`${p}.html`)])),
            // The analytics boot script under a fixed name, for the static public pages that
            // scripts/seo/build_public.py writes after this build (DEC-0053).
            "analytics-boot": here("src/lib/analytics/boot.ts"),
          },
          output: { entryFileNames: (chunk) => (chunk.name === "analytics-boot" ? "a/boot.js" : "assets/[name]-[hash].js") },
        },
      }
    : command === "build" && mode === "sim"
    ? {
        sourcemap: false,
        chunkSizeWarningLimit: 1800,
        outDir: "dist",
        emptyOutDir: false,
        assetsDir: "sim/assets",
        copyPublicDir: false,
        rollupOptions: { input: { sim: here("sim/index.html") } as Record<string, string>, output: VENDOR },
      }
    : command === "build" && (mode === "trade" || mode === "academy" || mode === "lab")
    ? {
        sourcemap: false,
        chunkSizeWarningLimit: 1800,
        outDir: "dist",
        emptyOutDir: false,
        assetsDir: `${mode}/assets`,
        copyPublicDir: false,
        rollupOptions: { input: { [mode]: here(`${mode}/index.html`) } as Record<string, string>, output: VENDOR },
      }
    : {
        sourcemap: false,
        chunkSizeWarningLimit: 1800,
        outDir: "dist",
        emptyOutDir: false,
        assetsDir: "app/assets",
        copyPublicDir: false,
        // Two sides, one code base (DEC-0015): /app/ is the product, /research/ the research.
        // /sim/, /trade/, /academy/ and /lab/ are built on their own (--mode sim, trade, academy, lab).
        rollupOptions: { input: { app: here("app/index.html"), research: here("research/index.html") }, output: VENDOR },
      },
}));
