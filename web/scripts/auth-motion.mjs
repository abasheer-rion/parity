// Records and checks the sign-in panel's motion and the password strength bar (DEC-0044)
// in a real browser, at desktop and phone width. Every Supabase request is answered by a
// stub here: nothing signs in for real and no real password is typed.
//
//   npx vite --port 5199 --host 127.0.0.1   (in another terminal)
//   AUTH_BASE=http://127.0.0.1:5199 AUTH_OUT=~/Desktop/parity-auth/v4 npm run auth:motion
//
// Writes a video and a frame sequence per scene to AUTH_OUT, prints one line per check and
// exits 1 if any fail.
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.AUTH_BASE ?? "http://127.0.0.1:5199").replace(/\/$/, "");
const OUT = (process.env.AUTH_OUT ?? "auth-motion").replace(/^~/, process.env.HOME ?? "~");
let failed = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};

// A made-up session in the shape Supabase returns. The token is not signed; nothing checks it.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "amanda@example.com", app_metadata: {}, user_metadata: {}, factors: [], created_at: "2026-10-25T00:00:00Z" };
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, aal: "aal1", amr: [{ method: "password", timestamp: now }], exp: now + 3600, role: "authenticated", email: user.email })}.stub`;
const session = { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "stub", user };

const browser = await chromium.launch();
const sizes = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];

async function scene(size, name, run, { reducedMotion = "no-preference", signIn = false } = {}) {
  const dir = join(OUT, size.name, name);
  mkdirSync(dir, { recursive: true });
  const { name: _n, ...opts } = size;
  const context = await browser.newContext({ ...opts, reducedMotion, recordVideo: { dir, size: size.viewport } });
  await context.route(/\/auth\/v1\//, (route) => {
    const url = route.request().url();
    const ok = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("grant_type=password")) return signIn ? ok(session) : route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "invalid_credentials", msg: "Invalid login credentials" }) });
    if (url.includes("/signup")) return ok(session);
    if (url.includes("/user")) return ok(user);
    return ok({});
  });
  await context.addInitScript(() => { try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 2, essential: true, analytics: false, decidedAt: "2026-10-24T00:00:00Z" })); } catch { /* none */ } });
  const page = await context.newPage();
  let n = 0;
  const frames = async (count, gap = 40) => {
    for (let i = 0; i < count; i++) { await page.screenshot({ path: join(dir, `${String(n++).padStart(3, "0")}.png`) }); if (gap) await page.waitForTimeout(gap); }
  };
  await run(page, frames);
  const video = page.video();
  await context.close();
  if (video) renameSync(await video.path(), join(dir, "motion.webm"));
}

const opacities = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => +getComputedStyle(e).opacity), sel);

for (const size of sizes) {
  // 1. The front page fades out and the sign-up panel rises in, part by part.
  await scene(size, "1-front-to-signup", async (page, frames) => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    if (size.name === "desktop") await page.hover("a.su[data-auth]");
    await page.waitForTimeout(300);
    await page.click("a.su[data-auth]", { noWaitAfter: true });
    await page.waitForTimeout(170);
    const early = await opacities(page, ".pa-overlay .pa-screen > *");
    await frames(14, 30);
    const late = await opacities(page, ".pa-overlay .pa-screen > *");
    check(early.length > 2 && early[0] >= early[early.length - 1], `${size.name}: the parts come in one after another`, early.map((x) => x.toFixed(2)).join(" "));
    check(late.every((x) => x === 1), `${size.name}: then all show`, late.join(" "));
    const blur = await page.evaluate(() => [...document.getAnimations()].some((a) => JSON.stringify(a.effect?.getKeyframes?.() ?? []).includes("blur")));
    check(blur, `${size.name}: entrance keyframes include a blur`);
  });

  // 2. Sign up: email step to password step (the old step slides out), the strength bar
  //    fills as the password grows, then the welcome.
  await scene(size, "2-signup-strength-welcome", async (page, frames) => {
    await page.goto(`${BASE}/signup/`, { waitUntil: "networkidle" });
    await frames(8, 40);
    await page.getByLabel("Email").pressSequentially("amanda@example.com", { delay: 18 });
    await page.getByRole("button", { name: "Continue" }).click({ noWaitAfter: true });
    await page.waitForTimeout(60);
    const ghosts = await page.locator(".pa-ghost").count();
    check(ghosts === 1, `${size.name}: the email step slides out while the password step comes in`, String(ghosts));
    const ghostHidden = await page.evaluate(() => { const g = document.querySelector(".pa-ghost"); return !!g && g.getAttribute("aria-hidden") === "true" && g.hasAttribute("inert") && !g.querySelector("[id]"); });
    check(ghostHidden, `${size.name}: the leaving step is hidden from screen readers and the keyboard`);
    await frames(10, 30);
    check(await page.locator(".pa-ghost").count() === 0, `${size.name}: and is gone after`);
    const field = page.getByLabel("Choose a password");
    check(await page.evaluate(() => document.activeElement?.getAttribute("autocomplete")) === "new-password", `${size.name}: focus is in the password field`);
    const seen = [];
    for (const part of ["rivet", "lamp", "4", "7", " quiet", " Ocean"]) {
      await field.pressSequentially(part, { delay: 30 });
      await page.waitForTimeout(120);
      seen.push(await page.locator(".pw-meter").getAttribute("data-score"));
      await frames(3, 30);
    }
    check(seen.every((x, i) => i === 0 || +x >= +seen[i - 1]) && seen[0] === "1" && seen.at(-1) === "4", `${size.name}: the bar rises with the password`, seen.join(" "));
    const said = await page.locator(".pw-sr[aria-live]").textContent();
    check(said === "Password strength: Strong", `${size.name}: the strength is announced in words`, said);
    const ticks = await page.locator(".pw-rules li.ok").count();
    check(ticks === 3, `${size.name}: every rule is ticked`, String(ticks));
    await page.getByLabel("Confirm password").fill("rivetlamp47 quiet Ocean");
    await page.getByRole("checkbox").check();
    await frames(2, 30);
    await page.getByRole("button", { name: "Create account" }).click({ noWaitAfter: true });
    await frames(16, 30);
    check(await page.getByRole("heading", { name: "Welcome to Parity" }).count() === 1, `${size.name}: a new account sees the welcome`);
    // One screen since DEC-0077: the questions are asked by the app's first-run intro.
    check(await page.getByRole("button", { name: /Go to the app|Continue where you were/ }).count() === 1, `${size.name}: the welcome has one button onward`);
  });

  // 3. Log in succeeds (stubbed): the button turns into a check and the panel fades out.
  await scene(size, "3-login-success", async (page, frames) => {
    await page.goto(`${BASE}/login/?next=%2Flegal%2Fterms%2F`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill("amanda@example.com");
    await page.getByRole("button", { name: "Continue" }).click({ noWaitAfter: true });
    await page.waitForTimeout(500);
    await page.getByLabel("Password", { exact: true }).focus();
    await frames(3, 40);
    const glow = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);
    check(glow.includes("22px"), `${size.name}: the focused field glows`, glow.slice(0, 60));
    await page.getByLabel("Password", { exact: true }).fill("stub only 123");
    const nav = page.waitForURL(/\/legal\/terms\//, { timeout: 8000 }).then(() => true, () => false);
    await page.getByRole("button", { name: "Log in" }).click({ noWaitAfter: true });
    let morphed = false;
    for (let i = 0; i < 12 && !morphed; i++) {
      morphed = await page.evaluate(() => document.documentElement.classList.contains("pa-leaving")).catch(() => false);
      if (!morphed) await page.waitForTimeout(25);
    }
    check(morphed, `${size.name}: the panel starts leaving after a good log in`);
    await frames(8, 25).catch(() => undefined);
    check(await nav, `${size.name}: then goes to next`);
  }, { signIn: true });

  // 4. Reduced motion: nothing moves.
  await scene(size, "4-reduced-motion", async (page, frames) => {
    await page.goto(`${BASE}/signup/`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill("amanda@example.com");
    await page.getByRole("button", { name: "Continue" }).click({ noWaitAfter: true });
    await page.waitForTimeout(30);
    const moving = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
    check(moving === 0, `${size.name}: reduced motion runs no animations`, String(moving));
    check(await page.locator(".pa-ghost").count() === 0, `${size.name}: and no step slides out`);
    await frames(2, 30);
  }, { reducedMotion: "reduce" });
}

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
