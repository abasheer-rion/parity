// The product side (/app/), signed in: search, the account menu, the phone menu, Discover,
// a strategy page, Verify with a real file, bookmarks and the watchlist, practice positions,
// the getting started checklist and Account settings.
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, open, settled, test } from "./fixtures";

const isPhone = (name: string) => name === "phone";

/** Opens the side menu on a phone (it is always there on a desktop). */
async function menu(page: Page, phone: boolean) {
  if (!phone) return;
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeInViewport();
}

test.describe("search", () => {
  test("opens from the side menu, finds a strategy and opens it with Enter", async ({ page }, info) => {
    await open(page, "/app/#/");
    await settled(page);
    await menu(page, isPhone(info.project.name));
    await page.getByRole("button", { name: "Search or ask" }).click();
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").fill("currency carry");
    await expect(dialog.getByRole("link").filter({ hasText: "Classic Carry" }).first()).toBeVisible();
    await dialog.getByRole("textbox").press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the keyboard shortcut opens it and Escape closes it, also from a suggestion", async ({ page }, info) => {
    test.skip(isPhone(info.project.name), "keyboard shortcut, desktop only");
    await open(page, "/app/#/strategies");
    await settled(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.keyboard.press("ControlOrMeta+k");
    await dialog.getByRole("button", { name: "what is carry" }).focus();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("a question gets an answer, and nothing found says so", async ({ page }, info) => {
    await open(page, "/app/#/");
    await settled(page);
    await menu(page, isPhone(info.project.name));
    await page.getByRole("button", { name: "Search or ask" }).click();
    const dialog = page.getByRole("dialog", { name: "Search" });
    await dialog.getByRole("button", { name: "what is carry" }).click();
    await expect(dialog.getByText("Answer", { exact: true })).toBeVisible();
    await dialog.getByRole("textbox").fill("qqqzzzxxx");
    await expect(dialog.getByText(/Nothing matches/)).toBeVisible();
  });
});

test.describe("account menu", () => {
  test("opens, closes with Escape, and closes when you click elsewhere", async ({ page }, info) => {
    await open(page, "/app/#/");
    await settled(page);
    await menu(page, isPhone(info.project.name));
    const button = page.getByRole("button", { name: "e2e" });
    await button.click();
    const list = page.getByRole("menu");
    await expect(list).toBeVisible();
    await expect(list).toContainText("e2e@example.com");
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await menu(page, isPhone(info.project.name));
    await button.click();
    await expect(list).toBeVisible();
    // A click on the page beside the menu closes it, like any menu.
    await page.getByRole("complementary").click({ position: { x: 10, y: 120 } });
    await expect(list).toBeHidden();
  });

  test("Account and settings opens the settings page", async ({ page }, info) => {
    await open(page, "/app/#/");
    await settled(page);
    await menu(page, isPhone(info.project.name));
    await page.getByRole("button", { name: "e2e" }).click();
    await page.getByRole("menuitem", { name: "Account and settings" }).click();
    await expect(page).toHaveURL(/#\/settings\/account$/);
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  });
});

test.describe("phone menu", () => {
  test("opens, closes with Escape, and closes after picking a page", async ({ page }, info) => {
    test.skip(!isPhone(info.project.name), "the menu button is phone only");
    await open(page, "/app/#/");
    await settled(page);
    const fab = page.getByRole("button", { name: "Open menu" });
    await fab.click();
    await expect(fab).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(fab).toHaveAttribute("aria-expanded", "false");
    await fab.click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Watchlist" }).click();
    await expect(page).toHaveURL(/#\/watchlist$/);
    await expect(fab).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("heading", { level: 1, name: "Watchlist" })).toBeVisible();
  });
});

test.describe("discover", () => {
  test("a quick filter narrows the list and the count follows", async ({ page }) => {
    await open(page, "/app/#/strategies");
    await settled(page);
    const count = page.getByText(/^\d+ of \d+ strategies/);
    await expect(count).toContainText("7 of 7");
    await page.getByRole("button", { name: "Currencies", exact: true }).click();
    await expect(count).not.toContainText("7 of 7");
    const rows = page.getByRole("table", { name: "Strategies" }).getByRole("rowgroup").nth(1).getByRole("row");
    await expect(rows.filter({ hasText: "Ten-Month Trend" })).toHaveCount(0);
    await page.getByRole("button", { name: "Currencies", exact: true }).click();
    await expect(count).toContainText("7 of 7");
  });

  test("a search with no match says so", async ({ page }) => {
    await open(page, "/app/#/strategies");
    await settled(page);
    await page.getByRole("searchbox", { name: "Search strategies" }).fill("qqqzzz");
    await expect(page.getByText(/^0 of 7 strategies/)).toBeVisible();
  });

  test("sorting by a column orders the strategies one way, then the other", async ({ page }) => {
    await open(page, "/app/#/strategies");
    await settled(page);
    const table = page.getByRole("table", { name: "Strategies" });
    const sharpe = async () => {
      // The US market stays pinned at the top, so it is left out.
      const cells = await table.getByRole("rowgroup").nth(1).getByRole("row").evaluateAll((rows) =>
        rows.slice(1).map((r) => Number((r.querySelectorAll("td")[4]?.textContent ?? "").replace("−", "-"))).filter((n) => Number.isFinite(n)));
      return cells;
    };
    await table.getByRole("button", { name: "Sharpe" }).click();
    const a = await sharpe();
    await table.getByRole("button", { name: "Sharpe" }).click();
    const b = await sharpe();
    expect(a.length).toBeGreaterThan(2);
    const sorted = (xs: number[], dir: number) => xs.every((x, i) => i === 0 || (x - xs[i - 1]) * dir <= 0);
    expect(sorted(a, 1) || sorted(a, -1), `sorted one way: ${a}`).toBe(true);
    expect(b).toEqual([...a].reverse());
  });

  test("a row opens its strategy page", async ({ page }) => {
    await open(page, "/app/#/strategies");
    await settled(page);
    await page.getByRole("link", { name: "Classic Carry", exact: true }).click();
    await expect(page).toHaveURL(/#\/strategy\/fx_carry/);
    await expect(page.getByRole("heading", { level: 1, name: "Classic Carry" })).toBeVisible();
  });
});

test.describe("strategy page", () => {
  test("the time range changes the growth figure", async ({ page }) => {
    await open(page, "/app/#/strategy/fx_carry");
    await settled(page);
    const tabs = page.getByRole("tablist", { name: "Time range" });
    await expect(page.getByText("All time", { exact: true })).toBeVisible();
    await tabs.getByRole("tab", { name: "5Y" }).click();
    await expect(tabs.getByRole("tab", { name: "5Y" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("All time", { exact: true })).toHaveCount(0);
    await expect.poll(() => decodeURIComponent(new URL(page.url()).hash)).toContain("range=5Y");
    // Reloading the link keeps the range (it used to fall back to ALL).
    await page.reload();
    await expect(page.getByRole("tablist", { name: "Time range" }).getByRole("tab", { name: "5Y" })).toHaveAttribute("aria-selected", "true");
  });

  test("the charts name the strategy in plain words, not its code name", async ({ page }) => {
    await open(page, "/app/#/strategy/fx_carry");
    await settled(page);
    await expect(page.getByRole("img", { name: "Drawdown of Classic Carry" })).toHaveCount(1);
    await expect(page.getByRole("img", { name: /fx_carry/ })).toHaveCount(0);
  });

  test("the market line can be hidden and shown", async ({ page }) => {
    await open(page, "/app/#/strategy/fx_carry");
    await settled(page);
    const market = page.getByRole("button", { name: "US Market", exact: true });
    await expect(market).toHaveAttribute("aria-pressed", "true");
    await market.click();
    await expect(market).toHaveAttribute("aria-pressed", "false");
    await market.click();
    await expect(market).toHaveAttribute("aria-pressed", "true");
  });

  test("bookmarking a strategy puts it in the side menu and the watchlist", async ({ page }, info) => {
    await open(page, "/app/#/strategy/fx_carry");
    await settled(page);
    await page.getByRole("button", { name: "Add to bookmarks" }).click();
    await expect(page.getByRole("button", { name: /Remove (from )?bookmark/ })).toBeVisible();
    await menu(page, isPhone(info.project.name));
    await expect(page.getByRole("complementary").getByRole("link", { name: "Classic Carry" })).toBeVisible();
    await page.goto("/app/#/watchlist");
    await expect(page.getByRole("main").getByText("Classic Carry").first()).toBeVisible();
  });

  test("a word in the key statistics opens its explanation", async ({ page }) => {
    await open(page, "/app/#/strategy/fx_carry");
    await settled(page);
    await page.getByRole("link", { name: "Sharpe ratio", exact: true }).first().click();
    await expect(page).toHaveURL(/#\/learn\/sharpe/);
    await expect(page.getByRole("main").getByRole("heading", { name: "Sharpe ratio", exact: true })).toBeInViewport();
  });
});

test.describe("verify", () => {
  const csv = resolve(import.meta.dirname, "../tests/fixtures/verify/generic.csv");

  test("a trade log is read on the device and checked", async ({ page }) => {
    await open(page, "/app/#/verify");
    await settled(page);
    await page.locator("input[type=file]").setInputFiles(csv);
    await expect(page.getByText(/^Found:/)).toBeVisible();
    await page.getByLabel(/Starting balance/).fill("10000");
    await page.getByLabel(/How many strategies/).fill("3");
    await page.getByRole("button", { name: "Check this record" }).click();
    await expect(page.getByText(/Profit per trade/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Luck check/).first()).toBeVisible();
  });

  test("a file that is not a trade list gets a plain error", async ({ page }) => {
    await open(page, "/app/#/verify");
    await settled(page);
    await page.locator("input[type=file]").setInputFiles({ name: "notes.csv", mimeType: "text/csv", buffer: Buffer.from("hello\nworld\n") });
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Check this record" })).toHaveCount(0);
  });

  test("a picture is refused before reading", async ({ page }) => {
    await open(page, "/app/#/verify");
    await settled(page);
    await page.locator("input[type=file]").setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
    await expect(page.getByRole("alert").filter({ hasText: /csv/i })).toBeVisible();
  });

  test("describing a bot needs a real description first", async ({ page }) => {
    await open(page, "/app/#/verify");
    await settled(page);
    await page.getByRole("radio", { name: "Describe a bot" }).click();
    const check = page.getByRole("button", { name: "Check this description" });
    await expect(check).toBeDisabled();
    await page.getByRole("textbox").first().fill("Buys the US market when it is above its 200-day average, otherwise holds cash.");
    await expect(check).toBeEnabled();
  });

  test("picking one of our strategies shows its check", async ({ page }) => {
    await open(page, "/app/#/verify");
    await settled(page);
    await page.getByRole("radio", { name: "Pick a strategy" }).click();
    await page.getByRole("button").filter({ hasText: "Classic Carry" }).first().click();
    await expect(page.getByText(/Luck check/).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("practice positions", () => {
  test("Add says why when it cannot add, then adds an ETF to the list", async ({ page }) => {
    await open(page, "/app/#/markets/practice");
    await settled(page);
    const add = page.getByRole("button", { name: "Add practice position" });
    const problem = page.getByRole("alert").filter({ hasText: /./ });
    await page.getByRole("textbox", { name: "Pretend amount in dollars" }).fill("");
    await add.click();
    await expect(problem).toHaveText(/amount above zero/);
    // No coin prices in the suite's data: it says so instead of doing nothing.
    await page.getByRole("textbox", { name: "Pretend amount in dollars" }).fill("2500");
    await add.click();
    await expect(problem).toHaveText(/Coin prices have not loaded/);
    await page.getByRole("combobox", { name: "What" }).selectOption("etf");
    await page.getByRole("textbox", { name: "Ticker" }).fill("spy");
    await add.click();
    await expect(problem).toHaveText(/today's price/);
    await page.getByRole("textbox", { name: /Today's price/ }).fill("512.40");
    await add.click();
    await expect(problem).toHaveCount(0);
    await expect(page.getByText("Nothing yet.", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("main").getByText("SPY").first()).toBeVisible();
  });
});

test.describe("getting started", () => {
  test("the setup list opens from the ring at the top right and hides", async ({ page }) => {
    await open(page, "/app/#/");
    await settled(page);
    const ring = page.locator(".setup-btn");
    await ring.click();
    const list = page.getByRole("region", { name: "Getting started" });
    await expect(list).toBeVisible();
    await list.getByRole("button", { name: "Hide the setup list" }).click();
    await expect(ring).toHaveCount(0);
  });

  test("Add wallet opens a dialog that Escape closes", async ({ page }) => {
    await open(page, "/app/#/");
    await settled(page);
    await page.locator(".setup-btn").click();
    await page.getByRole("button", { name: "Add wallet" }).click();
    const dialog = page.getByRole("dialog", { name: /crypto wallet/ });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator(".setup-btn")).toBeFocused();
  });
});

test.describe("account settings", () => {
  test("a short new password is refused with a reason", async ({ page }) => {
    await open(page, "/app/#/settings/account");
    await settled(page);
    await page.getByRole("button", { name: "Change password" }).click();
    const pw = page.getByLabel(/new password/i).first();
    await pw.fill("short1");
    const save = page.getByRole("button", { name: "Save password" });
    await expect(save).toBeDisabled();
    await page.getByLabel("Confirm password", { exact: true }).fill("short1");
    await expect(page.getByText("Passwords match")).toBeVisible();
    await save.click();
    await expect(page.getByText(/at least 10 characters/i).last()).toBeVisible();
  });

  test("a new email that is not an email is refused", async ({ page }) => {
    await open(page, "/app/#/settings/account");
    await settled(page);
    await page.getByRole("button", { name: "Change email" }).click();
    await page.getByRole("textbox", { name: /new email|email/i }).last().fill("nope");
    await page.getByRole("button", { name: /send|save|change email|confirm/i }).last().click();
    await expect(page.getByText(/full email address|valid email/i).first()).toBeVisible();
  });

  test("setting up an authenticator shows the key, checks the code and can be cancelled", async ({ page }) => {
    await open(page, "/app/#/settings/account");
    await settled(page);
    await page.getByRole("button", { name: "Set up an authenticator app" }).click();
    await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Code" })).toBeFocused();
    await page.getByRole("textbox", { name: "Code" }).fill("12");
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /6.digit|code/i }).first()).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Set up an authenticator app" })).toBeVisible();
  });

  test("the brokerage switch turns on and off", async ({ page }) => {
    await open(page, "/app/#/settings/account");
    await settled(page);
    const sw = page.getByRole("switch", { name: "Notify me when brokerage linking is available" }).last();
    const before = await sw.isChecked();
    await sw.click();
    await expect(sw).toBeChecked({ checked: !before });
  });
});

test.describe("glossary in the app", () => {
  test("search narrows the words", async ({ page }) => {
    test.slow();
    await open(page, "/app/#/learn");
    await settled(page);
    const box = page.getByRole("searchbox", { name: "Search terms" });
    await box.fill("sharpe");
    await expect(page.getByRole("main").getByText("Sharpe ratio").first()).toBeVisible();
    await expect(page.getByRole("main").getByText("Anchoring", { exact: true })).toHaveCount(0);
  });
});
