// End-to-end check of the first-run tours and the getting started checklist (DEC-0060), run
// in CI after the smoke test. It starts the dev server with sign-in skipped (so the store
// keeps its row in the browser) and checks, in a real browser:
//   1. Home's tour opens on a first visit, counts its steps, moves with the arrow keys and
//      keeps Tab inside the tip, and does not open again once finished.
//   2. "Skip all tours" in Trade turns every tour off: Academy then opens without one.
//   3. "Show tours again" in Account settings brings them back, and Escape skips a tour.
//   4. On a phone, steps whose targets are hidden are skipped and nothing scrolls sideways.
//   5. The checklist shows, and the wallet dialog refuses a pasted seed phrase.
//   7. The first-run intro (DEC-0077): every screen, the result, then Home's next step.
// Screenshots of every tour and the checklist go to ONBOARDING_SHOTS (a temp folder if unset).
//
//   npm run onboarding
//   ONBOARDING_SHOTS=~/Desktop/parity-onboarding npm run onboarding
//   ONBOARDING_BASE=http://127.0.0.1:5199 npm run onboarding     uses a running server
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const here = (p) => resolve(import.meta.dirname, "..", p);
const SHOTS = (process.env.ONBOARDING_SHOTS ?? join(tmpdir(), "parity-onboarding")).replace(/^~(?=\/)/, process.env.HOME ?? "~");
mkdirSync(SHOTS, { recursive: true });

let server = null;
let BASE = process.env.ONBOARDING_BASE?.replace(/\/$/, "");
if (!BASE) {
  process.env.VITE_AUTH_BYPASS = "1";
  process.env.PARITY_OUTPUT_DIR ??= here("tests/fixtures/smoke");
  const { createServer } = await import("vite");
  server = await createServer({ root: here("."), configFile: here("vite.config.ts"), logLevel: "error", server: { port: 5399, strictPort: false, host: "127.0.0.1" } });
  await server.listen();
  BASE = server.resolvedUrls.local[0].replace(/\/$/, "");
}

const failures = [];
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failures.push(what); };
const browser = await chromium.launch();

// The smoke fixture has no market data, so Trade and Terminal would show only "No market
// data". Serve a small made-up export instead (three daily series), so their tours have
// the chart, the order ticket and the dock to point at.
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

async function context(size = { width: 1440, height: 900 }, init = {}) {
  const ctx = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
  await ctx.route("**/local/terminal/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/local\/terminal\//, "");
    const body = path === "index.json" ? MARKET.index : MARKET.files[path];
    return body ? route.fulfill({ json: body }) : route.fulfill({ status: 404, body: "missing" });
  });
  await ctx.addInitScript((seed) => {
    try {
      localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 2, essential: true, analytics: false, decidedAt: "2026-01-01T00:00:00.000Z" }));
      if (seed.onboarding && !sessionStorage.getItem("seeded")) {
        localStorage.setItem("parity.onboarding.v1", JSON.stringify(seed.onboarding));
        sessionStorage.setItem("seeded", "1");
      }
    } catch { /* private mode */ }
    if (seed.desktop) {
      window.parityDesktop = { platform: "darwin", version: "0.2.0", setToken() {}, notify() {}, openExternal() {}, setTicker() {} };
    }
  }, init);
  return ctx;
}

