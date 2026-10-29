// REF-0016 acceptance test 8, "nothing leaves": opens Verify in a real browser (the app's
// page and the public checker at /verify/), uploads a
// synthetic trade log, runs the checks and fails if any request made after the upload
// carries a body or any piece of the file. Run against the dev server:
//
//   VITE_AUTH_BYPASS=1 npx vite --port 5199 --host 127.0.0.1   (in another terminal)
//   VERIFY_BASE=http://127.0.0.1:5199 node scripts/verify-network.mjs
//
// VERIFY_SHOTS=dir also saves screenshots of the empty page and the result.
import { chromium } from "playwright";

const BASE = process.env.VERIFY_BASE ?? "http://127.0.0.1:5199";
const SHOTS = process.env.VERIFY_SHOTS;

// 500 made-up trades: 56% winners of +100, losers of -100, on weekdays from 2023.
const rows = ["close_time,symbol,side,size,entry,exit,pnl"];
const d = new Date(Date.UTC(2023, 0, 2));
for (let i = 0; rows.length <= 500; d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
  const win = Math.floor((i + 1) * 0.56) > Math.floor(i * 0.56);
  rows.push(`${d.toISOString().slice(0, 10)} 15:30:00,EURUSD,buy,1,1.0${800 + (i % 97)},1.0${810 + (i % 97)},${win ? 100 : -100}`);
  i++;
}
const file = rows.join("\n") + "\n";
const needles = rows.slice(1, 40).flatMap((r) => r.split(",").slice(0, 1).concat(r));

const browser = await chromium.launch();
let failed = false;

// The app's Verify page, and the public checker at /verify/ (DEC-0081), signed out.
for (const [label, path, input] of [["app", "/app/#/verify", 'input[type="file"]'], ["public", "/verify/", '.vp-tool input[type="file"]']]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const reqs = [];
  page.on("request", (r) => reqs.push({ url: r.url(), method: r.method(), body: r.postData() ?? "" }));
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/verify-${label}-empty.png` });
  const start = reqs.length;
  await page.setInputFiles(input, { name: "trades.csv", mimeType: "text/csv", buffer: Buffer.from(file) });
  await page.getByText(/Found:/).waitFor();
  await page.getByRole("button", { name: "Check this record" }).click();
  await page.locator(".vf-verdict").waitFor();
  await page.waitForLoadState("networkidle");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/verify-${label}-result.png`, fullPage: true });
  const after = reqs.slice(start);
  const leaks = after.filter((r) => r.body.length > 0 || needles.some((n) => decodeURIComponent(r.url).includes(n)));
  console.log(`${label} ${path}: requests after the upload: ${after.length}`);
  for (const r of after) console.log(`  ${r.method} ${r.url.replace(BASE, "")}${r.body ? ` (body ${r.body.length} bytes)` : ""}`);
  console.log(`${label} ${path}: requests carrying file content: ${leaks.length}`);
  if (errors.length) console.log(`page errors: ${errors.join(" | ")}`);
  if (leaks.length || errors.length) failed = true;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
