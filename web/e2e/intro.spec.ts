// The first-run intro (DEC-0077) for a new account: the questions, the first Verify result,
// Home's next step, Escape, resuming a closed tab, never again once ended, and axe on every
// screen. Also the contextual empty states on Watchlist and Verify.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, open, settled, test } from "./fixtures";
import { USER } from "./supabase";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

async function axe(page: Page) {
  // Read colours once the screen has finished fading in.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const r = await new AxeBuilder({ page }).include(".intro").withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

const intro = (page: Page) => page.locator(".intro[role=dialog]");

test.describe("first-run intro", () => {
  test.use({ tours: true, intro: true });

  test("asks three questions, shows a real verdict, then lands on Home with one next step", async ({ page, db }) => {
    await open(page, "/app/#/");
    const dialog = intro(page);
    await expect(dialog.getByRole("heading", { name: "What brings you to Parity?" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "What brings you to Parity?" })).toBeFocused();
    await expect(dialog.getByRole("img", { name: "Screen 1 of 4" })).toBeVisible();
    await axe(page);
    await dialog.getByRole("button", { name: /Practise with a demo account/ }).click();

    await expect(dialog.getByRole("heading", { name: "How much have you traded?" })).toBeVisible();
    await axe(page);
    await dialog.getByRole("button", { name: /^Never/ }).click();

    await expect(dialog.getByRole("heading", { name: "Which markets do you follow?" })).toBeVisible();
    const fx = dialog.getByRole("button", { name: /^Currencies/ });
    await fx.click();
    await expect(fx).toHaveAttribute("aria-pressed", "true");
    await axe(page);
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(dialog.getByRole("heading", { name: /^Verify checked / })).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(/Holds up|Could be luck|Fragile|Does not hold up|Not enough data/);
    await expect(dialog.getByText("Tests passed")).toBeVisible();
    await expect(dialog.locator(".intro-chart svg")).toBeVisible();
    await axe(page);
    await page.screenshot({ path: test.info().outputPath("intro-result.png") });
    await dialog.getByRole("button", { name: "Go to Home" }).click();

    await expect(dialog).toBeHidden();
    // Trade first (the goal), then Academy (never traded): the card offers the first one.
    const next = page.getByRole("region", { name: "Place a demo trade" });
    await expect(next).toBeVisible();
    await expect(next.getByRole("link", { name: "Open Trade" })).toBeVisible();
    await expect(page.locator(".setup-btn").first()).toBeVisible();

    await expect.poll(() => db.rows("onboarding_state").find((r) => r.user_id === USER.id)).toMatchObject({ intro_status: "done", intro_goal: "trade", intro_level: "new", intro_markets: ["fx"] });

    await page.reload();
    await settled(page);
    await expect(page.locator(".intro")).toHaveCount(0);
  });

  test("Escape ends it, a closed tab comes back where it was, and it never opens again", async ({ page, db }) => {
    await open(page, "/app/#/");
    const dialog = intro(page);
    await dialog.getByRole("button", { name: /Read the research/ }).click();
    await expect(dialog.getByRole("heading", { name: "How much have you traded?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Skip question" }).click();
    await expect(dialog.getByRole("heading", { name: "Which markets do you follow?" })).toBeVisible();

    await page.reload();
    await expect(intro(page).getByRole("heading", { name: "Which markets do you follow?" })).toBeVisible();
    await intro(page).getByRole("button", { name: "Back" }).click();
    await expect(intro(page).getByRole("heading", { name: "How much have you traded?" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".intro")).toHaveCount(0);
    await expect.poll(() => db.rows("onboarding_state").find((r) => r.user_id === USER.id)).toMatchObject({ intro_status: "skipped", intro_goal: "research" });

    await page.reload();
    await settled(page);
    await expect(page.locator(".intro")).toHaveCount(0);
  });

  test("Tab stays inside, and the app behind it is inert", async ({ page }) => {
    await open(page, "/app/#/");
    const dialog = intro(page);
    await expect(dialog.getByRole("heading", { name: "What brings you to Parity?" })).toBeFocused();
    expect(await page.locator("#root").getAttribute("inert")).toBe("");
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest(".intro"))).toBe(true);
    }
    await dialog.getByRole("button", { name: "Skip intro" }).click();
    await expect(page.locator(".intro")).toHaveCount(0);
    expect(await page.locator("#root").getAttribute("inert")).toBeNull();
  });
});

test.describe("contextual empty states", () => {
  test("Watchlist says what to do and has one button to the strategies", async ({ page }) => {
    await open(page, "/app/#/watchlist");
    await settled(page);
    await expect(page.getByText("Nothing followed yet")).toBeVisible();
    await page.getByRole("link", { name: "Find a strategy to follow" }).click();
    await expect(page).toHaveURL(/#\/strategies/);
  });

  test("Verify's one button checks the example bot", async ({ page }) => {
    await open(page, "/app/#/verify");
    await settled(page);
    await expect(page.getByText("Nothing checked yet")).toBeVisible();
    await page.getByRole("button", { name: "Check the example bot" }).click();
    await expect(page.getByText("Nothing checked yet")).toBeHidden();
    await expect(page).toHaveURL(/mode=describe/);
  });
});
