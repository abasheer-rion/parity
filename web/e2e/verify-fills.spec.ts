// The fill price check (DEC-0092), end to end on the built site: a deliberately faked trade
// file, a genuine one, and the box left unticked. /api/verify/fills is the real server code
// (src/lib/verify/range/server.ts) running in this test process, with the made-up market of
// tests/fills/market.ts behind it (recorded layouts, synthetic prices): no real market data,
// no network. Checks what the page sends (symbol, time and price only) and what it shows.
import AxeBuilder from "@axe-core/playwright";
import type { Page, Route } from "@playwright/test";
import { handleFills } from "../src/lib/verify/range/server";
import { memoryCache, resetPacing } from "../src/lib/verify/range/load";
import { memoryFillQuota } from "../src/lib/verify/range/quota";
import { FILL_SOURCES } from "../src/lib/verify/range/registry";
import { marketFetch, PATH } from "../tests/fills/market";
import { expect, open, settled, test } from "./fixtures";

const NOW = Date.parse("2026-03-20T12:00:00Z");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const at = (iso: string) => Date.parse(`${iso}Z`);
const r2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

/**
 * Forty round trips in AAPL and ETH over four days, half an hour apart, priced at what the
 * made-up market traded. Faked: every third trade bought 5% under anything traded that day
 * and sold 5% above, the way an edited file makes a losing record look good.
 */
function file(fake: boolean): string {
  const rows = ["open_time,close_time,symbol,side,size,entry,exit,pnl"];
  for (let i = 0; i < 40; i++) {
    const day = `2026-03-${String(2 + Math.floor(i / 10)).padStart(2, "0")}`;
    const t0 = at(`${day}T14:40:00`) + (i % 10) * 30 * 60_000, t1 = t0 + 20 * 60_000;
    const path = i % 2 ? PATH.AAPL : PATH["ETH-USD"];
    const k = fake && i % 3 === 0 ? 0.05 : 0;
    const entry = path(t0) * (1 - k), exit = path(t1) * (1 + k);
    // Times written in UTC, and saying so, as exchange exports do.
    const iso = (t: number) => `${new Date(t).toISOString().slice(0, 19).replace("T", " ")} UTC`;
    rows.push(`${iso(t0)},${iso(t1)},${i % 2 ? "AAPL" : "ETHUSDT"},buy,1,${r2(entry)},${r2(exit)},${r2(exit - entry)}`);
  }
  return `${rows.join("\n")}\n`;
}

/** Serves /api/verify/fills from the real handler; returns every body the page sent. */
async function fillsApi(page: Page) {
  resetPacing();
  const sent: string[] = [];
  const m = marketFetch(), cache = memoryCache(), quota = memoryFillQuota();
  await page.route("**/api/verify/fills", async (route: Route) => {
    const req = route.request();
    const body = req.postData();
    if (body) sent.push(body);
    const res = await handleFills(new Request("https://paritytrading.app/api/verify/fills", { method: req.method(), headers: { ...req.headers(), origin: "https://paritytrading.app", "cf-connecting-ip": "10.9.9.9" }, body: body ?? undefined }), {
      env: { FILL_CHECK_STOCKS: "on", ALPACA_KEY_ID: "e2e", ALPACA_SECRET_KEY: "e2e" }, verify: async () => ({ userId: "e2e", clientId: null }),
      quota, sources: FILL_SOURCES, cache, fetch: m.fetch, siteDomain: "paritytrading.app", now: () => NOW, sleep: async () => undefined,
    });
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  return { sent };
}

async function upload(page: Page, csv: string) {
  await open(page, "/verify/");
  await settled(page);
  await page.locator(".vp-tool input[type=file]").setInputFiles({ name: "trades.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText(/Found:/)).toBeVisible();
  await page.getByRole("spinbutton", { name: /Starting balance/ }).fill("10000");
}

const row = (page: Page, label: string) => page.locator(".vf-checks li, li").filter({ hasText: label }).first();

test("a faked trade file: fills outside the traded range are counted, in plain words, and only symbol, time and price are sent", async ({ page }) => {
  const api = await fillsApi(page);
  await upload(page, file(true));
  const box = page.getByRole("checkbox", { name: "Check fill prices against market data" });
  await expect(box).toBeChecked();
  await expect(page.getByText(/This sends only the symbol, time and price of each fill \(80 fills\) to our server/)).toBeVisible();
  expect((await new AxeBuilder({ page }).include(".vf-fillcheck").withTags(TAGS).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Check this record" }).click();
  await expect(page.locator("#vf-verdict")).toBeVisible();
  const range = row(page, "Fill prices against the traded range");
  await expect(range).toContainText("28 of 80 fills fall outside the traded range on our data source, for example");
  await expect(range).not.toContainText(/fake|fraud|forged/i);
  await expect(page.locator("#vf-verdict")).not.toHaveText("Holds up");
  // What left the browser: the clock and, per fill, symbol, time and price. Nothing else.
  expect(api.sent.length).toBeGreaterThan(0);
  for (const body of api.sent) {
    const b = JSON.parse(body) as { clock: string; fills: Record<string, unknown>[] };
    expect(Object.keys(b).sort()).toEqual(["clock", "fills"]);
    expect(b.clock).toBe("utc");
    for (const f of b.fills) expect(Object.keys(f).sort()).toEqual(["p", "s", "t"]);
    expect(body).not.toMatch(/pnl|size|side|trades\.csv/);
  }
});

test("a genuine file passes, with the source named", async ({ page }) => {
  await fillsApi(page);
  await upload(page, file(false));
  await page.getByRole("button", { name: "Check this record" }).click();
  const range = row(page, "Fill prices against the traded range");
  await expect(range).toContainText("All 80 fills we could check sit inside the range traded at that time on our data source.");
  await expect(range).toContainText("Data provided for free by IEX.");
  await expect(row(page, "Fills while the market was closed")).toContainText("None of 40 fills is timed on a weekend or a market holiday.");
});

test("unticked, nothing is sent and the check says it was not run", async ({ page }) => {
  const api = await fillsApi(page);
  await upload(page, file(true));
  // The box is drawn over the input: a person clicks its words.
  await page.getByText("Check fill prices against market data", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Check fill prices against market data" })).not.toBeChecked();
  await page.getByRole("button", { name: "Check this record" }).click();
  await expect(row(page, "Fill prices against the traded range")).toContainText("Not run: you chose to keep every part of the file in this browser.");
  expect(api.sent).toEqual([]);
});

test.describe("signed out", () => {
  test.use({ signedIn: false });
  test("nothing is sent and the page says how to run it", async ({ page }) => {
    const api = await fillsApi(page);
    await upload(page, file(true));
    await expect(page.getByRole("checkbox", { name: "Check fill prices against market data" })).toHaveCount(0);
    await expect(page.getByText(/Signed out, every part of the file stays in this browser/)).toBeVisible();
    await page.getByRole("button", { name: "Check this record" }).click();
    await expect(row(page, "Fill prices against the traded range")).toContainText("Not checked while signed out");
    expect(api.sent).toEqual([]);
  });
});
