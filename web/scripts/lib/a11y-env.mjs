// What the accessibility checks open and how: every route from routes.mjs, the sign-in,
// legal and 404 pages, a sample of the static public pages (Learn, Ideas, Notes, Blog,
// News), and a local Vite server in one of two modes:
//   bypass       sign-in skipped (VITE_AUTH_BYPASS=1) with the smoke fixture data
//   signed-out   a visitor with no session; Supabase points at a dead local address, so
//                nothing ever reaches the hosted project
// Used by scripts/a11y.mjs (axe) and scripts/a11y-checks.mjs (keyboard, focus, zoom).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { routes } from "./routes.mjs";

const here = (p) => resolve(import.meta.dirname, "../..", p);

/** Pages outside routes.mjs: sign-in edge cases, the 404 page and each app's not-found view. */
export const EXTRA_PAGES = [
  "/verify/?type=email&token_hash=example", "/connect/", "/connect/claude/", "/connect/chatgpt/", "/connect/gemini/", "/oauth/consent/?authorization_id=example", "/oauth/openrouter/",
  "/v/no-such-badge", "/no-such-page-xyz/",
  ...["app", "research", "sim", "trade", "academy", "lab"].map((a) => `/${a}/#/no-such-page-xyz`),
];

const STATIC_ROOTS = ["learn", "ideas", "notes", "blog", "news", "tags", "authors", "newsroom"];
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".css": "text/css" };

/** Builds the static public pages (scripts/seo/build_public.py) into a temporary folder. */
export function buildPublic() {
  const out = mkdtempSync(join(tmpdir(), "parity-a11y-"));
  execFileSync("python3", [here("../scripts/seo/build_public.py"), "--out", out], { stdio: "ignore", env: { ...process.env, NEWSROOM_NO_MEDIA: "1" } });
  return out;
}

/** One page of each kind among the static pages: each section front page, one term, one
 *  idea, one note, one course and lesson, one post, one category, one tag and so on. */
export function publicSample(dir) {
  const seen = new Map();
  const walk = (rel) => {
    for (const name of readdirSync(join(dir, rel)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(join(dir, r)).isDirectory()) walk(r);
      else if (name === "index.html") {
        const segs = rel.split("/").filter(Boolean);
        if (!segs.length || !STATIC_ROOTS.includes(segs[0])) continue;
        const key = segs.map((s, i) => (i === 0 || ["academy", "category", "edge-lab", "private-markets"].includes(s) ? s : "*")).join("/");
        if (!seen.has(key)) seen.set(key, `/${rel}/`);
      }
    }
  };
  walk("");
  return [...seen.values()];
}

/** A Vite plugin that serves the built static pages ahead of the 404 handler. */
function servePublic(dir) {
  return {
    name: "a11y-public-pages",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? "").split("?")[0]);
        const first = path.split("/")[1];
        if (!STATIC_ROOTS.includes(first) || path.includes("..")) return next();
        let file = join(dir, path);
        if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
        if (!existsSync(file)) return next();
        res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
        res.end(readFileSync(file));
      });
    },
  };
}

/** Starts a dev server in one mode and returns { base, close }. */
export async function startServer(mode, publicDir) {
  const saved = { ...process.env };
  if (mode === "bypass") {
    process.env.VITE_AUTH_BYPASS = "1";
  } else {
    delete process.env.VITE_AUTH_BYPASS;
    process.env.VITE_SUPABASE_URL = "http://127.0.0.1:9";
    process.env.VITE_SUPABASE_ANON_KEY = "local-a11y-test";
  }
  process.env.PARITY_OUTPUT_DIR ??= here("tests/fixtures/smoke");
  const { createServer } = await import("vite");
  const server = await createServer({
    root: here("."), configFile: here("vite.config.ts"), logLevel: "error",
    cacheDir: here(`node_modules/.vite-a11y-${mode}`),
    plugins: publicDir ? [servePublic(publicDir)] : [],
    server: { port: mode === "bypass" ? 5311 : 5312, strictPort: false, host: "127.0.0.1" },
  });
  await server.listen();
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
  return { base: server.resolvedUrls.local[0].replace(/\/$/, ""), close: () => server.close() };
}

