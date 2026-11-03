// Verify a strategy from its code (DEC-0083), end to end on /verify/: each sample strategy is
// pasted, read, run on the test price file (made up, tests/fixtures/verify/strategy/) and
// judged; code that cannot run names each part with its line; a description in words goes
// through the person's own model (stubbed here, never a Parity key) and the rules it wrote
// are shown before they run. Nothing pasted is ever sent to Parity.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, open, test } from "./fixtures";

const code = (f: string) => readFileSync(resolve(import.meta.dirname, "../tests/fixtures/verify/strategy/code", f), "utf8");

async function codeMode(page: Page) {
  await open(page, "/verify/");
  await page.getByRole("radio", { name: /Paste strategy code/ }).click();
}

async function pick(page: Page, label: string, option: RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

async function paste(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Paste the strategy's code" }).fill(text);
}

/** Every request that carried a body: pasted code must never be one of them. */
function watchPosts(page: Page): string[] {
  const sent: string[] = [];
  page.on("request", (r) => { if (r.postData()) sent.push(`${r.url()} ${r.postData()!.slice(0, 80)}`); });
  return sent;
}

const SAMPLES: { file: string; market: RegExp; verdict: string; tries: string; sentence: RegExp }[] = [
  { file: "sma-cross.pine", market: /\(BTCUSD\)/, verdict: "Does not hold up", tries: "1 stated + 24 nearby = 25", sentence: /each trade loses 78\.47 after fees, with 36\.1% winners/ },
  { file: "rsi-stops.pine", market: /\(BTCUSD\)/, verdict: "Does not hold up", tries: "1 stated + 24 nearby = 25", sentence: /each trade loses 398\.03/ },
  { file: "macd-long-short.pine", market: /\(EURUSD\)/, verdict: "Does not hold up", tries: "1 stated + 80 nearby = 81", sentence: /each trade loses 26\.95/ },
  { file: "sma-cross-pandas.py", market: /\(BTCUSD\)/, verdict: "Fragile", tries: "1 stated + 24 nearby = 25", sentence: /fell 87% from a high/ },
  { file: "sma-cross-backtesting.py", market: /\(SPX\)/, verdict: "Does not hold up", tries: "1 stated + 124 nearby = 125", sentence: /each trade loses 60\.39/ },
];

test.describe("verify a strategy from its code", () => {
  for (const s of SAMPLES) {
    test(`${s.file} is read, run on our prices and judged`, async ({ page }) => {
      const sent = watchPosts(page);
      await codeMode(page);
      await paste(page, code(s.file));
      await pick(page, "Market to run it on", s.market);
      await page.getByRole("button", { name: "Run and check it" }).click();
      await expect(page.locator("#vf-verdict")).toHaveText(s.verdict, { timeout: 20_000 });
      await expect(page.getByTestId("verdict-sentence")).toContainText(s.sentence);
      const ran = page.locator(".vf-ran");
      await expect(ran).toContainText(s.tries);
      await expect(ran).toContainText("Filled one day later");
      await expect(page.getByText("Settings next to yours.")).toBeVisible();
      expect(sent).toEqual([]);
    });
  }

  test("rules in our format run too", async ({ page }) => {
    await codeMode(page);
    await paste(page, JSON.stringify({ inputs: { n: 50 }, let: { m: ["sma", "close", "n"] }, long: { entry: ["crossover", "close", "m"], exit: ["crossunder", "close", "m"], stop_loss: 0.1 } }));
    await pick(page, "Market to run it on", /\(SPX\)/);
    await page.getByRole("button", { name: "Run and check it" }).click();
    await expect(page.locator("#vf-verdict")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".vf-ran")).toContainText("1 stated + 4 nearby = 5");
  });

  test("code it cannot run names each part and its line, and runs nothing", async ({ page }) => {
    await codeMode(page);
    await paste(page, code("unsupported.pine"));
    await page.getByRole("button", { name: "Run and check it" }).click();
    const box = page.locator(".vf-cannot");
    await expect(box).toContainText("We cannot run this yet. 4 parts");
    await expect(box).toContainText("Line 5request.security");
    await expect(box).toContainText("Line 8high");
    await expect(box).toContainText("trailing stops need the day's high and low");
    await expect(page.locator(".vf-verdict")).toHaveCount(0);
  });

  test("Python that reads tomorrow's price is refused as peeking", async ({ page }) => {
    await codeMode(page);
    await paste(page, code("peeking.py"));
    await page.getByRole("button", { name: "Run and check it" }).click();
    await expect(page.locator(".vf-cannot")).toContainText("reads prices from the future");
  });

  test("a syntax mistake names the line", async ({ page }) => {
    await codeMode(page);
    await paste(page, '//@version=5\nstrategy("x")\nfast = ta.sma(close, 10\nslow = 2');
    await page.getByRole("button", { name: "Run and check it" }).click();
    await expect(page.getByRole("alert")).toContainText(/^Line \d+: /);
  });

  test("a description in words goes through the person's own model, and the rules show before they run", async ({ page }) => {
    const reply = { rules: { inputs: { fast: 20, slow: 50 }, let: { f: ["sma", "close", "fast"], s: ["sma", "close", "slow"] }, long: { entry: ["crossover", "f", "s"], exit: ["crossunder", "f", "s"], stop_loss: 0.08 } }, assumed: [], unsupported: [] };
    let asked = 0;
    await page.addInitScript(() => { localStorage.setItem("parity.ai.provider", "anthropic"); localStorage.setItem("parity.ai.key.anthropic", "sk-ant-e2e-test-key"); });
    await page.route("https://api.anthropic.com/v1/messages", async (route) => {
      asked++;
      expect(route.request().headers()["x-api-key"]).toBe("sk-ant-e2e-test-key");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify(reply) }], stop_reason: "end_turn" }) });
    });
    await codeMode(page);
    await page.getByRole("radio", { name: /A description in words/ }).click();
    await page.getByRole("button", { name: "Use the example" }).click();
    await page.getByRole("button", { name: "Write the rules with my model" }).click();
    await expect(page.locator(".vf-rules")).toContainText("Buy when f crosses above s.");
    await expect(page.locator(".vf-rules")).toContainText("Stop 8.0% from the entry price.");
    await page.getByRole("button", { name: "Run and check these rules" }).click();
    await expect(page.locator("#vf-verdict")).toBeVisible({ timeout: 20_000 });
    expect(asked).toBe(1);
  });

  test("no key: the prompt can be copied into any AI chat", async ({ page }) => {
    await codeMode(page);
    await page.getByRole("radio", { name: /A description in words/ }).click();
    await expect(page.getByRole("button", { name: "Write the rules with my model" })).toBeDisabled();
    await page.getByText("No key? Use any AI chat instead").click();
    await expect(page.getByRole("textbox", { name: "The prompt for your AI chat" })).toHaveValue(/parity-rules-1/);
  });
});

test.describe("verify a strategy from its code, signed out", () => {
  test.use({ signedIn: false });
  test("the code is read, and running it asks for a free account", async ({ page }) => {
    const sent = watchPosts(page);
    await codeMode(page);
    await paste(page, code("sma-cross.pine"));
    await page.getByRole("button", { name: "Read the code" }).click();
    await expect(page.getByText("The code reads cleanly.")).toBeVisible();
    await expect(page.getByRole("link", { name: "create a free account" })).toHaveAttribute("href", "/signup/?next=%2Fverify%2F");
    await expect(page.locator(".vf-verdict")).toHaveCount(0);
    expect(sent).toEqual([]);
  });
});
