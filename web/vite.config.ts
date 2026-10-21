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

export default defineConfig({
  plugins: [react(), localResults(), localScenarios(), parityDocs()],
  // The glossary is imported from ../docs, outside this folder.
  server: { fs: { allow: [".."] } },
  // The catalog and glossary are bundled on purpose (about 170 kB gzipped); the docs
  // chunk (about 350 kB gzipped) loads after first paint.
  build: { sourcemap: false, chunkSizeWarningLimit: 1700 },
});
