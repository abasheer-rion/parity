import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { parityDocs } from "./plugins/docs";
import { parityLegal } from "./plugins/legal";
import { paritySite } from "./plugins/site";
import react from "@vitejs/plugin-react";

// In local development the dashboard can read the engine's latest run straight
// from disk, so you can see results without Supabase. This never runs in a build.
function localResults(): Plugin {
  const file = resolve(import.meta.dirname, "../engine/output/latest.json");
  return {
    name: "parity-local-results",
    apply: "serve",
    configureServer(server) {
      // `parity news export ../engine/output` writes the News page's files here.
      server.middlewares.use("/local/news", (req, res, next) => {
        const name = (req.url ?? "").replace(/^\//, "").split("?")[0];
        const path = resolve(import.meta.dirname, "../engine/output/news", name);
        if (!/^(archive\/)?[a-z0-9]+\.json$/.test(name) || !existsSync(path)) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
      // `parity markets export ../engine/output` writes the Markets pages' files here.
      server.middlewares.use("/local/markets", (req, res, next) => {
        const name = (req.url ?? "").replace(/^\//, "").split("?")[0];
        const path = resolve(import.meta.dirname, "../engine/output/markets", name);
        if (!/^[a-z]+\.json$/.test(name) || !existsSync(path)) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
      // `parity search export` writes the strategy search's results here (DEC-0014).
      server.middlewares.use("/local/search.json", (_req, res, next) => {
        const path = resolve(import.meta.dirname, "../engine/output/search.json");
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
        if (req.url && /^\/v\/[A-Za-z0-9]{12}\/?(\?.*)?$/.test(req.url)) req.url = "/v/index.html";
        next();
      });
    },
  };
}

function localScenarios(): Plugin {
  const file = process.env.PARITY_SCENARIOS_FILE ?? resolve(import.meta.dirname, "../engine/output/scenarios.json");
  // Sim World's map file, written by `parity world export` (DEC-0016).
  const world = process.env.PARITY_WORLD_FILE ?? resolve(import.meta.dirname, "../engine/output/world.json");
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
        const path = resolve(import.meta.dirname, "../engine/output/bots", name);
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
        const path = resolve(import.meta.dirname, "../engine/output/terminal", name);
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
//                            /verify/, the Verify badge pages (/v/<id>) and the legal pages under /legal/, with their assets
//                            in /assets/. Empties dist/.
//   vite build               the app, /app/, with every asset under /app/assets/ so the
//                            sign-in check in functions/_middleware.ts covers all of it.
//   vite build --mode sim    Sim World on its own (DEC-0020), /sim/, with every asset under
//                            /sim/assets/: sim.endyland.com sends /app/* away, so the sim
//                            must not load anything from /app/.
// `vite` (dev) serves all of them from one server.
const SITE_PAGES = [
  "index", "login/index", "signup/index", "reset/index", "verify/index", "v/index",
  "legal/index", "legal/privacy/index", "legal/terms/index", "legal/cookies/index", "legal/accessibility/index", "legal/risk/index",
];
const here = (p: string) => resolve(import.meta.dirname, p);

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), localResults(), localScenarios(), badgePages(), parityDocs(), paritySite(), parityLegal()],
  // The glossary is imported from ../docs, outside this folder.
  server: { fs: { allow: [".."] } },
  // The catalog and glossary are bundled on purpose (about 170 kB gzipped); the docs
  // chunk (about 350 kB gzipped) loads after first paint.
  build: command === "build" && mode === "site"
    ? {
        sourcemap: false,
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: { input: Object.fromEntries(SITE_PAGES.map((p) => [p.replace("/index", ""), here(`${p}.html`)])) },
      }
    : command === "build" && mode === "sim"
    ? {
        sourcemap: false,
        chunkSizeWarningLimit: 1800,
        outDir: "dist",
        emptyOutDir: false,
        assetsDir: "sim/assets",
        copyPublicDir: false,
        rollupOptions: { input: { sim: here("sim/index.html") } as Record<string, string> },
      }
    : {
        sourcemap: false,
        chunkSizeWarningLimit: 1800,
        outDir: "dist",
        emptyOutDir: false,
        assetsDir: "app/assets",
        copyPublicDir: false,
        // Two sides, one code base (DEC-0015): /app/ is the product, /research/ the research.
        // /sim/ is built on its own (--mode sim, above).
        rollupOptions: { input: { app: here("app/index.html"), research: here("research/index.html") } },
      },
}));
