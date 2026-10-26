// Parity Trade (/trade/), signed in with the demo account kept in the Supabase stand-in:
// placing and cancelling orders, the order ticket's checks, the chart's controls, the
// watchlist, alerts, the screener, the keys dialog and the phone layout.
import type { Page } from "@playwright/test";
import { expect, open, settled, test } from "./fixtures";

const desktopOnly = (name: string) => test.skip(name === "phone", "desktop layout; the phone has its own tests below");

async function ready(page: Page, path = "/trade/#/chart") {
  await open(page, path);
  await settled(page);
}

test.describe("order ticket", () => {
  test("a market buy fills, shows in positions and takes the cash", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page);
    const ticket = page.getByRole("form", { name: "Order ticket" });
    await ticket.getByRole("spinbutton", { name: "Qty" }).fill("2");
    await ticket.getByRole("button", { name: /^Buy 2 US market/ }).click();
    const dock = page.getByRole("region", { name: "Account dock" });
    await expect(dock.getByRole("tab", { name: /Positions 1/ })).toBeVisible();
    await expect(dock.getByRole("table", { name: "Positions" }).getByRole("row").filter({ hasText: "US market" })).toBeVisible();
    await expect(ticket.getByRole("definition").filter({ hasText: /^\$9\d,\d{3}\.\d\d$/ })).toBeVisible();
  });

  test("a quantity of zero is refused with a reason", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page);
    const ticket = page.getByRole("form", { name: "Order ticket" });
    await ticket.getByRole("spinbutton", { name: "Qty" }).fill("0");
    const submit = ticket.getByRole("button", { name: /^(Buy|Sell) / });
    if (await submit.isEnabled()) await submit.click();
    await expect(page.getByRole("region", { name: "Account dock" }).getByRole("tab", { name: /Positions 0/ })).toBeVisible();
    await expect(ticket.getByText(/quantity|more than 0|at least/i).first()).toBeVisible();
  });

  test("a limit order waits in Orders and can be cancelled", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page);
    const ticket = page.getByRole("form", { name: "Order ticket" });
    await ticket.getByRole("combobox", { name: "Type" }).selectOption({ label: "Limit" });
    const price = ticket.getByRole("spinbutton", { name: /Limit/ });
    await price.fill("500");
    await ticket.getByRole("button", { name: /^Buy 1 US market/ }).click();
    const dock = page.getByRole("region", { name: "Account dock" });
    await dock.getByRole("tab", { name: /Orders 1/ }).click();
    await dock.getByRole("button", { name: /cancel/i }).first().click();
    await expect(dock.getByRole("tab", { name: /Orders 0/ })).toBeVisible();
  });
});

test.describe("chart", () => {
  test("every chart control fits in the top bar, none cut off", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page);
    const fit = await page.getByRole("toolbar", { name: "Chart" }).evaluate((e) => e.scrollWidth - e.clientWidth);
    expect(fit, "the chart controls fit their bar").toBeLessThanOrEqual(1);
    await expect(page.getByRole("radio", { name: "4 charts" })).toBeInViewport({ ratio: 1 });
  });

  test("timeframe, chart type and compare change the chart", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page);
    const bar = page.getByRole("toolbar", { name: "Chart" });
    await bar.getByRole("radiogroup", { name: "Timeframe" }).getByRole("radio", { name: "1W" }).click();
    await expect(bar.getByRole("radio", { name: "1W" })).toBeChecked();
    await bar.getByRole("combobox", { name: "Chart type" }).selectOption({ label: "Line" });
    await expect(bar.getByRole("combobox", { name: "Chart type" })).toHaveValue(/line/i);
    await bar.getByRole("combobox", { name: "Compare with" }).selectOption({ index: 1 });
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("Indicators opens a panel that Escape closes", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page);
    await page.getByRole("button", { name: /^Indicators/ }).click();
    const panel = page.getByRole("dialog").or(page.getByRole("menu")).first();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });

  test("Search opens the command palette, which Escape closes", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page);
    await page.getByRole("button", { name: /^Search/ }).click();
    const palette = page.getByRole("dialog").first();
    await expect(palette).toBeVisible();
    // Type into the palette's own box (typing before it has focus would go to the page).
    await palette.locator("input").first().fill("BTC");
    await expect(palette.getByText(/BTC/).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });

  test("? opens the keys and Escape closes them", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page);
    await page.locator("main").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press("Shift+Slash");
    const keys = page.getByRole("dialog", { name: /keys|shortcuts/i });
    await expect(keys).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(keys).toBeHidden();
  });
});

