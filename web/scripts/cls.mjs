// Layout shift audit: how much each page jumps while it loads, while its data arrives,
// on hover and while it is scrolled. Prints cumulative layout shift (CLS, the browser's
// own measure: the worst burst of shifts, ignoring shifts right after a click or key)
// per page at desktop and phone width, and the elements that moved most.
//
//   VITE_AUTH_BYPASS=1 npx vite --port 5199 --host 127.0.0.1   (in another terminal)
//   CLS_BASE=http://127.0.0.1:5199 npm run cls
//
// CLS_PAGES="/app/#/,/research/#/search" limits the pages. CLS_JSON=path writes the full
// results. CLS_SLOW=1 adds a slow network (150ms per request, 40 Mbit/s, web fonts held back
// 900ms), which is where late data and font swaps show up. Exits 1 if any page is at or
// above CLS_LIMIT (default 0.02).
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.CLS_BASE ?? "http://127.0.0.1:5199";
const LIMIT = Number(process.env.CLS_LIMIT ?? 0.02);
const SLOW = process.env.CLS_SLOW === "1";
const DEFAULT_PAGES = [
  // Product
  "/app/#/", "/app/#/strategies", "/app/#/strategy/factor_cma", "/app/#/watchlist", "/app/#/compare", "/app/#/lab",
  "/app/#/scenarios", "/app/#/news", "/app/#/news/history", "/app/#/news/archive", "/app/#/news/impact",
  "/app/#/markets", "/app/#/markets/new", "/app/#/markets/crypto", "/app/#/markets/perps", "/app/#/markets/etfs",
  "/app/#/markets/terms", "/app/#/markets/practice", "/app/#/verify", "/app/#/learn", "/app/#/start", "/app/#/how", "/app/#/settings",
  // Research
  "/research/#/", "/research/#/docs", "/research/#/doc/DEC-0017", "/research/#/refs", "/research/#/ledger",
  "/research/#/search", "/research/#/edges", "/research/#/catalog", "/research/#/signals", "/research/#/explore",
  "/research/#/data", "/research/#/sources", "/research/#/ui",
  // Parity Terminal
  "/sim/", "/sim/#/macro", "/sim/#/fx", "/sim/#/commodities", "/sim/#/simlab", "/sim/#/bots",
  // Parity Trade (DEC-0040)
  "/trade/", "/trade/#/watchlists", "/trade/#/screener", "/trade/#/portfolio", "/trade/#/orders", "/trade/#/alerts",
  "/trade/#/strategies", "/trade/#/settings",
  // Parity Academy (DEC-0042)
  "/academy/", "/academy/#/reading-a-backtest", "/academy/#/reading-a-backtest/return", "/academy/#/luck-vs-skill/multiple-testing",
  "/academy/#/progress", "/academy/#/settings",
];
const PAGES = (process.env.CLS_PAGES ? process.env.CLS_PAGES.split(",") : DEFAULT_PAGES).map((p) => p.trim()).filter(Boolean);
const SIZES = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844, isMobile: true, hasTouch: true },
];

// Runs in the page before any of its scripts: records every layout shift with the phase
// it happened in and a short name for the elements that moved.
const OBSERVER = () => {
  const w = window;
  w.__cls = { phase: "load", entries: [] };
  const name = (n) => {
    if (!n || !n.tagName) return "?";
    const cls = typeof n.className === "string" ? n.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return n.tagName.toLowerCase() + (n.id ? `#${n.id}` : "") + (cls ? `.${cls}` : "");
  };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      w.__cls.entries.push({
        t: e.startTime, value: e.value, input: e.hadRecentInput, phase: w.__cls.phase,
        sources: (e.sources || []).map((s) => name(s.node)),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
};

/** The browser's CLS: the largest burst (gaps under 1s, at most 5s long) of shifts not caused by input. */
function cls(entries) {
  let best = 0, cur = 0, start = -1, last = -1;
  for (const e of entries) {
    if (e.input) continue;
    if (start < 0 || e.t - last > 1000 || e.t - start > 5000) { cur = 0; start = e.t; }
    cur += e.value; last = e.t;
    best = Math.max(best, cur);
  }
  return best;
}

const browser = await chromium.launch();
const results = [];
for (const size of SIZES) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.isMobile, hasTouch: size.hasTouch });
  await context.addInitScript(OBSERVER);
  if (SLOW) {
    await context.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => { await new Promise((r) => setTimeout(r, 900)); await route.continue(); });
  }
  for (const path of PAGES) {
    const page = await context.newPage();
    if (SLOW) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 40e6 / 8, uploadThroughput: 10e6 / 8 });
    }
    const url = new URL(path, BASE).toString();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: SLOW ? 60000 : 30000 });
    } catch {
      await page.goto(url, { waitUntil: "load", timeout: 30000 }).catch(() => {});
    }
    // Data arrives: give lazy files and charts time to land.
    await page.waitForTimeout(2500);
    await page.evaluate(() => { window.__cls.phase = "hover"; });
    if (!size.hasTouch) {
      const targets = await page.locator("main a:visible, main button:visible, main tr:visible, main .mcard:visible, .side a:visible").all();
      for (const t of targets.slice(0, 24)) {
        await t.hover({ timeout: 800, force: true }).catch(() => {});
        await page.waitForTimeout(60);
      }
      await page.mouse.move(2, 2);
    }
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__cls.phase = "scroll"; });
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(180); }
    await page.waitForTimeout(900);
    const entries = await page.evaluate(() => window.__cls.entries);
    const by = (p) => entries.filter((e) => e.phase === p);
    const movers = {};
    for (const e of entries) if (!e.input) for (const s of e.sources) movers[s] = (movers[s] ?? 0) + e.value;
    results.push({
      size: size.name, path,
      cls: cls(entries), load: cls(by("load")), hover: cls(by("hover")), scroll: cls(by("scroll")),
      movers: Object.entries(movers).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(3)}`),
    });
    await page.close();
  }
  await context.close();
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
const f = (v) => v.toFixed(3);
console.log(pad("size", 6) + pad("page", 34) + pad("CLS", 8) + pad("load", 8) + pad("hover", 8) + pad("scroll", 8) + "moved most");
let worst = 0;
for (const r of results) {
  worst = Math.max(worst, r.cls);
  console.log(pad(r.size, 6) + pad(r.path, 34) + pad(f(r.cls), 8) + pad(f(r.load), 8) + pad(f(r.hover), 8) + pad(f(r.scroll), 8) + (r.cls >= 0.001 ? r.movers.join(", ") : ""));
}
console.log(`\nworst ${f(worst)}, ${results.filter((r) => r.cls >= LIMIT).length} of ${results.length} at or above ${LIMIT}`);
if (process.env.CLS_JSON) writeFileSync(process.env.CLS_JSON, JSON.stringify(results, null, 2));
process.exit(worst >= LIMIT ? 1 : 0);
