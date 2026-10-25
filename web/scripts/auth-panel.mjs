// End-to-end check of the sign-in panel (DEC-0042) in a real browser. Every Supabase
// request is answered by a stub here: it never signs in and never sends a real password.
//
//   npx vite --port 5199 --host 127.0.0.1   (or wrangler pages dev dist, in another terminal)
//   AUTH_BASE=http://127.0.0.1:5199 npm run auth:panel
//
// Prints one line per check and exits 1 if any fail.
import { chromium } from "playwright";

const BASE = (process.env.AUTH_BASE ?? "http://127.0.0.1:5199").replace(/\/$/, "");
let failed = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};

const browser = await chromium.launch();
async function fresh(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const calls = [];
  await context.route(/\/auth\/v1\//, async (route) => {
    const url = route.request().url();
    calls.push({ url, body: route.request().postData() ?? "" });
    if (url.includes("grant_type=password")) {
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "invalid_credentials", error_code: "invalid_credentials", msg: "Invalid login credentials" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await context.addInitScript(() => { try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 1, essential: true, analytics: false, decidedAt: "2026-10-24T00:00:00Z" })); } catch { /* none */ } });
  return { context, page: await context.newPage(), calls };
}
const state = (page) => page.evaluate(() => ({
  hash: location.hash,
  open: document.documentElement.classList.contains("auth-open"),
  focus: document.activeElement?.getAttribute("autocomplete") ?? document.activeElement?.textContent?.trim() ?? "",
  title: document.querySelector(".pa-overlay.on .pa-title")?.textContent ?? null,
}));

// 1. Front page: Log in opens the panel in place, Back closes it.
{
  const { context, page, calls } = await fresh();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const url = page.url();
  await page.click("a.li[data-auth]");
  await page.waitForTimeout(900);
  let s = await state(page);
  check(page.url().startsWith(url) && s.hash === "#login", "Log in adds #login without leaving the page", page.url());
  check(s.open && s.title === "Log in to Parity", "the page fades out and the log-in panel shows", JSON.stringify(s));
  check(s.focus === "username", "focus moves to the email field", s.focus);
  const orbs = await page.evaluate(() => getComputedStyle(document.querySelector(".orbs i")).opacity);
  check(orbs === "0", "no orbs behind the panel", orbs);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector(".orbs")).backgroundColor);
  check(bg === "rgb(5, 6, 8)", "the backdrop stays", bg);
  await page.getByLabel("Email").fill("amanda@example.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill("not a real password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForTimeout(600);
  const alert = await page.locator("[role=alert]").allTextContents();
  check(alert.join(" ").includes("That email and password do not match."), "a wrong password shows a plain message", alert.join("|"));
  check(calls.some((c) => c.url.includes("grant_type=password") && c.body.includes("amanda@example.com")), "the password goes to Supabase's sign-in (stubbed)");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.waitForTimeout(500);
  s = await state(page);
  check(s.hash === "#reset" && s.title === "Reset your password", "switching to reset happens in place", JSON.stringify(s));
  await page.goBack();
  await page.waitForTimeout(700);
  s = await state(page);
  check(s.hash === "" && !s.open, "Back closes the panel", JSON.stringify(s));
  check(s.focus === "Log in", "focus goes back to Log in", s.focus);
  check(page.url() === url, "Back stays on the front page", page.url());
  await context.close();
}

// 2. Sign up opens the sign-up form; Escape closes it.
{
  const { context, page } = await fresh();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click("a.su[data-auth]");
  await page.waitForTimeout(900);
  let s = await state(page);
  check(s.hash === "#signup" && s.title === "Create your account", "Sign up opens the sign-up form", JSON.stringify(s));
  await page.getByRole("link", { name: "Log in" }).click();
  await page.waitForTimeout(400);
  s = await state(page);
  check(s.hash === "#login" && s.title === "Log in to Parity", "Log in switches in place", JSON.stringify(s));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  s = await state(page);
  check(!s.open && s.hash === "", "Escape closes the panel", JSON.stringify(s));
  await context.close();
}

// 3. A direct link to /#signup opens the panel; the logo closes it.
{
  const { context, page } = await fresh();
  await page.goto(`${BASE}/#signup`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  let s = await state(page);
  check(s.open && s.title === "Create your account", "/#signup opens the panel on load", JSON.stringify(s));
  await page.locator(".pa-overlay .pa-corner a").click();
  await page.waitForTimeout(700);
  s = await state(page);
  check(!s.open && s.hash === "", "the logo closes the panel", JSON.stringify(s));
  await context.close();
}

// 4. Reduced motion: no fades.
{
  const { context, page } = await fresh({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click("a.li[data-auth]");
  await page.waitForTimeout(400);
  const t = await page.evaluate(() => [getComputedStyle(document.querySelector(".pa-overlay")).transitionDuration, getComputedStyle(document.querySelector("main")).transitionDuration]);
  check(t.every((d) => d.split(",").every((x) => parseFloat(x) === 0)), "reduced motion turns the fades off", t.join(" / "));
  await context.close();
}

// 5. The stand-alone page: same panel, next kept, forms switch in place, logo goes home.
{
  const { context, page } = await fresh();
  await page.goto(`${BASE}/login/?next=%2Fsim%2F`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const href = await page.getByRole("link", { name: "Create an account" }).getAttribute("href");
  check(href === "/signup/?next=%2Fsim%2F", "/login/ links keep next", href);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.waitForTimeout(500);
  check(new URL(page.url()).pathname + new URL(page.url()).search === "/signup/?next=%2Fsim%2F", "switching to sign up updates the address", page.url());
  check(await page.title() === "Sign up · Parity", "and the page title", await page.title());
  const orbs = await page.locator(".orbs i").count();
  check(orbs === 0, "no orbs on the stand-alone page", String(orbs));
  await page.locator(".pa-corner a").click();
  await page.waitForURL(`${BASE}/`, { timeout: 5000 }).catch(() => {});
  check(new URL(page.url()).pathname === "/", "the logo goes home", page.url());
  await context.close();
}

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
