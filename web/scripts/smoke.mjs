// Smoke test for every route of every Parity app, run in CI (.github/workflows/ci.yml).
// It starts the dev server with sign-in skipped and the small results fixture in
// tests/fixtures/smoke, opens each route at 1440x900 and 390x844, and fails on:
//   - an uncaught exception or a console error or warning
//   - a failed request or an HTTP error, except a missing data file under /local/
//     (CI has no news, markets or terminal exports; pages must say so calmly)
//   - a blank page, or NaN, undefined, Infinity or [object Object] in the text
//   - sideways scroll on the phone size
//
//   npm run smoke                      starts its own server
//   SMOKE_BASE=http://127.0.0.1:5199 npm run smoke   uses a running one
//
// The routes come from src/lib/pages.ts, src/lib/space.ts and each app's view list, so a
// new page is covered without editing this file. SMOKE_ONLY=/app/ limits it to paths that
// contain the text.
import { resolve } from "node:path";
import { chromium } from "playwright";
import { routes } from "./lib/routes.mjs";

const here = (p) => resolve(import.meta.dirname, "..", p);

// ---------------------------------------------------------------- the routes

const list = routes().filter((p) => !process.env.SMOKE_ONLY || p.includes(process.env.SMOKE_ONLY));

// ---------------------------------------------------------------- the server

let server = null;
let BASE = process.env.SMOKE_BASE?.replace(/\/$/, "");
if (!BASE) {
  process.env.VITE_AUTH_BYPASS = "1";
  process.env.PARITY_OUTPUT_DIR ??= here("tests/fixtures/smoke");
  const { createServer } = await import("vite");
  server = await createServer({ root: here("."), configFile: here("vite.config.ts"), logLevel: "error", server: { port: 5299, strictPort: false, host: "127.0.0.1" } });
  await server.listen();
  BASE = server.resolvedUrls.local[0].replace(/\/$/, "");
}

// ---------------------------------------------------------------- the checks

const SIZES = [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }];
const IGNORE = [/Download the React DevTools/, /^\[vite\]/];
const missingData = (url) => new URL(url).pathname.startsWith("/local/");
const problems = [];
const browser = await chromium.launch();

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: "reduce" });
  // A decided cookie banner, so it does not cover the page.
  await ctx.addInitScript(() => {
    try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 2, essential: true, analytics: false, decidedAt: "2026-01-01T00:00:00.000Z" })); } catch { /* private mode */ }
  });
  const queue = [...list];
  await Promise.all([0, 1, 2, 3].map(async () => {
    while (queue.length) {
      const path = queue.shift();
      const page = await ctx.newPage();
      const add = (what) => problems.push(`${size.name} ${path}: ${what}`);
      const missing = new Set();
      page.on("pageerror", (e) => add(`exception ${e.message.split("\n")[0]}`));
      page.on("response", (r) => {
        if (r.status() < 400) return;
        if (r.status() === 404 && missingData(r.url())) { missing.add(r.url()); return; }
        add(`HTTP ${r.status()} ${r.url()}`);
      });
      page.on("requestfailed", (r) => {
        const why = r.failure()?.errorText ?? "";
        if (!/ERR_ABORTED/.test(why)) add(`request failed ${r.url()} ${why}`);
      });
      page.on("console", (m) => {
        if (m.type() !== "error" && m.type() !== "warning") return;
        const text = m.text();
        if (IGNORE.some((re) => re.test(text))) return;
        if (/Failed to load resource/.test(text) && missing.has(m.location()?.url ?? "")) return;
        add(`console ${m.type()}: ${text.slice(0, 300)}`);
      });
      page.on("popup", (p) => p.close().catch(() => {}));
      try {
        await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        // Pages that redirect into another app (Trade, Academy, Workbench) or load data late
        // can take a few seconds on a busy runner, so wait for text instead of a fixed pause.
        await page.waitForFunction(() => (document.body?.innerText ?? "").trim().length >= 40, null, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(300);
        const info = await page.evaluate(() => {
          const text = document.body?.innerText ?? "";
          const bad = [...text.matchAll(/(^|[^A-Za-z])(NaN|undefined|Infinity|\[object Object\])(?![A-Za-z])/g)].map((m) => text.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 30).replace(/\s+/g, " "));
          return { len: text.trim().length, bad, overflow: document.documentElement.scrollWidth - window.innerWidth };
        });
        if (info.len < 40) add("blank page");
        for (const b of info.bad.slice(0, 3)) add(`bad value in text: "${b}"`);
        if (size.name === "phone" && info.overflow > 1) add(`scrolls sideways by ${info.overflow}px`);
      } catch (e) {
        add(`did not load: ${e.message.split("\n")[0]}`);
      }
      await page.close().catch(() => {});
    }
  }));
  await ctx.close();
}
// ---------------------------------------------------------------- deep links keep their state

