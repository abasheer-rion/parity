// A small static server for the built site (web/dist) that answers like Cloudflare Pages
// and functions/_middleware.ts, so the E2E suite tests what we deploy, not the dev server:
//   - folders open their index.html, and /x opens x.html or x/index.html (clean addresses)
//   - an address that does not exist gets dist/404.html with status 404 (DEC-0055)
//   - the apps and /data/ need the Supabase session cookie; without it a page goes to
//     /login/?next=<where you were> and a code file or data file gets a plain 401
//   - a missing page under an app folder goes to /<app>/#/<rest> (src/lib/notFound.ts)
//   - /v/<id> opens the badge page, like functions/v/[id].ts
//   - /download/latest/* answers a fixed sample, like functions/download/latest/[what].ts
// The cookie's token is not checked here: the browser side of sign-in is what the suite
// tests, and every call to Supabase is stubbed in the page (e2e/supabase.ts).
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import { SAMPLE_DOWNLOAD } from "../src/lib/desktopDownload";
import { appHashRedirect } from "../src/lib/notFound";

const DIST = resolve(import.meta.dirname, "../dist");
const COOKIE = "sb-ttqvpxvctnomfbeoqbbs-auth-token";
const PROTECTED = /^\/(app|research|sim|trade|academy|lab|data)(\/|$)/;
const HASHED = /^\/(app|research|sim|trade|academy|lab)\/assets\//;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".woff": "font/woff", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm", ".map": "application/json", ".pdf": "application/pdf", ".csv": "text/csv",
};

const isFile = (p: string) => { try { return statSync(p).isFile(); } catch { return false; } };

/** The file in dist for a path, or null. */
export function fileFor(pathname: string): string | null {
  if (pathname.includes("..")) return null;
  const rel = pathname.replace(/^\/+/, "");
  const base = join(DIST, rel);
  if (isFile(base)) return base;
  const dir = base.replace(/\/+$/, "");
  if (isFile(`${dir}/index.html`)) return `${dir}/index.html`;
  if (isFile(`${dir}.html`)) return `${dir}.html`;
  return null;
}

function signedIn(cookie: string | undefined): boolean {
  return (cookie ?? "").split(";").some((c) => c.trim().startsWith(`${COOKIE}=`) || c.trim().startsWith(`${COOKIE}.0=`));
}

export function startServer(port: number): Promise<Server> {
  if (!existsSync(join(DIST, "index.html"))) throw new Error("web/dist is missing. Run `npm run build` first.");
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://e2e.local");
    let pathname: string;
    try { pathname = decodeURIComponent(url.pathname); } catch { pathname = "/"; }
    const send = (status: number, file: string | null, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "Content-Type": file ? TYPES[extname(file)] ?? "application/octet-stream" : "text/plain", "Cache-Control": "no-store", ...headers });
      if (!file || req.method === "HEAD") { res.end(); return; }
      createReadStream(file).pipe(res);
    };
    if (PROTECTED.test(pathname) && !signedIn(req.headers.cookie)) {
      if (pathname.startsWith("/data/") || HASHED.test(pathname)) { res.writeHead(401, { "Content-Type": "text/plain" }); res.end("Sign in to see this."); return; }
      res.writeHead(302, { Location: `/login/?next=${encodeURIComponent(url.pathname + url.search)}`, "Cache-Control": "no-store" });
      res.end();
      return;
    }
    if (/^\/v\/[^/]+\/?$/.test(pathname)) return send(200, join(DIST, "v/index.html"));
    // The download page's links, a Function in production (functions/download/latest/[what].ts).
    if (pathname === "/download/latest/info") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(SAMPLE_DOWNLOAD)); return; }
    if (pathname.startsWith("/download/latest/")) { res.writeHead(302, { Location: SAMPLE_DOWNLOAD.notes }); res.end(); return; }
    const file = fileFor(pathname);
    if (file) return send(200, file);
    const to = appHashRedirect(url.pathname, url.search);
    if (to) { res.writeHead(302, { Location: to }); res.end(); return; }
    return send(404, join(DIST, "404.html"));
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => ok(server));
  });
}