const tip = (page) => page.locator(".ui-tour[role=dialog]");
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("parity.onboarding.v1") ?? "{}"));
/** "2 of 5" to 5. */
const totalOf = (text) => Number((text ?? "").match(/of (\d+)/)?.[1] ?? 0);
async function waitTip(page, timeout = 20000) {
  try { await tip(page).waitFor({ state: "visible", timeout }); return true; } catch { return false; }
}
async function noTip(page, ms = 2500) {
  await page.waitForTimeout(ms);
  return (await tip(page).count()) === 0;
}
const shot = (page, name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

// ---------------------------------------------------------------- 1. home tour, keys, once only
{
  const ctx = await context();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/app/#/`);
  check(await waitTip(page), "home tour opens on the first visit");
  await page.waitForTimeout(300);
  await shot(page, "01-home-tour-step1");
  const count = await page.locator(".ui-tour-count").textContent();
  const total = totalOf(count);
  check(total >= 3 && total <= 6, `home tour has 3 to 6 steps on desktop (${count})`);
  // Tab stays in the tip.
  for (let i = 0; i < 7; i++) await page.keyboard.press("Tab");
  check(await page.evaluate(() => !!document.activeElement?.closest(".ui-tour[role=dialog]")), "Tab keeps focus inside the tip");
  await page.keyboard.press("ArrowRight");
  check((await page.locator(".ui-tour-count").textContent())?.startsWith("2 of"), "ArrowRight moves to step 2");
  await page.keyboard.press("ArrowLeft");
  check((await page.locator(".ui-tour-count").textContent())?.startsWith("1 of"), "ArrowLeft moves back to step 1");
  for (let i = 1; i < total; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(120);
    if (i === 2) await shot(page, "02-home-tour-step3");
  }
  check((await tip(page).locator(".ui-btn-primary").textContent()) === "Done", "the last step says Done");
  await tip(page).locator(".ui-btn-primary").click();
  check(await noTip(page, 400), "Done closes the tour");
  check((await stored(page)).tours_seen?.includes("home"), "home is saved as seen");
  await page.locator(".setup-btn").click();
  await page.locator(".onb-pop").waitFor({ state: "visible" });
  await shot(page, "03-checklist");
  check(await page.locator(".onb-pop .onb-item").count() === 9, "the checklist lists 9 items (8 to do and brokerage)");
  check(/coming later/.test((await page.locator(".onb-pop [data-item='broker']").textContent()) ?? ""), "brokerage shows as coming later");
  await page.keyboard.press("Escape");
  await page.reload();
  check(await noTip(page), "home tour does not open again after a reload");
  check(errors.length === 0, `no page errors on home (${errors.join("; ")})`);

  // ---------------------------------------------------------------- 5. wallet dialog
  await page.locator(".setup-btn").click();
  await page.locator("[data-item='wallet'] button").click();
  await page.locator(".wal-warn").waitFor({ state: "visible" });
  check(/never asks for your seed phrase/i.test((await page.locator(".wal-warn").textContent()) ?? ""), "the wallet dialog says Parity never asks for a seed phrase");
  await shot(page, "04-wallet-dialog");
  await page.getByLabel("Public wallet address").fill("abandon ability able about above absent absorb abstract absurd abuse access accident");
  check(await page.locator(".wal-problem").isVisible(), "a pasted seed phrase is refused on the spot");
  await shot(page, "05-wallet-refuses-seed-phrase");
  await page.getByLabel("Public wallet address").fill("0x52908400098527886E0F7030069857D2E4169EE7");
  await page.getByRole("button", { name: "Add address" }).click();
  await page.locator(".wal-list li").first().waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
  check(await page.locator(".wal-list li").count() === 1, "a valid address is saved, as not verified");
  await shot(page, "06-wallet-saved");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  // The popover closed when the dialog opened: open it again to look.
  if (!(await page.locator(".onb-pop").isVisible())) { await page.locator(".setup-btn").click(); await page.locator(".onb-pop").waitFor({ state: "visible" }); }
  check(await page.locator("[data-item='wallet'].done").count() === 1, "adding a wallet ticks the wallet item");

  // ---------------------------------------------------------------- 2. skip all in Trade
  await page.goto(`${BASE}/trade/`);
  check(await waitTip(page, 30000), "Trade tour opens on the first visit");
  await page.waitForTimeout(300);
  await shot(page, "07-trade-tour");
  await tip(page).getByRole("button", { name: "Skip all tours" }).click();
  check(await noTip(page, 400), "Skip all tours closes the tour");
  check((await stored(page)).tours_off === true, "Skip all tours is saved");
  await page.goto(`${BASE}/academy/`);
  check(await noTip(page, 3000), "after Skip all, Academy opens with no tour");

  // ---------------------------------------------------------------- 3. show tours again, Escape
  await page.goto(`${BASE}/app/#/settings/account`);
  check(await noTip(page, 1500), "Account opens with no tour while tours are off");
  await page.getByRole("button", { name: "Show tours again" }).click();
  await page.waitForTimeout(200);
  const after = await stored(page);
  check(after.tours_off === false && (after.tours_seen ?? []).length === 0, "Show tours again clears the saved choice");
  await page.reload();
  check(await waitTip(page), "Account tour opens after Show tours again");
  await page.waitForTimeout(300);
  await shot(page, "08-account-tour");
  await page.keyboard.press("Escape");
  check(await noTip(page, 400), "Escape skips the tour");
  check((await stored(page)).tours_seen?.includes("account"), "a skipped tour is saved as seen");
  await ctx.close();
}

// ---------------------------------------------------------------- the cookie notice comes first
{
  const ctx = await context();
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.removeItem("parity.consent.v1"); } catch { /* private mode */ } });
  await page.goto(`${BASE}/app/#/verify`);
  check(await noTip(page, 2500), "a tour waits while the cookie notice is up");
  await page.getByRole("button", { name: "Essential only" }).click();
  check(await waitTip(page), "the tour opens once the cookie choice is made");
  await ctx.close();
}

