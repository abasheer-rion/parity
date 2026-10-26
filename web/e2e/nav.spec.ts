// Getting around: the side menu, deep links that keep their state, Copy link, the back
// button, and the "not found" views for addresses that do not exist.
import { expect, open, settled, test } from "./fixtures";

test.describe("side menu", () => {
  test("Discover opens the strategies list and the address follows", async ({ page }, info) => {
    await open(page, "/app/#/");
    await settled(page);
    if (info.project.name === "phone") await page.getByRole("button", { name: /menu/i }).first().click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Discover" }).click();
    await expect(page).toHaveURL(/#\/strategies$/);
    await expect(page.getByRole("heading", { level: 1, name: "Discover strategies" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/#\/$/);
  });

  test("the Product and Research tabs switch sides", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "the side switch is inside the phone menu, covered on desktop");
    await open(page, "/app/#/");
    await page.getByRole("tablist", { name: "Side of Parity" }).getByRole("tab", { name: "Research" }).click();
    await expect(page).toHaveURL(/\/research\//);
    await expect(page.getByRole("tablist", { name: "Side of Parity" }).getByRole("tab", { name: "Research" })).toHaveAttribute("aria-selected", "true");
  });

  test("Trade's own menu moves between its views", async ({ page }) => {
    await open(page, "/trade/#/chart");
    await page.getByRole("navigation", { name: "Trade" }).getByRole("link", { name: "Portfolio" }).click();
    await expect(page).toHaveURL(/\/trade\/#\/portfolio$/);
    await page.getByRole("navigation", { name: "Trade" }).getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/trade\/#\/orders$/);
  });
});

test.describe("deep links", () => {
  test("a strategy search typed in goes into the link", async ({ page }) => {
    await open(page, "/app/#/strategies");
    await page.getByPlaceholder("Search strategies").fill("carry");
    await page.getByRole("tablist", { name: "Time range" }).getByRole("tab", { name: "1Y" }).click();
    await expect.poll(() => decodeURIComponent(new URL(page.url()).hash)).toMatch(/q=carry.*range=1Y|range=1Y.*q=carry/);
  });

  test("a strategies link reopens with its search and range", async ({ page }) => {
    await open(page, "/app/#/strategies?q=carry&range=5Y");
    await expect(page.getByPlaceholder("Search strategies")).toHaveValue("carry");
    await expect(page.getByRole("tablist", { name: "Time range" }).getByRole("tab", { selected: true })).toHaveText(/5Y/);
  });

  test("a catalog link reopens with its filters", async ({ page }) => {
    await open(page, "/research/#/catalog?q=carry&sort=year");
    await expect(page.getByPlaceholder("Search name, tags, authors")).toHaveValue("carry");
    await expect(page.getByLabel("Sort")).toHaveValue("year");
  });

  test("an academy lesson link opens that lesson", async ({ page }) => {
    await open(page, "/academy/#/reading-a-backtest/sharpe");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Sharpe/);
  });

  test("a Workbench link opens its view", async ({ page }) => {
    await open(page, "/lab/#/compare");
    await expect(page.getByRole("heading", { level: 1, name: "Compare" })).toBeVisible();
  });
});

test.describe("copy link", () => {
  test.beforeEach(async ({ context }) => { await context.grantPermissions(["clipboard-read", "clipboard-write"]); });

  test("copies a link that reopens the same view", async ({ page }) => {
    await open(page, "/app/#/strategies?q=carry");
    await settled(page);
    await page.getByRole("button", { name: "Copy link to this view" }).click();
    await expect(page.getByText("Link copied. It opens this view as it is now.")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(decodeURIComponent(copied)).toContain("#/strategies?q=carry");
    await page.goto(new URL(copied).pathname + new URL(copied).hash);
    await expect(page.getByPlaceholder("Search strategies")).toHaveValue("carry");
  });

  test("Workbench's Copy link copies its address", async ({ page }) => {
    await open(page, "/lab/#/compare");
    await page.getByRole("button", { name: "Copy link" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("/lab/#/compare");
  });
});

test.describe("addresses that do not exist", () => {
  test.use({ expectConsole: [/status of 404/], allowHttp: [/^404 .*\/no-such-page-xyz\/$/] });

  test("an unknown public path answers 404 with the 404 page and a way home", async ({ page }) => {
    const res = await page.goto("/no-such-page-xyz/");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("This page does not exist")).toBeVisible();
    await expect(page.getByRole("link", { name: /home|front page|parity/i }).first()).toBeVisible();
  });

  test("a missing app path opens the app's not found view at that hash", async ({ page }) => {
    await page.goto("/app/no-such-page-xyz");
    await expect(page.locator("[data-not-found]")).toBeVisible();
    expect(new URL(page.url()).hash).toBe("#/no-such-page-xyz");
  });

  test("an unknown badge address says there is no record", async ({ page }) => {
    await page.goto("/v/no-such-badge");
    await expect(page.getByRole("heading", { name: "No record at this address" })).toBeVisible();
  });

  for (const app of ["app", "research", "sim", "trade", "academy", "lab"]) {
    test(`/${app}/ shows not found for an unknown hash, with Back and Home`, async ({ page }) => {
      await page.goto(`/${app}/#/no-such-page-xyz`);
      const view = page.locator("[data-not-found]");
      await expect(view).toBeVisible();
      await expect(view.getByRole("button", { name: "Back" })).toBeVisible();
      await expect(view.getByRole("link").first()).toBeVisible();
    });
  }
});
