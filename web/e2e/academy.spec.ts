// Parity Academy (/academy/): the library and its level filter, a lesson from start to the
// quick check, word explanations, the picture steps, progress, settings and the keys.
import type { Page } from "@playwright/test";
import { expect, open, settled, test } from "./fixtures";

async function ready(page: Page, path = "/academy/#/") {
  await open(page, path);
  await settled(page);
}

const LESSON = "/academy/#/reading-a-backtest/return";

test.describe("library", () => {
  test("the level filter narrows the courses", async ({ page }) => {
    await ready(page);
    const courses = page.getByRole("main").getByRole("heading", { level: 3 });
    const all = await courses.count();
    await page.getByRole("radiogroup", { name: "Level" }).getByRole("radio", { name: "Start here" }).click();
    await expect.poll(() => courses.count()).toBeLessThan(all);
    await expect(courses.first()).toHaveText("Reading a backtest");
    await page.getByRole("radiogroup", { name: "Level" }).getByRole("radio", { name: "All" }).click();
    await expect(courses).toHaveCount(all);
  });

  test("Start the first lesson opens it", async ({ page }) => {
    await ready(page);
    await page.getByRole("link", { name: "Start the first lesson" }).click();
    await expect(page).toHaveURL(/#\/reading-a-backtest\/return$/);
    await expect(page.getByRole("heading", { level: 1, name: "Return and compounding" })).toBeVisible();
  });

  test("a course page lists its lessons", async ({ page }) => {
    await ready(page);
    await page.getByRole("link", { name: "Reading a backtest", exact: true }).click();
    await expect(page).toHaveURL(/#\/reading-a-backtest$/);
    await expect(page.getByRole("link", { name: /Return and compounding/ }).first()).toBeVisible();
  });
});

test.describe("lesson", () => {
  test("the quick check waits for every answer, then marks them", async ({ page }) => {
    await ready(page, LESSON);
    const check = page.getByRole("button", { name: "Check my answers" });
    await expect(check).toBeDisabled();
    await page.getByRole("radio", { name: "The steady yearly growth rate that gets from the start value to the end value" }).check();
    await expect(check).toBeDisabled();
    await page.getByRole("radio", { name: "Because of rounding" }).check();
    await expect(check).toBeDisabled();
    await page.getByRole("radio", { name: "About 3 times" }).check();
    await expect(check).toBeEnabled();
    await check.click();
    await expect(page.getByRole("region", { name: "Quick check" }).getByText(/1 of 3|not quite|try again|correct/i).first()).toBeVisible();
  });

  test("all answers right counts the lesson as done", async ({ page }) => {
    await ready(page, LESSON);
    await page.getByRole("radio", { name: "The steady yearly growth rate that gets from the start value to the end value" }).check();
    await page.getByRole("radio", { name: "Because bumpier returns compound to less" }).check();
    await page.getByRole("radio", { name: "About 7 times" }).check();
    await page.getByRole("button", { name: "Check my answers" }).click();
    await expect(page.getByRole("region", { name: "Quick check" }).getByText(/3 of 3|all right|well done|correct/i).first()).toBeVisible();
    await page.goto("/academy/#/progress");
    await expect(page.getByRole("main").getByText(/1 of 50/).first()).toBeVisible();
  });

  test("a word button explains the word and Escape closes it", async ({ page }) => {
    await ready(page, LESSON);
    await page.getByRole("button", { name: "CAGR", exact: true }).click();
    const tip = page.getByRole("dialog").or(page.getByRole("tooltip")).first();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/year/i);
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
  });

  test("the picture steps move with Next and Back", async ({ page }) => {
    await ready(page, "/academy/#/how-markets-move/risk-premia");
    const steps = page.getByRole("group", { name: /Picture steps/ });
    await expect(steps.getByRole("button", { name: "Back" })).toBeDisabled();
    await steps.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/^Step 2 of 3/).first()).toBeVisible();
    await expect(steps.getByRole("button", { name: "Back" })).toBeEnabled();
    await steps.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText(/^Step 1 of 3/).first()).toBeVisible();
  });

  // The lesson film (DEC-0085). These tests run with reduced motion, so it waits for a press
  // and then plays the rendered MP4 with captions.
  test("the lesson film waits for a press, then plays the rendered film", async ({ page }) => {
    await ready(page, LESSON);
    const film = page.getByRole("figure", { name: /Return and compounding: lesson film/ });
    await expect(film.getByText(/waits for you/)).toBeVisible();
    await film.getByRole("button", { name: /^Play the film/ }).click();
    const video = film.locator("video");
    await expect(video).toHaveAttribute("src", /\/content\/academy\/reading-a-backtest-return\.mp4$/);
    await expect(video.locator("track[kind=captions]")).toHaveCount(1);
  });

  test("the film's Motion choice and transcript", async ({ page }) => {
    await ready(page, LESSON);
    const film = page.getByRole("figure", { name: /lesson film/ });
    await film.getByRole("button", { name: "Transcript" }).click();
    await expect(film.getByRole("button", { name: /Put \$100 away at three steady rates/ })).toBeVisible();
    await film.getByRole("radiogroup", { name: "Motion" }).getByRole("radio", { name: "Full" }).click();
    await expect(film.getByRole("button", { name: /^(Play|Pause)$/ })).toBeVisible();
    await expect(film.getByRole("slider", { name: "Position in the film" })).toBeVisible();
  });

  test("Next goes to the next lesson", async ({ page }) => {
    await ready(page, LESSON);
    await page.getByRole("navigation", { name: "Lessons" }).getByRole("link", { name: /^Next/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Bumpiness/);
  });
});

test.describe("settings and keys", () => {
  test("large text sticks after a reload", async ({ page }) => {
    await ready(page, "/academy/#/settings");
    await page.getByRole("radiogroup", { name: "Text size" }).getByRole("radio", { name: "Large" }).click();
    await page.reload();
    await expect(page.getByRole("radiogroup", { name: "Text size" }).getByRole("radio", { name: "Large" })).toBeChecked();
  });

  test("Shift and a number switch views", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "keyboard, desktop only");
    await ready(page);
    await page.keyboard.press("Shift+Digit3");
    await expect(page).toHaveURL(/#\/progress$/);
    await page.keyboard.press("Shift+Digit4");
    await expect(page).toHaveURL(/#\/settings$/);
  });

  test("the menu moves between Library, Progress and Settings", async ({ page }) => {
    await ready(page);
    const nav = page.getByRole("navigation", { name: "Academy" });
    await nav.getByRole("link", { name: "Progress" }).click();
    await expect(page).toHaveURL(/#\/progress$/);
    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  });
});
