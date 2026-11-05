// The Verify report (DEC-0088, DEC-0089), end to end on the built site, signed out: a trade
// file becomes a report with its pictures and explained numbers; the report travels in a link
// and opens the same on /verify/report/; "Save as PDF" prints still pictures; the image card
// downloads as a PNG; two reports sit side by side on /verify/compare/; and a seller's page
// (the page reader stubbed here) lists each claim with its words and checks it against a file.
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, open, test } from "./fixtures";

test.use({ signedIn: false });

/** A made-up trade list: `n` trades over about two years, seeded, so every run is the same. */
function trades(n: number, winRate: number, win: number, loss: number, seed: number): Buffer {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rows = ["close_time,symbol,side,size,pnl"];
  const d = new Date(Date.UTC(2023, 0, 2));
  for (let i = 0; i < n; i++) {
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    const w = r() < winRate;
    rows.push(`${d.toISOString().slice(0, 10)} 15:30:00,${["EURUSD", "GBPUSD", "XAUUSD"][i % 3]},${i % 2 ? "buy" : "sell"},1,${(w ? win * (0.6 + r() * 0.8) : -loss * (0.6 + r() * 0.8)).toFixed(2)}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return Buffer.from(rows.join("\n") + "\n");
}

const EDGE = trades(520, 0.56, 100, 90, 7);
const BOT = trades(400, 0.9, 20, 190, 11);

async function check(page: Page, buffer: Buffer, name: string, balance = "10000", tries = "5") {
  await open(page, "/verify/");
  await page.locator(".vp-tool input[type=file]").setInputFiles({ name, mimeType: "text/csv", buffer });
  await expect(page.locator(".vf-found")).toContainText("closed trades");
  await page.getByLabel(/2\. Starting balance/).fill(balance);
  await page.getByLabel(/3\. How many/).fill(tries);
  await page.getByRole("button", { name: "Check this record" }).click();
  await expect(page.locator("#vf-verdict")).toBeVisible();
}

async function linkOf(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Copy a link to this report" }).click();
  const link = await page.getByTestId("report-link").inputValue();
  expect(link).toMatch(/\/verify\/report\/#r=z[A-Za-z0-9_-]+$/);
  return link;
}

test.describe("the Verify report", () => {
  test("a trade file becomes a report with its pictures, its numbers explained and its limits", async ({ page }) => {
    const sent: string[] = [];
    page.on("request", (r) => { if (r.postData()) sent.push(r.url()); });
    await check(page, EDGE, "edge.csv");
    const sentence = await page.getByTestId("verdict-sentence").innerText();
    expect(sentence.length).toBeGreaterThan(40);
    // The numbers that decided it, each with its meaning on focus.
    const keys = page.locator(".rp-keys .vf-num");
    await expect(keys.first()).toBeVisible();
    expect(await keys.count()).toBeGreaterThanOrEqual(5);
    await keys.first().focus();
    await expect(page.getByRole("tooltip")).toContainText(/tries/);
    // The pictures: growth, luck against tries, the spread with its 95% range, falls, where it wins and loses.
    for (const name of ["Growth over time", "Could it be luck, after every try?", "How sure is the result?", "Falls from a high", "Where it wins and where it loses"]) {
      const card = page.locator("[data-chart]").getByRole("heading", { name, exact: true });
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();
    }
    await expect(page.locator("[data-chart] .sg-stage svg").first()).toBeVisible();
    // Signed out, the S&P 500 is not loaded, and the report says so instead of leaving a gap.
    await expect(page.getByText(/Not compared with the S&P 500: our daily prices load for signed-in accounts only/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "What was checked" })).toBeVisible();
    await expect(page.locator(".rp-inputs")).toContainText("Self-reported");
    await expect(page.getByRole("heading", { name: "What could not be checked" })).toBeVisible();
    await expect(page.locator(".rp-cannot li").first()).toBeVisible();
    // Nothing was sent: the file is read and checked in the browser.
    expect(sent).toEqual([]);
  });

  test("a link carries the whole report and opens the same, without Parity storing it", async ({ page, context }) => {
    await check(page, EDGE, "edge.csv");
    const verdict = await page.locator("#vf-verdict").innerText();
    const sentence = await page.getByTestId("verdict-sentence").innerText();
    const link = await linkOf(page);
    const other = await context.newPage();
    const urls: string[] = [];
    other.on("request", (r) => urls.push(r.url()));
    await open(other, link.replace(/^https?:\/\/[^/]+/, ""));
    await expect(other.locator("#vf-verdict")).toHaveText(verdict);
    await expect(other.getByTestId("verdict-sentence")).toHaveText(sentence);
    await expect(other.getByText(/Shared by link/)).toBeVisible();
    // The report is after "#", so no request ever carries it.
    const code = link.split("#r=")[1];
    expect(urls.some((u) => u.includes(code.slice(0, 40)))).toBe(false);
    // An edited link says so plainly.
    await open(other, `/verify/report/#r=${code.slice(0, 200)}`);
    await expect(other.getByRole("alert")).toContainText(/damaged/);
  });

  test("Save as PDF prints still pictures on a light page, and the PDF is made", async ({ page, browserName }) => {
    await page.addInitScript(() => {
      (window as unknown as { __printed: number[] }).__printed = [];
      window.print = () => { (window as unknown as { __printed: number[] }).__printed.push(document.querySelectorAll(".rp-still svg").length); };
    });
    await check(page, EDGE, "edge.csv");
    await page.getByRole("button", { name: "Save as PDF" }).click();
    const stills = await page.evaluate(() => (window as unknown as { __printed: number[] }).__printed);
    expect(stills.length).toBe(1);
    expect(stills[0]).toBeGreaterThanOrEqual(4);
    if (browserName === "chromium") {
      await page.emulateMedia({ media: "print" });
      await expect(page.locator(".rp-actions")).toBeHidden();
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdf.length).toBeGreaterThan(50_000);
    }
  });

  test("the image card downloads as a PNG", async ({ page }) => {
    await check(page, EDGE, "edge.csv");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Image for a post" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^parity-verify-[a-z-]+-\d{4}-\d{2}-\d{2}\.png$/);
    const png = readFileSync((await download.path())!);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.length).toBeGreaterThan(20_000);
  });
});

