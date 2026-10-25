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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const here = (p) => resolve(import.meta.dirname, "..", p);
const read = (p) => readFileSync(here(p), "utf8");

// ---------------------------------------------------------------- the routes

function routes() {
  const pages = read("src/lib/pages.ts");
  const out = new Set(["/", "/login/", "/signup/", "/reset/", "/legal/", "/legal/privacy/", "/legal/terms/", "/legal/cookies/", "/legal/accessibility/", "/legal/risk/"]);
  // Each page's hash and side. Pages that moved to their own app redirect, which is tested too.
  for (const m of pages.matchAll(/href: "(#\/[^"]*)", title: "[^"]*", space: "(product|research|both)"/g)) {
    const [, hash, space] = m;
    if (space !== "research") out.add(`/app/${hash}`);
    if (space !== "product") out.add(`/research/${hash}`);
  }
  const viewIds = (file) => [...read(file).matchAll(/\{ id: "([a-z]+)", label:/g)].map((m) => m[1]);
  for (const v of viewIds("src/trade/state.ts")) out.add(`/trade/#/${v}`);
  for (const v of viewIds("src/lab/state.ts")) out.add(`/lab/#/${v}`);
  for (const v of ["", "progress", "settings"]) out.add(`/academy/#/${v}`);
  const courses = readFileSync(here("../academy/courses/01-reading-a-backtest.json"), "utf8");
  const course = JSON.parse(courses);
  out.add(`/academy/#/${course.id}`);
  if (course.lessons?.[0]?.id) out.add(`/academy/#/${course.id}/${course.lessons[0].id}`);
  for (const m of read("src/terminal/layout.ts").matchAll(/\{ id: "([a-z]+)", label:/g)) out.add(`/sim/#/${m[1]}`);
  // A strategy page and an algorithm report, and the settings pages.
  out.add("/app/#/strategy/fx_carry");
  out.add("/research/#/algo/fx-carry-g10");
  out.add("/app/#/settings");
  return [...out].filter((p) => !process.env.SMOKE_ONLY || p.includes(process.env.SMOKE_ONLY));
}

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
const list = routes();
const browser = await chromium.launch();

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: "reduce" });
  // A decided cookie banner, so it does not cover the page.
  await ctx.addInitScript(() => {
    try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 1, essential: true, analytics: false, decidedAt: "2026-01-01T00:00:00.000Z" })); } catch { /* private mode */ }
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
        await page.waitForTimeout(600);
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
