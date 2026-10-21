import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { parityDocs } from "./plugins/docs";
import react from "@vitejs/plugin-react";

// In local development the dashboard can read the engine's latest run straight
// from disk, so you can see results without Supabase. This never runs in a build.
function localResults(): Plugin {
  const file = resolve(import.meta.dirname, "../engine/output/latest.json");
  return {
    name: "parity-local-results",
    apply: "serve",
    configureServer(server) {
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
function localScenarios(): Plugin {
  const file = process.env.PARITY_SCENARIOS_FILE ?? resolve(import.meta.dirname, "../engine/output/scenarios.json");
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
    },
  };
}

// Two builds share this file (see package.json "build"):
//   vite build --mode site   the public pages: / (marketing), /login/, /signup/, /reset/,
//                            /verify/, with their assets in /assets/. Empties dist/.
//   vite build               the app, /app/, with every asset under /app/assets/ so the
//                            sign-in check in functions/_middleware.ts covers all of it.
// `vite` (dev) serves all of them from one server.
const SITE_PAGES = ["index", "login/index", "signup/index", "reset/index", "verify/index"];
const here = (p: string) => resolve(import.meta.dirname, p);

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), localResults(), localScenarios(), parityDocs()],
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
    : {
        sourcemap: false,
        chunkSizeWarningLimit: 1700,
        outDir: "dist",
        emptyOutDir: false,
        assetsDir: "app/assets",
        copyPublicDir: false,
        rollupOptions: { input: { app: here("app/index.html") } },
      },
}));