const flows = [
  ["a strategy search typed in goes into the link", async (page) => {
    await page.goto(`${BASE}/app/#/strategies`, { waitUntil: "networkidle" });
    await page.getByPlaceholder("Search strategies").fill("carry");
    await page.getByRole("tablist", { name: "Time range" }).getByRole("tab", { name: "1Y" }).click();
    const hash = decodeURIComponent(new URL(page.url()).hash);
    return hash.includes("q=carry") && hash.includes("range=1Y") ? null : `link is ${hash}`;
  }],
  ["a strategies link reopens with its search and range", async (page) => {
    await page.goto(`${BASE}/app/#/strategies?q=carry&range=5Y`, { waitUntil: "networkidle" });
    const q = await page.getByPlaceholder("Search strategies").inputValue();
    const on = await page.getByRole("tablist", { name: "Time range" }).getByRole("tab", { selected: true }).innerText();
    return q === "carry" && /5Y/.test(on) ? null : `search "${q}", range "${on}"`;
  }],
  ["a catalog link reopens with its filters", async (page) => {
    await page.goto(`${BASE}/research/#/catalog?q=carry&sort=year`, { waitUntil: "networkidle" });
    const q = await page.getByPlaceholder("Search name, tags, authors").inputValue();
    const sort = await page.getByLabel("Sort").inputValue();
    return q === "carry" && sort === "year" ? null : `search "${q}", sort "${sort}"`;
  }],
];
// ---------------------------------------------------------------- addresses that do not exist (DEC-0055)
// The dev server answers like Cloudflare Pages (plugins/notFound.ts): an unknown path gets
// the 404 page with status 404, a missing app path opens the app at that hash, and every
// app shows its "not found" view for a hash route it does not know.
const JUNK = "no-such-page-xyz";
const notFound = [
  ["an unknown path answers 404 with the 404 page", async (page) => {
    const res = await page.goto(`${BASE}/${JUNK}/`, { waitUntil: "load" });
    const text = await page.locator("body").innerText();
    if (res?.status() !== 404) return `status ${res?.status()}`;
    return /This page does not exist/.test(text) ? null : "no not-found text";
  }],
  ["a missing app path opens the app's not found view", async (page) => {
    await page.goto(`${BASE}/app/${JUNK}`, { waitUntil: "load" });
    await page.locator("[data-not-found]").waitFor({ timeout: 20000 });
    return new URL(page.url()).hash === `#/${JUNK}` ? null : `ended at ${page.url()}`;
  }],
  ["an unknown badge address says there is no record", async (page) => {
    await page.goto(`${BASE}/v/${JUNK}`, { waitUntil: "load" });
    await page.getByRole("heading", { name: "No record at this address" }).waitFor({ timeout: 20000 });
    return null;
  }],
  ...["app", "research", "sim", "trade", "academy", "lab"].map((app) => [`/${app}/ shows not found for an unknown hash`, async (page) => {
    await page.goto(`${BASE}/${app}/#/${JUNK}`, { waitUntil: "load" });
    await page.locator("[data-not-found]").waitFor({ timeout: 20000 });
    const view = page.locator("[data-not-found]");
    const acts = (await view.getByRole("button", { name: "Back" }).count()) + (await view.getByRole("link").count());
    return acts >= 2 ? null : "no Back and Home actions";
  }]),
];
const nctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
await nctx.addInitScript(() => {
  try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 2, essential: true, analytics: false, decidedAt: "2026-01-01T00:00:00.000Z" })); } catch { /* private mode */ }
});
for (const [name, fn] of notFound) {
  const page = await nctx.newPage();
  page.on("pageerror", (e) => problems.push(`not found "${name}": exception ${e.message.split("\n")[0]}`));
  const why = await fn(page).catch((e) => e.message.split("\n")[0]);
  if (why) problems.push(`not found "${name}": ${why}`);
  await page.close();
}
await nctx.close();

const fctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const [name, fn] of flows) {
  const page = await fctx.newPage();
  const why = await fn(page).catch((e) => e.message.split("\n")[0]);
  if (why) problems.push(`flow "${name}": ${why}`);
  await page.close();
}
await fctx.close();

await browser.close();
await server?.close();

console.log(`smoke: ${list.length} routes at ${SIZES.length} sizes`);
const unique = [...new Set(problems)].sort();
for (const p of unique) console.log(`  FAIL ${p}`);
console.log(unique.length ? `${unique.length} problems` : "no problems");
process.exit(unique.length ? 1 : 0);
