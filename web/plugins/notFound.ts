// The dev server answers a missing address the way Cloudflare Pages does (DEC-0053), so
// `npm run dev` and the smoke test see the same thing as the live site:
//   a page that does not exist      web/404.html, with status 404
//   /<app>/<x> with nothing there   a redirect to /<app>/#/<x> (the apps route by the hash)
// Without this, Vite falls back to the front page for any unknown path, with status 200.
// Only page loads (Accept: text/html) come here; module, asset and data requests do not.
// The rules themselves are in src/lib/notFound.ts, shared with functions/_middleware.ts.
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { devPathAction } from "../src/lib/notFound";

const web = (p: string) => resolve(import.meta.dirname, "..", p);

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/** True when web/<rel> or web/public/<rel> is a file. */
export function devFileExists(encoded: string): boolean {
  let rel: string;
  try {
    rel = decodeURIComponent(encoded);
  } catch {
    return false;
  }
  if (rel.includes("..")) return false;
  return isFile(web(rel)) || isFile(web(`public/${rel}`));
}

export function parityNotFound(): Plugin {
  return {
    name: "parity-not-found",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if ((req.method !== "GET" && req.method !== "HEAD") || !req.url || !(req.headers.accept ?? "").includes("text/html")) return next();
        const url = new URL(req.url, "http://dev.local");
        if (/^\/(@|__|node_modules\/|src\/)/.test(url.pathname)) return next();
        const action = devPathAction(url.pathname, url.search, devFileExists);
        if (action.kind === "pass") return next();
        if (action.kind === "redirect") {
          res.statusCode = 302;
          res.setHeader("Location", action.to);
          res.end();
          return;
        }
        try {
          const html = await server.transformIndexHtml("/404.html", readFileSync(web("404.html"), "utf8"), req.originalUrl);
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.end(req.method === "HEAD" ? undefined : html);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}