// ---------------------------------------------------------------- every other tour, for the screenshots
const AREAS = [
  ["09-verify-tour", "/app/#/verify", {}],
  ["10-research-tour", "/research/#/", {}],
  ["11-workbench-tour", "/lab/", {}],
  ["12-terminal-tour", "/sim/", {}],
  ["13-academy-tour", "/academy/", {}],
  ["14-desktop-shell-tour", "/app/#/", { desktop: true, onboarding: { tours_seen: ["home"], checklist_hidden: true } }],
];
for (const [name, path, init] of AREAS) {
  const ctx = await context(undefined, init);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`);
  const ok = await waitTip(page, 30000);
  const label = name.replace(/^\d+-/, "");
  check(ok, `${label} opens`);
  if (ok) {
    const count = await page.locator(".ui-tour-count").textContent();
    const total = totalOf(count);
    check(total >= 3 && total <= 6, `${label} has 3 to 6 steps (${count})`);
    await page.waitForTimeout(300);
    await shot(page, name);
  }
  await ctx.close();
}

// ---------------------------------------------------------------- 4. phone
{
  const ctx = await context({ width: 390, height: 844 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/#/`);
  check(await waitTip(page), "home tour opens on a phone");
  const count = await page.locator(".ui-tour-count").textContent();
  const total = totalOf(count);
  check(total >= 3 && total <= 6, `phone home tour skips hidden targets and keeps 3 to 6 steps (${count})`);
  await page.waitForTimeout(300);
  await shot(page, "15-home-tour-phone");
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, "no sideways scroll on a phone with the tour open");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await shot(page, "16-checklist-phone");
  await page.goto(`${BASE}/trade/`);
  check(await waitTip(page, 30000), "Trade tour opens on a phone");
  await page.waitForTimeout(300);
  await shot(page, "17-trade-tour-phone");
  await ctx.close();
}

// ---------------------------------------------------------------- 7. the first-run intro (DEC-0077)
// The local preview keeps its row in this browser, so the intro does not open by itself;
// #/?intro=1 opens it the way a new account sees it. Full motion here, for the screenshots.
for (const [size, tag] of [[{ width: 1440, height: 900 }, "desktop"], [{ width: 390, height: 844 }, "phone"]]) {
  const ctx = await context(size, { onboarding: { tours_off: false, tours_seen: ["home"], checklist_hidden: false } });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/app/#/?intro=1`);
  const intro = page.locator(".intro[role=dialog]");
  const still = () => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), null, { timeout: 5000 }).catch(() => {});
  check(await intro.waitFor({ state: "visible", timeout: 20000 }).then(() => true, () => false), `intro opens (${tag})`);
  await still();
  await shot(page, `20-intro-goal-${tag}`);
  await intro.getByRole("button", { name: /Check a strategy or a bot/ }).click();
  await intro.getByRole("heading", { name: "How much have you traded?" }).waitFor();
  await still();
  await shot(page, `21-intro-level-${tag}`);
  await intro.getByRole("button", { name: /^A little/ }).click();
  await intro.getByRole("heading", { name: "Which markets do you follow?" }).waitFor();
  await intro.getByRole("button", { name: /^Stocks/ }).click();
  await intro.getByRole("button", { name: /^Currencies/ }).click();
  await still();
  await shot(page, `22-intro-markets-${tag}`);
  await intro.getByRole("button", { name: "Continue", exact: true }).click();
  check(await intro.getByRole("heading", { name: /^Verify checked / }).waitFor({ timeout: 20000 }).then(() => true, () => false), `the last screen shows a real Verify result (${tag})`);
  await still();
  await shot(page, `23-intro-result-${tag}`);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!wide, `no sideways scroll in the intro (${tag})`);
  await intro.getByRole("button", { name: "Go to Home" }).click();
  check(await intro.waitFor({ state: "detached", timeout: 5000 }).then(() => true, () => false), `Go to Home closes the intro (${tag})`);
  check((await stored(page)).intro_status === "done", `the finished intro is saved (${tag})`);
  check(await page.locator(".onb-next").waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false), `Home shows one next step after the intro (${tag})`);
  await page.waitForTimeout(400);
  await shot(page, `24-home-next-step-${tag}`);
  check(errors.length === 0, `no page errors in the intro (${errors.join("; ")})`);
  await ctx.close();
}

await browser.close();
await server?.close();
console.log(`\nScreenshots: ${SHOTS}`);
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("All onboarding checks passed.");
