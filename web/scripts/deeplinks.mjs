// End-to-end check of page tags, share images and deep links, signed out (DEC-0038).
// It never signs in and never types a password: it checks that a protected deep link
// sends a signed-out visitor to log in with the exact address kept for afterwards.
//
//   npm run build && npx wrangler pages dev dist --port 8788   (in another terminal)
//   DEEPLINK_BASE=http://127.0.0.1:8788 npm run deeplinks
//   DEEPLINK_BASE=https://paritytrading.app npm run deeplinks   (the live site)
//
// Prints one line per check and exits 1 if any fail.
import { chromium } from "playwright";

const BASE = (process.env.DEEPLINK_BASE ?? "http://127.0.0.1:8788").replace(/\/$/, "");
const BADGE = process.env.DEEPLINK_BADGE ?? "AAAAAAAAAAAA";
let failed = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};

// 1. The tags a link preview reads, straight from the HTML (no script runs for a crawler).
for (const [path, title] of [["/", "Parity: check trading records and strategies"], ["/legal/privacy/", "Privacy policy · Parity"], ["/login/", "Log in · Parity"]]) {
  const html = await (await fetch(`${BASE}${path}`)).text();
  check(html.includes(`<title>${title}</title>`), `${path} title`);
  check(/<meta property="og:image" content="https:\/\/[^"]+\/og\/[a-z]+\.png"/.test(html), `${path} og:image`);
  check(/<meta name="twitter:card" content="summary_large_image"/.test(html), `${path} twitter card`);
  check(/<link rel="canonical" href="https:\/\/[^"]+"/.test(html), `${path} canonical`);
  check(!/name="robots"/.test(html), `${path} has no noindex`);
}
const front = await (await fetch(`${BASE}/`)).text();
check(/"@type":"Organization"/.test(front) && /"@type":"SoftwareApplication"/.test(front), "/ structured data");

// 2. Share images: a static one, a strategy's and a badge's.
for (const path of ["/og/default.png", "/og/strategy/fx_carry.png", `/og/badge/${BADGE}.png`]) {
  const res = await fetch(`${BASE}${path}`);
  check(res.ok && res.headers.get("content-type") === "image/png", `${path} is a PNG`, `${res.status} ${res.headers.get("content-type")}`);
}
const badgeHtml = await (await fetch(`${BASE}/v/${BADGE}`)).text();
check(badgeHtml.includes(`/og/badge/${BADGE}.png`), `/v/${BADGE} points og:image at its own card`);
check(/<title>[^<]*Parity Verify<\/title>/.test(badgeHtml), `/v/${BADGE} title names the verdict`);

// 3. Protected deep links, signed out: log in, with the exact address kept for afterwards.
const browser = await chromium.launch();
const page = await browser.newPage();
const cases = [
  ["/app/#/strategy/fx_carry", "/app/#/strategy/fx_carry"],
  ["/research/#/search?asset=fx&q=carry", "/research/#/search?asset=fx&q=carry"],
  ["/app/#/verify?mode=describe&example=1", "/app/#/verify?mode=describe&example=1"],
  ["/sim/scenario?type=war", "/sim/scenario?type=war"],
  ["/s/fx_carry", "/app/#/strategy/fx_carry"],
];
for (const [path, want] of cases) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const url = new URL(page.url());
  check(url.pathname === "/login/", `${path} goes to log in`, url.pathname);
  // The log-in page's links carry the address it will return to (src/auth/redirect.ts).
  const href = await page.locator('a[href^="/signup/"]').first().getAttribute("href", { timeout: 10000 }).catch(() => null);
  const next = href ? new URL(href, BASE).searchParams.get("next") : null;
  check(next === want, `${path} comes back to ${want} after log in`, `next=${next}`);
}
await browser.close();

console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
