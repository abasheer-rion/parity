// Draws the social share images (1200 x 630) in public/og/ for the front page and the
// public Learn, Ideas and Notes pages (DEC-0023). Run by hand when the wording or the
// brand changes, and commit the PNGs:   node scripts/og-images.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const here = (p) => resolve(import.meta.dirname, p);
const logo = readFileSync(here("../public/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg"), "utf8");
const IMAGES = {
  default: ["Trading strategies, tested honestly", "Every idea tested against the S&P 500, failures included."],
  learn: ["Learn the words of trading", "Hundreds of terms, each explained simply, by analogy and precisely."],
  ideas: ["Trading ideas, with the evidence", "Where each idea came from, what the evidence says and why it might fail."],
  notes: ["Research notes in plain words", "How Parity decides, what the research found and how the numbers work."],
};

const page = (title, sub) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  body { margin: 0; width: 1200px; height: 630px; background: radial-gradient(900px 500px at 85% 10%, #1b2a6b 0%, #07080d 60%); color: #f1f3f9; font-family: Inter, sans-serif; }
  .box { position: absolute; inset: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
  .logo svg { height: 64px; width: auto; }
  h1 { font-size: 68px; line-height: 1.08; margin: 0 0 20px; letter-spacing: -0.02em; font-weight: 600; max-width: 980px; }
  p { font-size: 30px; color: #a3a8b9; margin: 0; max-width: 960px; }
  .url { font-size: 24px; color: #85a8ff; }
</style></head><body><div class="box">
  <div class="logo">${logo}</div>
  <div><h1>${title}</h1><p>${sub.replace("&", "&amp;")}</p></div>
  <div class="url">parity.endyland.com</div>
</div></body></html>`;

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [name, [title, sub]] of Object.entries(IMAGES)) {
  await tab.setContent(page(title, sub), { waitUntil: "networkidle" });
  await tab.screenshot({ path: here(`../public/og/${name}.png`) });
  console.log(`public/og/${name}.png`);
}
await browser.close();
