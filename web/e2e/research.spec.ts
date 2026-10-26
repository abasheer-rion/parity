// The research side (/research/), signed in: the catalog's search, filters and sort, an
// algorithm report and its print button, the bibliography search, and the side switch.
import type { Page } from "@playwright/test";
import { expect, open, settled, test } from "./fixtures";

async function ready(page: Page, path: string) {
  await open(page, path);
  await settled(page);
}

test.describe("catalog", () => {
  const count = (page: Page) => page.getByRole("main").getByRole("link").filter({ has: page.locator("[class]") });

  test("search narrows the algorithms and goes into the link", async ({ page }) => {
    await ready(page, "/research/#/catalog");
    const rows = page.getByRole("main").getByRole("table").getByRole("rowgroup").nth(1).getByRole("row");
    const list = (await rows.count()) ? rows : count(page);
    const all = await list.count();
    await page.getByRole("searchbox", { name: "Search name, tags, authors" }).fill("carry");
    await expect.poll(() => list.count()).toBeLessThan(all);
    await expect.poll(() => decodeURIComponent(new URL(page.url()).hash)).toContain("q=carry");
  });

  test("the family filter and sort go into the link", async ({ page }) => {
    await ready(page, "/research/#/catalog");
    await page.getByRole("combobox", { name: "Family" }).selectOption({ index: 1 });
    await page.getByRole("combobox", { name: "Sort" }).selectOption("year");
    await expect.poll(() => decodeURIComponent(new URL(page.url()).hash)).toMatch(/sort=year/);
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("year");
  });

  test("an algorithm opens its report", async ({ page }) => {
    await ready(page, "/research/#/catalog?q=G10%20currency%20carry");
    await page.getByRole("main").getByRole("link", { name: /G10 currency carry/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("G10 currency carry");
  });
});

test.describe("algorithm report", () => {
  test("Print or save as PDF opens the print dialog", async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { printed: number }).printed = 0; window.print = () => { (window as unknown as { printed: number }).printed++; }; });
    await ready(page, "/research/#/algo/fx-carry-g10");
    await page.getByRole("button", { name: "Print or save as PDF" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  });
});

test.describe("bibliography", () => {
  test("search narrows the sources", async ({ page }) => {
    test.slow();
    await ready(page, "/research/#/refs");
    const box = page.getByRole("searchbox", { name: /^Search \d+ sources/ });
    await box.fill("thinkorswim");
    await expect(page.getByRole("main").getByText(/thinkorswim/i).first()).toBeVisible();
    await box.fill("qqqzzzxxx");
    await expect(page.getByRole("main").getByText(/thinkorswim/i)).toHaveCount(0);
  });
});

test.describe("side switch", () => {
  test("Product goes back to the product side", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "the switch is inside the phone menu");
    await ready(page, "/research/#/");
    await page.getByRole("tablist", { name: "Side of Parity" }).getByRole("tab", { name: "Product" }).click();
    await expect(page).toHaveURL(/\/app\//);
  });
});
