// The test fixture every E2E spec uses. Each test gets a fresh browser context with:
//   - a signed-in Supabase session cookie (test.use({ signedIn: false }) for a visitor)
//   - Supabase stubbed (e2e/supabase.ts) and /data/ served from small fixtures (e2e/data.ts)
//   - every other address outside this server answered with an empty reply, so no test
//     reaches Google Fonts, an exchange or any other upstream
//   - the cookie banner already decided, and the service worker off (it would hide requests
//     from the stubs)
//   - console errors and warnings, and uncaught exceptions, failing the test (see ALLOW)
import { test as base, expect, type ConsoleMessage, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { BASE, SUPABASE } from "./config";
import { DataStub } from "./data";
import { FakeDb, sessionCookie, stubSupabase } from "./supabase";

// Console messages that are not bugs. Keep this short and say why for each one.
const ALLOW: RegExp[] = [
  // Chrome prints this for every 401/404 a page asks for on purpose. Missing data files are
  // checked separately below: only the ones the stub chose to leave out are let through.
];

export interface Fixtures {
  signedIn: boolean;
  /** Extra console text this test expects (an offline test, say). */
  expectConsole: RegExp[];
  db: FakeDb;
  data: DataStub;
  /** Problems seen so far in this test: console errors, warnings and exceptions. */
  problems: string[];
}

export const test = base.extend<Fixtures>({
  signedIn: [true, { option: true }],
  expectConsole: [[], { option: true }],
  db: async ({}, use) => { await use(new FakeDb()); },
  data: async ({}, use) => { await use(new DataStub()); },
  problems: async ({}, use) => { await use([]); },
  context: async ({ context, signedIn, db, data, problems, expectConsole }, use, testInfo) => {
    await context.addInitScript(() => {
      try {
        localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 2, essential: true, analytics: false, decidedAt: "2026-01-01T00:00:00.000Z" }));
      } catch { /* private mode */ }
    });
    let live = signedIn;
    if (signedIn) await context.addCookies([sessionCookie()]);
    // Anything not on this server: an empty reply (fonts get an empty stylesheet).
    await context.route((url) => url.origin !== BASE && !url.href.startsWith(SUPABASE) && /^https?:/.test(url.protocol), (route) => {
      const type = route.request().resourceType();
      if (type === "stylesheet") return route.fulfill({ status: 200, contentType: "text/css", body: "" });
      if (type === "font" || type === "image") return route.fulfill({ status: 204, body: "" });
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await context.route((url) => url.origin === BASE && /^\/(data|live|rum|e)(\/|$)/.test(url.pathname), (route) => data.handle(route));
    await context.routeWebSocket((url) => !url.href.includes("supabase.co"), (ws) => { ws.onMessage(() => {}); });
    await stubSupabase(context, db, () => live);
    const allowed = (m: string, url: string) =>
      ALLOW.some((re) => re.test(m)) || expectConsole.some((re) => re.test(m)) || (/Failed to load resource/.test(m) && data.leftOut(url));
    const watch = (page: Page) => {
      page.on("console", (m: ConsoleMessage) => {
        if (m.type() !== "error" && m.type() !== "warning") return;
        const text = m.text();
        if (allowed(text, m.location()?.url ?? "")) return;
        problems.push(`console ${m.type()}: ${text.slice(0, 400)} (${page.url()})`);
      });
      page.on("pageerror", (e) => {
        if (expectConsole.some((re) => re.test(e.message))) return;
        problems.push(`exception: ${e.message.split("\n")[0]} (${page.url()})`);
      });
    };
    context.on("page", watch);
    (context as unknown as { signOutStub: () => void }).signOutStub = () => { live = false; };
    await use(context);
    // Fails the test (fixture teardown errors count as test failures) on any console problem.
    if (problems.length) throw new Error(`Console problems in "${testInfo.title}":\n${[...new Set(problems)].join("\n")}`);
  },
});

export { expect };

/** Opens a path and waits until the page has real text (apps hydrate after load). */
export async function open(page: Page, path: string, min = 40) {
  const res = await page.goto(path, { waitUntil: "load" });
  await page.waitForFunction((n) => (document.body?.innerText ?? "").trim().length >= n, min, { timeout: 20_000 }).catch(() => {});
  return res;
}

/** Waits for the boot splash and every loading state on the page to finish. */
export async function settled(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("[data-boot], .auth-splash, [aria-busy='true']"), null, { timeout: 15_000 }).catch(() => {});
}

/** Text that should never reach the screen. */
export async function badValues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    return [...text.matchAll(/(^|[^A-Za-z])(NaN|undefined|Infinity|\[object Object\])(?![A-Za-z])/g)]
      .map((m) => text.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 30).replace(/\s+/g, " "));
  });
}

/** Serious and critical axe violations (WCAG 2.2 A and AA), one line each. */
export async function axe(page: Page, exclude: string[] = []): Promise<string[]> {
  let b = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  for (const e of exclude) b = b.exclude(e);
  const r = await b.analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact} ${v.id}: ${v.help} at ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

/** How far the page scrolls sideways, in pixels. */
export const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
