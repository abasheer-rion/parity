// Parity Workbench (/lab/): every view's controls, the keys (Shift and a number, ?, L),
// settings that stick, and the phone tab bar.
import type { Page } from "@playwright/test";
import { expect, open, settled, test } from "./fixtures";

async function ready(page: Page, path: string) {
  await open(page, path);
  await settled(page);
}

test.describe("views", () => {
  test("Try: picking a strategy selects it and only it", async ({ page }) => {
    await ready(page, "/lab/#/try");
    await page.getByRole("button", { name: /^Stock trend, 10-month/ }).click();
    await expect(page.getByRole("button", { name: /^Stock trend, 10-month/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Currency carry/ })).toHaveAttribute("aria-pressed", "false");
  });

  test("Try: the find box narrows the strategies", async ({ page }) => {
    await ready(page, "/lab/#/try");
    await page.getByRole("searchbox", { name: "Find a strategy" }).fill("rsi");
    await expect(page.getByRole("button", { name: /^Currency carry/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /RSI/ }).first()).toBeVisible();
  });

  test("Compare: the three views switch", async ({ page }) => {
    await ready(page, "/lab/#/compare");
    for (const name of ["Crises", "Correlation", "League table"]) {
      await page.getByRole("radio", { name }).click();
      await expect(page.getByRole("radio", { name })).toBeChecked();
    }
  });

  test("Search: the filters narrow the results", async ({ page }) => {
    await ready(page, "/lab/#/search");
    const rows = page.getByRole("main").getByRole("table").getByRole("rowgroup").nth(1).getByRole("row");
    const all = await rows.count();
    test.skip(all < 2, "the search fixture has one row");
    await page.getByRole("checkbox", { name: "Beats the market" }).check();
    await expect.poll(() => rows.count()).toBeLessThanOrEqual(all);
    await page.getByRole("searchbox", { name: "Find a strategy" }).fill("qqqzzz");
    await expect.poll(() => rows.count()).toBeLessThan(all);
  });

  test("Edge Lab: answers change the idea's check", async ({ page }) => {
    await ready(page, "/lab/#/edges");
    await page.getByRole("textbox", { name: "Your idea in one line" }).fill("Buy oil after three down days");
    // The answers are styled labels over hidden radio buttons, so click the words.
    await page.getByText("I lost count", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "I lost count" })).toBeChecked();
    await page.getByRole("radio", { name: "Seven lessons" }).click();
    await expect(page.getByRole("radio", { name: "Seven lessons" })).toBeChecked();
    await page.getByRole("radio", { name: "Check an idea" }).click();
    await expect(page.getByRole("textbox", { name: "Your idea in one line" })).toHaveValue("Buy oil after three down days");
  });

  test("Settings: comfortable spacing sticks after a reload", async ({ page }) => {
    await ready(page, "/lab/#/settings");
    await page.getByRole("radio", { name: "Comfortable" }).check();
    await expect(page.locator(".plb")).toHaveAttribute("data-density", "comfortable");
    await page.reload();
    await expect(page.getByRole("radio", { name: "Comfortable" })).toBeChecked();
  });
});

test.describe("keys", () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name === "phone", "keyboard, desktop only"); });

  test("Shift and 1 to 7 reach every view, Settings included", async ({ page }) => {
    await ready(page, "/lab/#/try");
    await page.keyboard.press("Shift+Digit6");
    await expect(page).toHaveURL(/#\/live$/);
    await page.keyboard.press("Shift+Digit7");
    await expect(page).toHaveURL(/#\/settings$/);
    await page.keyboard.press("Shift+Digit3");
    await expect(page).toHaveURL(/#\/compare/);
  });

  test("? lists the keys, Escape closes the list", async ({ page }) => {
    await ready(page, "/lab/#/compare");
    await page.keyboard.press("Shift+Slash");
    const dialog = page.getByRole("dialog", { name: "Keys" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Shift+1 to 7");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("phone tab bar", () => {
  test("all seven views fit on one row", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "phone layout");
    await ready(page, "/lab/#/compare");
    const tabs = page.getByRole("navigation", { name: "Workbench" }).getByRole("link");
    await expect(tabs).toHaveCount(7);
    const boxes = await tabs.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), bottom: r.bottom, right: r.right })));
    expect(new Set(boxes.map((b) => b.top)).size, "one row").toBe(1);
    const vh = page.viewportSize()!.height;
    for (const b of boxes) { expect(b.bottom).toBeLessThanOrEqual(vh + 1); expect(b.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1); }
    await tabs.filter({ hasText: "Settings" }).click();
    await expect(page).toHaveURL(/#\/settings$/);
  });
});
