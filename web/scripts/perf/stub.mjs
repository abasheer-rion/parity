// A local stand-in for the live site, for speed and black-screen checks with no real account:
// serves the built site (dist/) the way Cloudflare Pages does, and a fake Supabase that
// accepts a made-up session. Build with VITE_SUPABASE_URL=http://127.0.0.1:<supabase port>.
//
//   import { start } from "./stub.mjs"; const s = await start({ dist, delay, fail });
//   s.site, s.supabase  the two addresses; s.cookie(host) the fake session cookie; s.close()
//
// `delay` (ms) slows every Supabase answer, `fail` makes every database read answer 500, and
// `assetCache` sets the Cache-Control header on built assets (to compare before and after).
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";

const packed = new Map();

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };
const b64url = (s) => Buffer.from(s).toString("base64url");

/** The cache headers the live site sent before this change: protected apps revalidate every file. */
export const LIVE_BEFORE = (p) => /^\/(app|research|sim|trade|academy|lab)\//.test(p) ? "private, no-cache" : "public, max-age=14400, must-revalidate";

export function fakeSession(ref = "127") {
  const now = Math.floor(Date.now() / 1000);
  const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "stub@example.com", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", factors: [] };
  const payload = { sub: user.id, aud: "authenticated", role: "authenticated", email: user.email, aal: "aal1", amr: [{ method: "password", timestamp: now }], session_id: "stub", iss: `http://127.0.0.1/auth/v1`, iat: now, exp: now + 3600 * 24 };
  const jwt = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.${b64url("stub")}`;
  const session = { access_token: jwt, token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: "stub-refresh", user };
  return { session, user, name: `sb-${ref}-auth-token`, value: `base64-${b64url(JSON.stringify(session))}` };
}

function listen(server) {
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server.address().port)));
}

export async function start({ dist, data = null, delay = 0, fail = false, assetCache = "public, max-age=31536000, immutable", supabasePort = 54399, compress = true, protectedDelay = 0 } = {}) {
  const fake = fakeSession();
  const rows = new Map();
  const wait = () => new Promise((r) => setTimeout(r, delay));

  const supa = createServer(async (req, res) => {
    const cors = { "Access-Control-Allow-Origin": req.headers.origin || "*", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,PUT,OPTIONS", "Access-Control-Expose-Headers": "*" };
    if (req.method === "OPTIONS") { res.writeHead(204, cors).end(); return; }
    let body = "";
    for await (const c of req) body += c;
    if (delay) await wait();
    const url = new URL(req.url, "http://x");
    const json = (code, v) => res.writeHead(code, { ...cors, "Content-Type": "application/json" }).end(JSON.stringify(v));
    if (url.pathname.startsWith("/auth/v1/user")) return json(200, fake.user);
    if (url.pathname.startsWith("/auth/v1/token")) return json(200, fake.session);
    if (url.pathname.startsWith("/auth/v1/factors") || url.pathname.startsWith("/auth/v1/logout")) return json(200, {});
    if (url.pathname.startsWith("/rest/v1/")) {
      if (fail) return json(500, { message: "stub failure" });
      const table = url.pathname.slice(9).split("/")[0];
      const list = rows.get(table) ?? [];
      if (req.method === "GET" || req.method === "HEAD") return json(200, list);
      if (req.method === "POST") {
        let made = [];
        try { const v = JSON.parse(body || "[]"); made = (Array.isArray(v) ? v : [v]).map((r, i) => ({ id: `row-${Date.now()}-${i}`, user_id: fake.user.id, created_at: new Date().toISOString(), ...r })); } catch { /* empty */ }
        rows.set(table, [...list, ...made]);
        return json(201, made);
      }
      return json(200, []);
    }
    json(404, { message: "not stubbed" });
  });

  const site = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let p = decodeURIComponent(url.pathname);
    // The sign-in check (a Pages Function) runs before every protected file.
    if (protectedDelay && /^\/(app|research|sim|trade|academy|lab|data)(\/|$)/.test(p)) await new Promise((r) => setTimeout(r, protectedDelay));
    if (p === "/rum" || p.startsWith("/live/")) { res.writeHead(204).end(); return; }
    if (p.startsWith("/data/") && data) {
      const f = normalize(join(data, p.slice(6)));
      if (f.startsWith(data) && existsSync(f) && statSync(f).isFile()) return send(f, 200, "no-cache");
      res.writeHead(404, { "Content-Type": "text/plain" }).end("missing");
      return;
    }
    let file = normalize(join(dist, p));
    if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
    try { if (statSync(file).isDirectory()) file = join(file, "index.html"); } catch { /* below */ }
    if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
    let status = 200;
    if (!existsSync(file)) {
      // Cloudflare Pages: 404.html if there is one, else the front page (SPA fallback).
      const nf = join(dist, "404.html");
      if (existsSync(nf)) { file = nf; status = 404; } else file = join(dist, "index.html");
    }
    send(file, status, typeof assetCache === "function" ? assetCache(p) : /\/assets\//.test(p) ? assetCache : "no-cache");
    function send(file, status, cache) {
    const type = TYPES[extname(file)] || "application/octet-stream";
    const headers = { "Content-Type": type, "Cache-Control": cache };
    const etag = `"${statSync(file).size}-${statSync(file).mtimeMs}"`;
    headers.ETag = etag;
    if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers).end(); return; }
    let data = readFileSync(file);
    const ae = String(req.headers["accept-encoding"] || "");
    if (compress && /text|javascript|json|svg|css/.test(type)) {
      const enc = ae.includes("br") ? "br" : ae.includes("gzip") ? "gzip" : null;
      if (enc) {
        const k = `${enc}:${file}:${data.length}`;
        if (!packed.has(k)) packed.set(k, enc === "br" ? brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }) : gzipSync(data));
        data = packed.get(k);
        headers["Content-Encoding"] = enc;
      }
    }
    res.writeHead(status, headers).end(data);
    }
  });

  // Compress every file once up front, as a CDN would have it ready, so the first visit
  // does not wait for the stub to compress.
  const warm = (dir) => {
    for (const name of readdirSync(dir, { recursive: true })) {
      const f = join(dir, String(name));
      if (!statSync(f).isFile() || !/\.(js|css|json|html|svg)$/.test(f)) continue;
      const raw = readFileSync(f);
      packed.set(`br:${f}:${raw.length}`, brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }));
    }
  };
  if (compress) { warm(dist); if (data) warm(data); }
  const sp = await new Promise((ok, bad) => { supa.once("error", bad); supa.listen(supabasePort, "127.0.0.1", () => ok(supabasePort)); });
  const port = await listen(site);
  return {
    site: `http://127.0.0.1:${port}`,
    supabase: `http://127.0.0.1:${sp}`,
    cookie: (domain = "127.0.0.1") => ({ name: fake.name, value: fake.value, domain, path: "/" }),
    fake,
    close: () => { site.close(); supa.close(); },
  };
}
