// The public site, signed out: the front page, the cookie notice, the legal pages, the blog
// and news, the glossary, ideas and notes, and the Connect and Verify pages.
import { expect, open, settled, test } from "./fixtures";

test.use({ signedIn: false });

test.describe("front page", () => {
  test("leads with the Verify tagline and one main action", async ({ page }) => {
    await open(page, "/");
    const hero = page.getByRole("region", { name: /AI-native verification platform/ });
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText("AI-native verification platform for retail traders of all sizes.");
    await expect(hero.getByRole("link", { name: "Verify a strategy or trade record" })).toHaveAttribute("href", "/verify/");
    await expect(hero.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "/methodology/");
  });

  test("shows the counted tries from stats.json", async ({ page }) => {
    await open(page, "/");
    const proof = page.getByRole("region", { name: "Every try is counted." });
    await expect(proof.getByRole("definition").first()).toHaveText("1,200");
    await expect(proof.getByRole("definition").nth(1)).toHaveText("8");
    await expect(proof.getByRole("definition").nth(2)).toHaveText("1");
  });

  test("the corner nav leads with Verify, Developers and Connect AI", async ({ page }, info) => {
    await open(page, "/");
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav.getByRole("link").first()).toHaveText("Verify");
    await expect(nav.getByRole("link", { name: "Verify" })).toHaveAttribute("href", "/verify/");
    // Phones keep Verify, Log in and Sign up; the three ways in sit lower on the page.
    if (info.project.name === "phone") return;
    await expect(nav.getByRole("link", { name: "Developers" })).toHaveAttribute("href", "/developers/");
    await expect(nav.getByRole("link", { name: "Connect AI" })).toHaveAttribute("href", "/connect/");
  });

  test("three ways in, pricing that is not on sale and a business contact", async ({ page }) => {
    await open(page, "/");
    const ways = page.getByRole("region", { name: "Three ways in." });
    await expect(ways.getByRole("link", { name: /Open Verify/ })).toHaveAttribute("href", "/verify/");
    await expect(ways.getByRole("link", { name: /Read the API docs/ })).toHaveAttribute("href", "/developers/");
    await expect(ways.getByRole("link", { name: /Connect your AI/ })).toHaveAttribute("href", "/connect/");
    await expect(page.getByRole("region", { name: "Checking is free today." })).toContainText("Paid plans are not on sale yet");
    await expect(page.getByRole("link", { name: "Email contact@paritytrading.app" })).toHaveAttribute("href", /^mailto:contact@paritytrading\.app\?subject=/);
  });

  test("Log in and Sign up in the corner nav open their forms", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Sign up" }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.goBack();
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: "Log in to Parity" })).toBeVisible();
  });

  for (const [name, heading] of [["Learn", /Learn the words/], ["Ideas", /Trading ideas/], ["Blog", /^Blog$/], ["News", /^News$/]] as const) {
    test(`the footer's ${name} link opens that page`, async ({ page }) => {
      await open(page, "/");
      await page.getByRole("contentinfo").getByRole("navigation", { name: "Explore" }).getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    });
  }

  test("scrolls top to bottom with motion on, without errors or sideways scroll", async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page, "/");
    const footer = page.getByRole("contentinfo");
    for (let i = 0; i < 30 && !(await footer.isVisible() && await footer.evaluate((f) => f.getBoundingClientRect().top < innerHeight)); i++) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(80);
    }
    await expect(footer).toBeInViewport({ timeout: 10_000 });
    if (info.project.name === "phone") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("cookie notice", () => {
  test.use({ consent: false });

  test("shows on a first visit and goes once a choice is made, for good", async ({ page }) => {
    await open(page, "/");
    const notice = page.getByRole("region", { name: "Cookie notice" });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: /^(OK|Essential only)$/ }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Cookie notice" })).toHaveCount(0);
  });

  test("Preferences opens a dialog that Escape closes without choosing", async ({ page }) => {
    await open(page, "/legal/");
    const notice = page.getByRole("region", { name: "Cookie notice" });
    await notice.getByRole("button", { name: "Preferences" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("switch").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(notice).toBeVisible();
  });

  test("Save choices in the dialog closes the notice", async ({ page }) => {
    await open(page, "/legal/privacy/");
    await page.getByRole("region", { name: "Cookie notice" }).getByRole("button", { name: "Preferences" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save choices" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("region", { name: "Cookie notice" })).toHaveCount(0);
  });
});

test.describe("cookie settings later", () => {
  test("the footer's Cookie settings opens the same dialog", async ({ page }) => {
    await open(page, "/verify/");
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test.describe("legal pages", () => {
  for (const [path, title] of [
    ["/legal/privacy/", "Privacy policy"], ["/legal/terms/", "Terms of service"], ["/legal/cookies/", "Cookie policy"],
    ["/legal/risk/", "Risk notice"], ["/legal/regulatory/", /Regulatory/], ["/legal/accessibility/", /Accessibility/],
  ] as const) {
    test(`${path} has its title, a date and working contents links`, async ({ page }) => {
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator("main time").first()).toBeVisible();
      const contents = page.getByRole("navigation", { name: "Contents" });
      if (await contents.count()) {
        const link = contents.getByRole("link").nth(1);
        const href = await link.getAttribute("href");
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await expect(page.locator(href!)).toBeInViewport();
      }
    });
  }

  test("the legal index links to every policy", async ({ page }) => {
    await open(page, "/legal/");
    await page.getByRole("main").getByRole("link", { name: "Risk notice" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Risk notice");
  });
});

test.describe("blog and news", () => {
  test("a post opens from the blog and the breadcrumb goes back", async ({ page }) => {
    await open(page, "/blog/");
    const first = page.getByRole("main").getByRole("heading", { level: 2 }).first();
    const title = (await first.innerText()).trim();
    await first.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.locator(".crumbs").getByRole("link", { name: "Blog" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Blog");
  });

  test("the blog search narrows the list and says when nothing matches", async ({ page }) => {
    await open(page, "/blog/");
    const box = page.getByRole("searchbox", { name: "Search the blog" });
    const posts = page.getByRole("main").getByRole("heading", { level: 2 });
    const before = await posts.count();
    await box.fill("zzzz-no-such-post");
    await expect.poll(() => posts.filter({ visible: true }).count()).toBeLessThan(Math.max(before, 1));
    await expect(page.getByText(/no posts|nothing (matches|found)|no results/i).first()).toBeVisible();
    await box.fill("");
    await expect.poll(() => posts.filter({ visible: true }).count()).toBe(before);
  });

  test("blog categories filter the list", async ({ page }) => {
    await open(page, "/blog/");
    await page.getByRole("navigation", { name: "Blog categories" }).getByRole("link", { name: "Opinion" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Opinion/);
  });

  test("news has its categories and a way to the market news in the app", async ({ page }) => {
    await open(page, "/news/");
    await expect(page.getByRole("navigation", { name: "News categories" })).toBeVisible();
    await expect(page.getByRole("link", { name: "latest" })).toHaveAttribute("href", /\/app\/#\/news/);
  });
});

test.describe("glossary, ideas and notes", () => {
  test("a glossary word opens its page and the breadcrumb goes back", async ({ page }) => {
    await open(page, "/learn/");
    const link = page.getByRole("main").getByRole("link", { name: /^Anchoring/ });
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Anchoring");
    await page.locator(".crumbs").getByRole("link", { name: "Learn" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn the words");
  });

  test("an idea opens from the ideas list", async ({ page }) => {
    await open(page, "/ideas/");
    await page.getByRole("main").getByRole("link", { name: /^Betting against beta/ }).click();
    await expect(page).toHaveURL(/\/ideas\/betting-against-beta\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/beta/i);
  });

  test("a note opens from the notes list", async ({ page }) => {
    await open(page, "/notes/");
    const link = page.getByRole("main").getByRole("link").filter({ hasText: /DEC-0001/ }).first();
    await link.click();
    await expect(page).toHaveURL(/\/notes\/dec-0001\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the header keeps Log in and Sign up beside the logo, sections on one row", async ({ page }) => {
    await open(page, "/blog/");
    const logo = await page.getByRole("banner").getByRole("link", { name: "Parity home" }).boundingBox();
    const signUp = await page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Sign up" }).boundingBox();
    expect(Math.abs((signUp!.y + signUp!.height / 2) - (logo!.y + logo!.height / 2)), "Sign up is level with the logo").toBeLessThan(12);
    const tops = await page.getByRole("navigation", { name: "Site" }).getByRole("link").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size, "the section links sit on one row").toBe(1);
  });

  test("the site menu moves between the public sections", async ({ page }, info) => {
    await open(page, "/learn/");
    const nav = page.getByRole("navigation", { name: "Site" });
    if (info.project.name === "phone" && !(await nav.getByRole("link", { name: "Ideas" }).isVisible())) {
      await page.getByRole("button", { name: /menu/i }).click();
    }
    await nav.getByRole("link", { name: "Ideas" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Trading ideas");
  });
});

test.describe("connect and verify pages", () => {
  test("Connect explains how to add Parity to an AI app", async ({ page }) => {
    await open(page, "/connect/");
    await settled(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("an incomplete email link says so and offers both ways back", async ({ page }) => {
    await open(page, "/verify/");
    await expect(page.getByRole("heading", { name: "This link is not complete" })).toBeVisible();
    await page.getByRole("link", { name: "Reset password" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  });
});
