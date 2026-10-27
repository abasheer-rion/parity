// Parity Terminal (/sim/): workspaces, the command line, panels (add, close, maximise,
// reset), the market monitor's linked selection, help, and the phone layout.
import type { Page } from "@playwright/test";
import { expect, open, settled, test } from "./fixtures";

async function ready(page: Page, path = "/sim/#/overview") {
  await open(page, path);
  await settled(page);
}

const panels = (page: Page) => page.locator("[data-panel]:visible");

test.describe("workspaces", () => {
  test("the workspace tabs switch and the address follows", async ({ page }) => {
    await ready(page);
    const tabs = page.getByRole("tablist", { name: "Workspaces" });
    await tabs.getByRole("tab", { name: /FX/ }).click();
    await expect(page).toHaveURL(/#\/fx$/);
    await expect(tabs.getByRole("tab", { name: /FX/ })).toHaveAttribute("aria-selected", "true");
    await page.goBack();
    await expect(tabs.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
  });

  test("the F keys switch workspaces", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "keyboard, desktop only");
    await ready(page);
    await page.keyboard.press("F5");
    await expect(page).toHaveURL(/#\/commodities$/);
    await page.keyboard.press("F2");
    await expect(page).toHaveURL(/#\/overview$/);
  });
});

test.describe("command line", () => {
  test("a series name opens its description", async ({ page }) => {
    await ready(page);
    const cmd = page.getByRole("combobox", { name: "Command" });
    await cmd.fill("BTC");
    await cmd.press("Enter");
    await expect(page.locator("[data-panel]").filter({ hasText: /Bitcoin/ }).first()).toBeVisible();
  });

  test("an unknown code says so in plain words", async ({ page }) => {
    await ready(page);
    const cmd = page.getByRole("combobox", { name: "Command" });
    await cmd.fill("QQQZZZ");
    await cmd.press("Enter");
    await expect(page.getByText(/Nothing called QQQZZZ/)).toBeVisible();
  });

  test("HELP lists the codes", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "HELP" }).click();
    await expect(page.locator("[data-panel]").filter({ hasText: /MON/ }).filter({ hasText: /HELP|Help/ }).first()).toBeVisible();
  });

  test("Ctrl or Cmd K puts the cursor in the command line", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "keyboard, desktop only");
    await ready(page);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("combobox", { name: "Command" })).toBeFocused();
  });
});

test.describe("panels", () => {
  test("a panel can be added and closed, and RESET brings the preset back", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "one panel at a time on the phone");
    await ready(page);
    const before = await panels(page).count();
    await page.getByRole("button", { name: "Add a panel" }).click();
    await expect(panels(page)).toHaveCount(before + 1);
    await page.getByRole("button", { name: "Close panel" }).first().click();
    await page.getByRole("button", { name: "Close panel" }).first().click();
    await expect(panels(page)).toHaveCount(before - 1);
    await page.getByRole("button", { name: "RESET" }).click();
    await expect(panels(page)).toHaveCount(before);
  });

  test("Maximise fills the workspace with one panel and gives the others back", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "one panel at a time on the phone");
    await ready(page);
    const before = await panels(page).count();
    test.skip(before < 2, "the preset has one panel");
    await page.getByRole("button", { name: "Maximise" }).first().click();
    await expect(panels(page)).toHaveCount(1);
    await page.getByRole("button", { name: /Restore|Maximise/ }).first().click();
    await expect(panels(page)).toHaveCount(before);
  });

  test("picking a row in the monitor follows into the linked panels", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "linked panels side by side, desktop only");
    await ready(page);
    await page.getByRole("button", { name: /^BTC / }).first().click();
    await expect(page.locator("[data-panel]").filter({ hasText: /Bitcoin|BTC/ }).nth(1)).toBeVisible();
  });

  test("the monitor's group picker narrows the rows", async ({ page }) => {
    await ready(page);
    const monitor = page.getByRole("region", { name: /Market monitor/ }).first();
    const group = monitor.getByRole("combobox", { name: "Group" });
    const rows = monitor.getByRole("row");
    const all = await rows.count();
    const value = await group.locator("option").nth(1).getAttribute("value");
    await group.selectOption(value!);
    await expect.poll(() => rows.count()).toBeLessThan(all);
  });
});

test.describe("phone", () => {
  test("the panel picker swaps the one panel on screen", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "phone layout");
    await ready(page);
    const pick = page.getByRole("combobox", { name: "Panel" });
    const options = pick.locator("option");
    test.skip((await options.count()) < 2, "one panel in this workspace");
    const second = await options.nth(1).getAttribute("value");
    await pick.selectOption(second!);
    await expect(pick).toHaveValue(second!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
});
