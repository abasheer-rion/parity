// Bug crawl: opens every page of every Parity app, follows the links it finds and records
// what went wrong: console errors and warnings, uncaught exceptions, failed or slow
// requests, NaN/undefined/Infinity in the text, blank or stuck pages and sideways scroll.
//
//   VITE_AUTH_BYPASS=1 npx vite --port 5199 --host 127.0.0.1   (in another terminal)
//   CRAWL_BASE=http://127.0.0.1:5199 node scripts/crawl.mjs
//   CRAWL_BASE=https://paritytrading.app CRAWL_LIVE=1 node scripts/crawl.mjs   (signed out)
//
// CRAWL_JSON=path writes every finding. CRAWL_MAX caps the pages per size (default 400).
// CRAWL_SIZES=desktop,phone picks the sizes. It never signs in and never types a password.
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = (process.env.CRAWL_BASE ?? "http://127.0.0.1:5199").replace(/\/$/, "");
const LIVE = process.env.CRAWL_LIVE === "1";
const MAX = Number(process.env.CRAWL_MAX ?? 400);
const SLOW_MS = Number(process.env.CRAWL_SLOW_MS ?? 4000);
const SIZES = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
].filter((s) => (process.env.CRAWL_SIZES ?? "desktop,phone").split(",").includes(s.name));

const PRODUCT = ["", "start", "how", "learn", "settings", "verify", "strategies", "watchlist", "news", "news/archive", "news/impact", "news/history",
  "markets", "markets/new", "markets/crypto", "markets/perps", "markets/etfs", "markets/private", "markets/terms", "markets/practice", "ui"];
const RESEARCH = ["", "docs", "search", "ledger", "catalog", "sim", "competitors", "pairs", "private", "signals", "explore", "data", "registry", "latency", "sources", "refs", "settings", "ui"];
const SEEDS = [
  "/", "/login/", "/signup/", "/reset/", "/verify/", "/legal/", "/legal/privacy/", "/legal/terms/", "/legal/cookies/", "/legal/accessibility/", "/legal/risk/", "/legal/regulatory/", "/download/", "/connect/claude/", "/connect/chatgpt/", "/connect/gemini/",
  ...PRODUCT.map((r) => `/app/#/${r}`),
  ...RESEARCH.map((r) => `/research/#/${r}`),
  ...["chart", "markets", "watchlists", "screener", "portfolio", "orders", "alerts", "strategies", "settings"].map((v) => `/trade/#/${v}`),
  ...["try", "whatif", "compare", "search", "edges", "settings"].map((v) => `/lab/#/${v}`),
  ...["", "progress", "settings"].map((v) => `/academy/#/${v}`),
  ...["overview", "macro", "fx", "commodities", "simlab", "map", "crises", "bots"].map((v) => `/sim/#/${v}`),
  // Old routes that must move into their own app.
  "/app/#/trade", "/app/#/trade/screener", "/app/#/academy", "/app/#/lab", "/app/#/scenarios", "/app/#/compare", "/research/#/edges", "/research/#/search",
  "/app/#/docs", "/research/#/strategies",
];

const own = (u) => {
  try {
    const url = new URL(u, BASE);
    return url.origin === new URL(BASE).origin ? url : null;
  } catch { return null; }
};
const key = (u) => {
  const url = own(u);
  if (!url) return null;
  if (/\.(png|svg|jpg|pdf|json|xml|txt|webmanifest|ico|zip|dmg|exe|csv)$/i.test(url.pathname)) return null;
  return url.pathname + url.hash;
};

