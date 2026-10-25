// Screenshots of the sign-in panel (DEC-0042): the front page fading to the panel, then log
// in, sign up and reset, on the panel and on the stand-alone pages, at desktop and phone
// width. Every Supabase request is answered by a stub here: it never signs in and never
// sends a real password.
//
//   npx vite --port 5199 --host 127.0.0.1   (in another terminal)
//   SHOTS_BASE=http://127.0.0.1:5199 SHOTS_OUT=~/Desktop/parity-auth node scripts/auth-shots.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SHOTS_BASE ?? "http://127.0.0.1:5199";
const OUT = (process.env.SHOTS_OUT ?? "auth-shots").replace(/^~/, process.env.HOME ?? "~");
mkdirSync(OUT, { recursive: true });

/** Fake answers for the sign-in service. A password is always "wrong". */
async function stubSupabase(context) {
  await context.route(/\/auth\/v1\//, async (route) => {
    const url = route.request().url();
    if (url.includes("grant_type=password")) {
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "invalid_credentials", error_code: "invalid_credentials", msg: "Invalid login credentials" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

const SIZES = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];

const browser = await chromium.launch();
for (const size of SIZES) {
  const context = await browser.newContext({ viewport: size.viewport, isMobile: size.isMobile, hasTouch: size.hasTouch, deviceScaleFactor: size.deviceScaleFactor ?? 1 });
  await stubSupabase(context);
  // The cookie notice is already answered, so it does not cover the panel in the pictures.
  await context.addInitScript(() => { try { localStorage.setItem("parity.consent.v1", JSON.stringify({ version: 1, essential: true, analytics: false, decidedAt: "2026-10-24T00:00:00Z" })); } catch { /* none */ } });
  const page = await context.newPage();
  const shot = (name) => page.screenshot({ path: `${OUT}/${size.name}-${name}.png` });

  // 1. The front page, then the fade to the panel, a few frames.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot("01-front");
  const link = page.locator("a.li[data-auth]");
  await link.hover().catch(() => {});
  await page.waitForTimeout(600);
  // Slow the fade to a tenth of its speed, so the frames show it part way.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });
  await link.click();
  let waited = 0;
  for (const t of [60, 140, 240, 340, 460, 640]) {
    await page.waitForTimeout((t - waited) * 10);
    waited = t;
    await shot(`02-fade-${String(t).padStart(3, "0")}ms`);
  }
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
  await page.waitForTimeout(500);
  await shot("03-panel-login");
  await page.getByLabel("Email").fill("amanda@example.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(600);
  await shot("04-panel-password");
  await page.getByLabel("Password", { exact: true }).fill("not a real password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForTimeout(900);
  await shot("05-panel-wrong-password");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.waitForTimeout(600);
  await shot("06-panel-reset");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  await shot("07-closed");

  // 2. Sign up in the panel.
  await page.goto(`${BASE}/#signup`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await shot("08-panel-signup");
  await page.getByLabel("Email").fill("amanda@example.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(600);
  await page.getByLabel("Choose a password").fill("short");
  await page.waitForTimeout(200);
  await shot("09-panel-signup-password");

  // 3. The stand-alone pages.
  for (const [path, name] of [["/login/", "10-page-login"], ["/signup/", "11-page-signup"], ["/reset/", "12-page-reset"], ["/verify/?type=email&token_hash=example", "13-page-verify"]]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await shot(name);
  }
  await page.goto(`${BASE}/login/?next=%2Fsim%2F`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByLabel("Email").fill("amanda");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);
  await shot("14-page-email-error");
  await context.close();
}
await browser.close();
console.log(`screenshots in ${OUT}`);