test.describe("two records side by side", () => {
  test("two report links open next to each other, with the same numbers in the same rows", async ({ page }) => {
    await check(page, EDGE, "edge.csv");
    const a = (await linkOf(page)).split("#r=")[1];
    await check(page, BOT, "bot.csv");
    const bVerdict = await page.locator("#vf-verdict").innerText();
    const b = (await linkOf(page)).split("#r=")[1];
    await open(page, `/verify/compare/#a=${a}&b=${b}`);
    await expect(page.getByTestId("compare-sentence")).toContainText("does not rank");
    const table = page.getByRole("region", { name: "The two records' numbers" });
    await expect(table.getByRole("row", { name: /^Verdict/ })).toContainText(bVerdict);
    await expect(table.getByRole("row", { name: /^Largest fall from a high/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Growth over the same days" })).toBeVisible();
    // A side can be swapped for a file checked right here.
    await page.getByRole("button", { name: "Use another record" }).last().click();
    await page.locator(".vf-drop input[type=file]").setInputFiles({ name: "edge.csv", mimeType: "text/csv", buffer: EDGE });
    await page.getByLabel("Starting balance").fill("20000");
    await page.getByRole("button", { name: "Check record B" }).click();
    await expect(page.getByTestId("compare-sentence")).toBeVisible();
    expect(page.url()).toMatch(/#a=z[^&]+&b=z/);
  });
});

test.describe("a seller's claims", () => {
  const PAGE_TEXT = readFileSync(resolve(import.meta.dirname, "../tests/fixtures/verify/pages/post.txt"), "utf8");

  test("a page's claims are listed with their words and checked against a trade file", async ({ page }) => {
    // The page reader is a Pages Function; here it answers as it would for a readable page.
    await page.route("**/api/verify/claim-url", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, url: "https://bots.example.com/gold", final_url: "https://bots.example.com/gold", title: "Gold bot", read_at: "2026-11-03T10:00:00Z", found: [], claim: {}, notes: [], text: PAGE_TEXT }),
    }));
    await open(page, "/verify/");
    await page.getByRole("radio", { name: /Check a seller's claim/ }).click();
    await page.getByLabel("A seller's page address, or their words").fill("https://bots.example.com/gold");
    await page.getByRole("button", { name: "Read the page's claims" }).click();
    const claims = page.locator(".rp-claim");
    const winRate = claims.filter({ has: page.locator(".rp-claim-label", { hasText: /^Win rate$/ }) });
    await expect(claims.first()).toBeVisible();
    await expect(page.locator(".rp-claims")).toContainText("read from bots.example.com");
    await expect(winRate).toContainText("71% win rate");
    await expect(winRate.getByRole("link", { name: "Open on the page" })).toHaveAttribute("href", /bots\.example\.com\/gold#:~:text=/);
    await expect(winRate).toContainText("Needs the record");
    await page.getByRole("button", { name: "Check them against a trade file" }).click();
    await expect(page.getByText(/Checking against \d+ claims from bots\.example\.com/)).toBeVisible();
    await page.locator(".vp-tool input[type=file]").setInputFiles({ name: "bot.csv", mimeType: "text/csv", buffer: BOT });
    await page.getByLabel(/2\. Starting balance/).fill("10000");
    await page.getByRole("button", { name: "Check this record" }).click();
    await expect(winRate).toContainText(/Agrees|Differs/);
    await expect(page.locator(".rp-claims")).toContainText(/claims compared/);
  });

  test.describe("a refused page", () => {
    // The page reader answers 422 on purpose here.
    test.use({ allowHttp: [/^422 .*\/api\/verify\/claim-url$/], expectConsole: [/status of 422/] });
    test("a page that cannot be read says why, and words still work", async ({ page }) => {
      await page.route("**/api/verify/claim-url", (route) => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "robots", detail: "X does not allow automatic reading of posts (its robots.txt asks every reader to stay out), so we did not open it. Copy the words from the page and paste them instead." }) }));
      await open(page, "/verify/");
      await page.getByRole("radio", { name: /Check a seller's claim/ }).click();
      const box = page.getByLabel("A seller's page address, or their words");
      await box.fill("https://x.com/someone/status/1");
      await page.getByRole("button", { name: "Read the page's claims" }).click();
      await expect(page.getByRole("alert")).toContainText("X does not allow automatic reading");
      await box.fill(PAGE_TEXT);
      await page.getByRole("button", { name: "Check these words" }).click();
      await expect(page.locator(".rp-claim").first()).toBeVisible();
      await expect(page.locator(".rp-claims")).toContainText("read from the words you pasted");
    });
  });
});

test.describe("a batch row", () => {
  test("an account's name opens its full report in a new tab", async ({ page, context }) => {
    await open(page, "/business/prop-firms/sample/");
    const first = page.getByRole("button", { name: /^Open the full Verify report for account / }).first();
    await expect(first).toBeVisible({ timeout: 30_000 });
    const [tab] = await Promise.all([context.waitForEvent("page"), first.click()]);
    await expect(tab.locator("#vf-verdict")).toBeVisible({ timeout: 20_000 });
    await expect(tab.getByText(/in the batch screen/)).toBeVisible();
    expect(tab.url()).toMatch(/\/verify\/report\/#r=z/);
  });
});
