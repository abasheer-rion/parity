// Which deploy of the site a page came from (DEC-0086). Every build bakes one build id into
// the code (__PARITY_BUILD__) and writes it to /version.json. A page that has been open for a
// while (the desktop app keeps pages loaded for days) asks /version.json now and then; when
// the id there differs from its own, a newer deploy is live and it offers a reload
// (src/lib/siteVersion.ts). All six vite builds of one `npm run build` get the same id: the
// commit being built (GITHUB_SHA in CI, else git), so a deploy of the same commit is never
// "new". The dev server uses "dev", which never offers anything.
import { execFileSync } from "node:child_process";
import type { Plugin } from "vite";

function buildId(): string {
  const env = process.env.PARITY_BUILD_ID || process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA;
  if (env) return env.slice(0, 12);
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().slice(0, 12) || "local";
  } catch {
    return "local";
  }
}

export function parityVersion(): Plugin {
  let id = "dev";
  return {
    name: "parity-version",
    config(_c, env) {
      id = env.command === "build" ? buildId() : "dev";
      return { define: { __PARITY_BUILD__: JSON.stringify(id) } };
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: id }) + "\n" });
    },
  };
}