// Pages of one kind (every doc, every strategy) are sampled, not all visited: at most
// CRAWL_PER_KIND (default 3) per app path and first two hash parts.
const PER_KIND = Number(process.env.CRAWL_PER_KIND ?? 3);
const WORKERS = Number(process.env.CRAWL_WORKERS ?? 4);
const kindOf = (k) => {
  const [p, h = ""] = k.split("#");
  const parts = h.replace(/^\//, "").split("?")[0].split("/");
  return `${p}#${parts[0] ?? ""}/${parts.length > 1 ? "*" : ""}`;
};

const IGNORE_CONSOLE = [/Download the React DevTools/, /\[vite\]/, /Lit is in dev mode/];
const browser = await chromium.launch();
const findings = [];
const add = (size, path, kind, detail) => findings.push({ size, path, kind, detail: String(detail).slice(0, 400) });

for (const size of SIZES) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: "reduce" });
  const queue = [...SEEDS];
  const seen = new Set(queue.map(key));
  const kinds = new Map();
  let visited = 0;
  let active = 0;
  const worker = async () => {
  while ((queue.length || active) && visited < MAX) {
    if (!queue.length) { await new Promise((r) => setTimeout(r, 200)); continue; }
    const path = queue.shift();
    visited++;
    active++;
    const page = await context.newPage();
    const t0 = new Map();
    page.on("console", (m) => {
      if (m.type() !== "error" && m.type() !== "warning") return;
      const text = m.text();
      if (IGNORE_CONSOLE.some((r) => r.test(text))) return;
      add(size.name, path, `console.${m.type()}`, `${text} @ ${m.location()?.url ?? ""}`);
    });
    page.on("crash", () => add(size.name, path, "crash", "the page crashed"));
    page.on("pageerror", (e) => add(size.name, path, "exception", e.stack ?? e.message));
    page.on("request", (r) => t0.set(r, Date.now()));
    page.on("requestfailed", (r) => {
      const f = r.failure()?.errorText ?? "";
      if (/ERR_ABORTED/.test(f)) return;
      add(size.name, path, "request.failed", `${r.method()} ${r.url()} ${f}`);
    });
    page.on("response", (r) => {
      const ms = Date.now() - (t0.get(r.request()) ?? Date.now());
      if (r.status() >= 400) add(size.name, path, `http.${r.status()}`, `${r.request().method()} ${r.url()}`);
      else if (ms > SLOW_MS) add(size.name, path, "slow", `${ms}ms ${r.url()}`);
    });
    page.on("dialog", (d) => { add(size.name, path, "dialog", d.message()); d.dismiss().catch(() => {}); });
    // Popups (window.open) are recorded, not followed.
    context.on("page", () => {});
    try {
      await page.goto(BASE + path, { waitUntil: "load", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => add(size.name, path, "never-idle", "network still busy 10s after load"));
    } catch (e) {
      add(size.name, path, "goto", e.message.split("\n")[0]);
    }
    await page.waitForTimeout(1500).catch(() => {});
    const finalUrl = page.url();
    const info = await page.evaluate(() => {
      const text = document.body?.innerText ?? "";
      const bad = [];
      for (const m of text.matchAll(/(^|[^A-Za-z])(NaN|undefined|Infinity|null%|\[object Object\])(?![A-Za-z])/g)) {
        const i = m.index ?? 0;
        bad.push(text.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, " "));
      }
      const loading = [...document.querySelectorAll('[aria-busy="true"], .skeleton, .ui-skel, [class*="skeleton"]')].filter((e) => (e).offsetParent !== null).length;
      const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
      // Elements wider than the window (sideways scroll), the worst few.
      const vw = window.innerWidth;
      const wide = [];
      if (document.documentElement.scrollWidth > vw + 1) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
            wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} right=${Math.round(r.right)}`);
            if (wide.length > 4) break;
          }
        }
      }
      return { len: text.trim().length, bad: bad.slice(0, 5), loading, links, overflow: document.documentElement.scrollWidth - vw, wide, title: document.title };
    }).catch((e) => ({ len: 0, bad: [], loading: 0, links: [], overflow: 0, wide: [], title: `evaluate failed: ${e.message}` }));
    if (info.len < 40) add(size.name, path, "blank", `${info.len} chars, title "${info.title}", at ${finalUrl}`);
    for (const b of info.bad) add(size.name, path, "bad-number", b);
    if (info.loading) add(size.name, path, "still-loading", `${info.loading} loading placeholders after load`);
    if (info.overflow > 1) add(size.name, path, "overflow", `${info.overflow}px: ${info.wide.join(", ")}`);
    for (const href of info.links) {
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
      // Hash links resolve against the page they are on.
      const abs = href.startsWith("#") ? new URL(finalUrl).pathname + href : href;
      const k = key(abs);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const kind = kindOf(k);
      const n = kinds.get(kind) ?? 0;
      if (n >= PER_KIND) continue;
      kinds.set(kind, n + 1);
      queue.push(k);
    }
    process.stdout.write(`\n${size.name} ${visited}/${visited + queue.length} ${path.slice(0, 60).padEnd(60)}`);
    await page.close().catch(() => {});
    active--;
  }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  console.log(`\n${size.name}: visited ${visited}, ${queue.length} left in queue`);
  await context.close();
}
await browser.close();

// Group the same finding across pages.
const groups = new Map();
for (const f of findings) {
  const sig = `${f.kind} | ${f.detail.replace(/\d{3,}ms/, "Nms").replace(/[?#].*$/, "")}`;
  const g = groups.get(sig) ?? { kind: f.kind, detail: f.detail, pages: new Set(), sizes: new Set() };
  g.pages.add(f.path); g.sizes.add(f.size);
  groups.set(sig, g);
}
const sorted = [...groups.values()].sort((a, b) => a.kind.localeCompare(b.kind) || b.pages.size - a.pages.size);
for (const g of sorted) console.log(`[${g.kind}] x${g.pages.size} (${[...g.sizes].join("+")}) ${g.detail}\n    e.g. ${[...g.pages].slice(0, 4).join("  ")}`);
console.log(`${findings.length} findings in ${groups.size} groups`);
if (process.env.CRAWL_JSON) writeFileSync(process.env.CRAWL_JSON, JSON.stringify({ base: BASE, live: LIVE, findings }, null, 2));