/** Every page to audit, in order. */
export function allPages(publicDir) {
  return [...new Set([...routes(), ...EXTRA_PAGES, ...(publicDir ? publicSample(publicDir) : [])])];
}

// The smoke fixture has no market data, so Trade and the Terminal would only say "No market
// data". A small made-up export (three daily series, as in scripts/onboarding.mjs) lets
// their charts, tables and the ticker tape be checked too.
function marketData() {
  const days = [];
  for (let d = new Date("2025-01-01"); days.length < 260; d.setDate(d.getDate() + 1)) if (d.getDay() % 6) days.push(d.toISOString().slice(0, 10));
  const make = (key, short, label, cls, group, start) => {
    const points = days.map((t, i) => [t, +(start * (1 + 0.1 * Math.sin(i / 20) + i / 2600)).toFixed(4)]);
    const last = points.at(-1)[1];
    return {
      meta: { key, label, short, group, class: cls, source: "test", licence: "test", kind: "price", unit: "", freq: "D", first: days[0], asof: days.at(-1), last,
        chg: { d1: 0.001, w1: 0.01, m1: 0.02, ytd: 0.05 }, vol: 0.1, z: 0.2, pct1y: 0.6, spark: points.slice(-30).map((p) => p[1]), file: `s/${key}.json` },
      points,
    };
  };
  const series = [make("eq.US_MKT", "SPX", "US stock market", "equities", "eq", 5000), make("fx.EUR", "EUR", "Euro", "fx", "fx", 1.08), make("cmd.WTI", "WTI", "Oil", "commodities", "cmd", 75)];
  const index = { generated_at: `${days.at(-1)}T00:00:00Z`, data_through: days.at(-1), groups: [{ id: "eq", label: "Stocks", class: "equities" }, { id: "fx", label: "Currencies", class: "fx" }, { id: "cmd", label: "Commodities", class: "commodities" }], series: series.map((x) => x.meta) };
  return { index, files: Object.fromEntries(series.map((x) => [x.meta.file, { key: x.meta.key, points: x.points }])) };
}
const MARKET = marketData();

/** A context with only local requests allowed (no hosted Supabase, no third parties). */
export async function localContext(browser, base, options = {}, { consent = true, tours = true } = {}) {
  const ctx = await browser.newContext({ reducedMotion: "reduce", ...options });
  await ctx.route((url) => !url.href.startsWith(base) && !url.protocol.startsWith("data") && !url.protocol.startsWith("blob"), (r) => r.abort());
  await ctx.route("**/local/terminal/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/local\/terminal\//, "");
    const body = path === "index.json" ? MARKET.index : MARKET.files[path];
    return body ? route.fulfill({ json: body }) : route.fulfill({ status: 404, body: "missing" });
  });
  if (consent) {
    await ctx.addInitScript(() => {
      try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 2, essential: true, analytics: false, decidedAt: "2026-01-01T00:00:00.000Z" })); } catch { /* private mode */ }
    });
  }
  if (!tours) {
    // First-run tours switched off, so the page under them is what gets checked.
    await ctx.addInitScript(() => {
      try { localStorage.setItem("parity.onboarding.v1", JSON.stringify({ checklist_hidden: false, tours_off: true, tours_seen: [], notify_brokerage: false })); } catch { /* private mode */ }
    });
  }
  return ctx;
}

/** Opens a page and waits until it has settled (text, data, redirects). */
export async function openPage(page, url) {
  try {
    await page.goto(url, { waitUntil: "load", timeout: 45000 });
  } catch { /* measured anyway */ }
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  // The page's own content, not just the app's frame (a lazy page can arrive a moment later).
  await page.waitForFunction(() => ((document.querySelector("main, [role=main]") ?? document.body)?.innerText ?? "").trim().length >= 40, null, { timeout: 15000 }).catch(() => {});
  // Loading placeholders gone (or a page heading already there).
  await page.waitForFunction(() => document.querySelector("h1") || !document.querySelector(".ui-skel, [aria-busy=true]"), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
}

/** Runs fn over items with n workers. */
export async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}
