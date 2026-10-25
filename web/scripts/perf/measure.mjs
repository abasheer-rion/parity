// Speed check for every Parity app, against a local copy of the built site (stub.mjs) with a
// made-up session, so no real account is used. Prints one row per app: time to first byte,
// largest paint, JS sent (compressed), long tasks, time to first data, a second visit, and a
// route change inside the app.
//
//   node scripts/perf/measure.mjs [--before] [--data <dir>] [--json out.json]
//
// --before serves files with the cache headers the live site used before (every app file
// checked again on each visit). The network is a laptop on good broadband: 40 ms each way,
// 30 Mbit/s down. Build first with VITE_SUPABASE_URL=http://127.0.0.1:54399.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { LIVE_BEFORE, start } from "./stub.mjs";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const before = process.argv.includes("--before");
const here = (p) => resolve(import.meta.dirname, "../..", p);
const s = await start({ dist: arg("--dist") ? resolve(arg("--dist")) : here("dist"), data: arg("--data") ? resolve(arg("--data")) : here("tests/fixtures/smoke"), assetCache: before ? LIVE_BEFORE : undefined, protectedDelay: 30 });

const APPS = [
  { app: "site", path: "/", next: null },
  { app: "product", path: "/app/", next: "#/strategies" },
  { app: "research", path: "/research/", next: "#/learn" },
  { app: "sim", path: "/sim/", next: "#/fx" },
  { app: "trade", path: "/trade/", next: "#/portfolio" },
  { app: "academy", path: "/academy/", next: "#/reading-a-backtest/return" },
  { app: "lab", path: "/lab/", next: "#/compare" },
];

const browser = await chromium.launch();
const rows = [];

async function visit(page, url) {
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  return page.evaluate(async () => {
    const nav = performance.getEntriesByType("navigation")[0];
    const lcp = await new Promise((ok) => {
      let v = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) v = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => ok(v), 50);
    });
    const long = await new Promise((ok) => {
      const out = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) out.push(e.duration); }).observe({ type: "longtask", buffered: true });
      setTimeout(() => ok(out), 50);
    });
    const res = performance.getEntriesByType("resource");
    const js = res.filter((r) => /\.m?js(\?|$)/.test(r.name));
    const data = res.filter((r) => /\/data\/|\/local\/|\/rest\/v1\//.test(r.name)).sort((a, b) => a.responseEnd - b.responseEnd);
    return {
      ttfb: Math.round(nav.responseStart),
      lcp: Math.round(lcp),
      jsKB: Math.round(js.reduce((n, r) => n + (r.transferSize || 0), 0) / 1024),
      jsFiles: js.length,
      jsNet: js.filter((r) => r.transferSize > 0).length,
      jsWaitMs: Math.round(js.reduce((n, r) => Math.max(n, r.responseEnd), 0)),
      longN: long.length,
      longMs: Math.round(long.reduce((a, b) => a + b, 0)),
      ttd: data.length ? Math.round(data[0].responseEnd) : null,
      text: (document.body.innerText || "").trim().length,
    };
  });
}

for (const a of APPS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([s.cookie()]);
  await ctx.addInitScript(() => { try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 1, essential: true, analytics: false, decidedAt: "2026-01-01T00:00:00.000Z" })); } catch { /* */ } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: 30e6 / 8, uploadThroughput: 10e6 / 8 });
  const cold = await visit(page, s.site + a.path);
  // A second visit in a new tab, as when the app is opened again later.
  const page2 = await ctx.newPage();
  const cdp2 = await ctx.newCDPSession(page2);
  await cdp2.send("Network.enable");
  await cdp2.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: 30e6 / 8, uploadThroughput: 10e6 / 8 });
  // Code files the second visit had to ask the server about (a full download or a "not
  // changed" answer) instead of taking straight from the browser's cache.
  let asked = 0;
  cdp2.on("Network.responseReceived", (e) => { if (/\.m?js(\?|$)/.test(e.response.url) && !e.response.fromDiskCache && !e.response.fromMemoryCache) asked++; });
  const warm = await visit(page2, s.site + a.path);
  warm.jsNet = asked;
  let route = null;
  if (a.next) {
    route = await page.evaluate(async (hash) => {
      const main = () => document.getElementById("root")?.innerText ?? "";
      const was = main();
      const t0 = performance.now();
      location.hash = hash;
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      for (let i = 0; i < 600; i++) {
        await frame();
        if (main() !== was && main().trim().length > 20) { await frame(); return Math.round(performance.now() - t0); }
      }
      return null;
    }, a.next);
  }
  rows.push({ app: a.app, cold, warm, route });
  console.log(`${a.app.padEnd(9)} ttfb ${String(cold.ttfb).padStart(4)}  lcp ${String(cold.lcp).padStart(5)}  warm lcp ${String(warm.lcp).padStart(5)}  js ${String(cold.jsKB).padStart(5)} KB (${cold.jsFiles} files, warm asked again ${warm.jsNet}, js done ${cold.jsWaitMs}/${warm.jsWaitMs} ms)  long ${cold.longN}/${cold.longMs} ms  data ${cold.ttd ?? "-"}  route ${route ?? "-"} ms  text ${cold.text}`);
  await ctx.close();
}
await browser.close();
s.close();
if (arg("--json")) writeFileSync(arg("--json"), JSON.stringify({ before, at: new Date().toISOString(), rows }, null, 2));