test.describe("views", () => {
  test("Shift and a number switch views, as the key list says", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page);
    await page.keyboard.press("Shift+Digit5");
    await expect(page).toHaveURL(/#\/portfolio$/);
    await page.keyboard.press("Shift+Digit9");
    await expect(page).toHaveURL(/#\/settings$/);
  });

  test("a symbol can be removed from a watchlist and added back", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page, "/trade/#/watchlists");
    await page.getByRole("button", { name: "Remove WTI" }).click();
    await expect(page.getByRole("button", { name: "Remove WTI" })).toHaveCount(0);
    const add = page.getByRole("combobox", { name: "Add symbol" });
    await add.selectOption((await add.locator("option", { hasText: "WTI" }).first().getAttribute("value"))!);
    await expect(page.getByRole("button", { name: "Remove WTI" })).toBeVisible();
  });

  test("a new alert can be made and shows in the list", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page, "/trade/#/alerts");
    await page.getByRole("button", { name: "New alert" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "New alert" }).click();
    await dialog.getByRole("spinbutton", { name: "Price" }).fill("800");
    await dialog.getByRole("button", { name: "Set alert" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("No alerts")).toHaveCount(0);
    await expect(page.getByRole("main").getByText("US market").first()).toBeVisible();
  });

  test("the screener's class buttons narrow the list", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page, "/trade/#/screener");
    const rows = page.getByRole("main").getByRole("table").getByRole("rowgroup").nth(1).getByRole("row");
    const all = await rows.count();
    await page.getByRole("button", { name: "Crypto", exact: true }).click();
    await expect.poll(() => rows.count()).toBeLessThan(all);
    await expect(rows.first()).toContainText("BTC");
  });

  test("settings switches turn on and off", async ({ page }, info) => {
    desktopOnly(info.project.name);
    await ready(page, "/trade/#/settings");
    const sw = page.getByRole("switch", { name: "Confirm orders" });
    const before = await sw.isChecked();
    await sw.click();
    await expect(sw).toBeChecked({ checked: !before });
    await page.reload();
    await expect(page.getByRole("switch", { name: "Confirm orders" })).toBeChecked({ checked: !before });
  });
});

test.describe("phone", () => {
  test("the top bar's timeframe buttons all fit on screen", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "phone layout");
    await ready(page);
    // The bar hides what does not fit, so nothing may stick out past its own edge, and the
    // top bar keeps room to spare for fonts that draw a little wider.
    const bar = page.getByRole("toolbar", { name: "Chart" });
    expect(await bar.evaluate((e) => e.scrollWidth - e.clientWidth), "nothing cut off").toBeLessThanOrEqual(0);
    const gap = await page.locator(".tb-gap").evaluate((e) => e.getBoundingClientRect().width);
    expect(gap, "room to spare in the top bar").toBeGreaterThanOrEqual(12);
  });

  test("the bottom bar switches between chart, ticket and positions", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "phone layout");
    await ready(page);
    const bar = page.getByRole("navigation", { name: "Trade" });
    await bar.getByRole("button", { name: "Trade" }).click();
    await expect(bar.getByRole("button", { name: "Trade" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("form", { name: "Order ticket" })).toBeVisible();
    await bar.getByRole("button", { name: "Positions" }).click();
    await expect(page.getByRole("table", { name: "Positions" })).toBeVisible();
    await bar.getByRole("button", { name: "Chart" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("a market buy from the phone ticket shows in positions", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "phone layout");
    await ready(page);
    const bar = page.getByRole("navigation", { name: "Trade" });
    await bar.getByRole("button", { name: "Trade" }).click();
    await page.getByRole("form", { name: "Order ticket" }).getByRole("button", { name: /^Buy 1 US market/ }).click();
    await bar.getByRole("button", { name: "Positions" }).click();
    await expect(page.getByRole("table", { name: "Positions" }).getByRole("row").filter({ hasText: "US market" })).toBeVisible();
  });

  test("More lists the other views and opens them", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "phone layout");
    await ready(page);
    await page.getByRole("navigation", { name: "Trade" }).getByRole("button", { name: "More" }).click();
    const more = page.getByRole("navigation", { name: "More" });
    await expect(more.getByRole("button")).toHaveCount(8);
    await more.getByRole("button", { name: "Orders" }).click();
    await expect(page).toHaveURL(/#\/orders$/);
    await expect(page.getByRole("tab", { name: /Open 0/ })).toBeVisible();
  });
});
