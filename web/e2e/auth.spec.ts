// Signing in, out and back, against the Supabase stand-in (e2e/supabase.ts): the sign-in
// wall keeps the exact page, the forms check what is typed, a wrong password says so in
// plain words, and signing in lands where the person was going.
import { expect, open, settled, test } from "./fixtures";

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("an app deep link goes to log in and keeps the page", async ({ page }) => {
    await page.goto("/app/#/strategy/fx_carry");
    await expect(page).toHaveURL(/\/login\/\?next=%2Fapp%2F#\/strategy\/fx_carry$/);
    await expect(page.getByRole("heading", { name: "Log in to Parity" })).toBeVisible();
  });

  for (const app of ["research", "sim", "trade", "academy", "lab"]) {
    test(`/${app}/ asks to log in`, async ({ page }) => {
      await page.goto(`/${app}/`);
      await expect(page).toHaveURL(new RegExp(`/login/\\?next=%2F${app}%2F`));
    });
  }

  test("log in with a password lands on the page you asked for", async ({ page, context }) => {
    await page.goto("/app/#/strategy/fx_carry");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("correct-horse-battery");
    // The stand-in answers like Supabase; the session cookie is written by the page itself.
    await page.getByRole("button", { name: /^Log in$/ }).click();
    await expect(page).toHaveURL(/\/app\/#\/strategy\/fx_carry$/, { timeout: 15_000 });
    expect((await context.cookies()).some((c) => c.name.startsWith("sb-ttqvpxvctnomfbeoqbbs-auth-token"))).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test.describe("wrong password", () => {
    test.use({ expectConsole: [/status of 400/], allowHttp: [/^400 .*\/auth\/v1\/token/] });
    test("says so in plain words and keeps the email", async ({ page }) => {
      await open(page, "/login/");
      await page.getByRole("textbox", { name: "Email" }).fill("e2e@example.com");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("Password", { exact: true }).fill("wrong-password");
      await page.getByRole("button", { name: /^Log in$/ }).click();
      await expect(page.getByRole("alert").filter({ hasText: /./ }).first()).toContainText(/password/i);
      await expect(page).toHaveURL(/\/login\//);
    });
  });

  test("an email that is not an email is caught before sending", async ({ page }) => {
    await open(page, "/login/");
    await page.getByRole("textbox", { name: "Email" }).fill("not-an-email");
    await page.getByRole("button", { name: "Continue" }).click();
    const email = page.getByRole("textbox", { name: "Email" });
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Enter a full email address, like name@example.com.")).toBeVisible();
    await expect(email).toHaveAccessibleDescription(/full email address/);
    await expect(page).toHaveURL(/\/login\/$/);
  });

  test("sign up asks for a password after the email", async ({ page }) => {
    await open(page, "/signup/");
    await page.getByRole("textbox", { name: "Email" }).fill("new@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test("sign up checks the password as you type and ends on check your email", async ({ page }) => {
    await open(page, "/signup/");
    await page.getByRole("textbox", { name: "Email" }).fill("new@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    const pw = page.getByLabel("Choose a password", { exact: true });
    const again = page.getByLabel("Confirm password", { exact: true });
    await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
    await pw.fill("short1");
    await again.fill("short1");
    await page.getByRole("button", { name: /create|sign up|continue/i }).last().click();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await expect(pw).toHaveAttribute("aria-invalid", "true");
    await pw.fill("onlyletterslong");
    await again.fill("onlyletterslong");
    await page.getByRole("button", { name: /create|sign up|continue/i }).last().click();
    await expect(page.getByText("Use both letters and numbers.")).toBeVisible();
    await pw.fill("letters-and-42-numbers");
    await again.fill("letters-and-42-numbers-x");
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
    await again.fill("letters-and-42-numbers");
    await expect(page.getByText("Passwords match")).toBeVisible();
    await page.getByRole("button", { name: /create|sign up|continue/i }).last().click();
    await expect(page.getByText("Please agree to the terms and the privacy policy to continue.")).toBeVisible();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /create|sign up|continue/i }).last().click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText("new@example.com")).toBeVisible();
  });

  test("Show password shows it and Hide hides it again", async ({ page }) => {
    await open(page, "/login/");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    const pw = page.getByLabel("Password", { exact: true });
    await pw.fill("secret-123456");
    await expect(pw).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(pw).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(pw).toHaveAttribute("type", "password");
  });

  test("Change on the password step goes back to the email and keeps it", async ({ page }) => {
    await open(page, "/login/");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Change email, now e2e@example.com" }).click();
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue("e2e@example.com");
  });

  test("reset with no email asks for one", async ({ page }) => {
    await open(page, "/reset/");
    await page.getByRole("button", { name: "Send reset email" }).click();
    await expect(page.getByText("Enter your email.")).toBeVisible();
  });

  test("an email link with its code confirms the address", async ({ page }) => {
    await open(page, "/verify/?type=email&token_hash=e2e-token");
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("This link is not complete");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("reset sends the email and says so", async ({ page }) => {
    await open(page, "/reset/");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e@example.com");
    await page.getByRole("button", { name: "Send reset email" }).click();
    await expect(page.getByText(/check your (email|inbox)/i).first()).toBeVisible();
  });

  test("the log-in, sign-up and reset links move between the forms", async ({ page }) => {
    await open(page, "/login/");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: "Log in to Parity" })).toBeVisible();
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  });
});

test.describe("signed in", () => {
  test("the log-in page sends you on to the app", async ({ page }) => {
    await page.goto("/login/");
    await expect(page).toHaveURL(/\/app\//);
  });

  test("log out goes back to the log-in page and the apps ask again", async ({ page, context }) => {
    await open(page, "/app/#/settings");
    await settled(page);
    await page.getByRole("button", { name: /log out|sign out/i }).first().click();
    await expect(page).toHaveURL(/\/login\//, { timeout: 15_000 });
    expect((await context.cookies()).some((c) => c.name.startsWith("sb-ttqvpxvctnomfbeoqbbs-auth-token") && c.value)).toBe(false);
    await page.goto("/trade/");
    await expect(page).toHaveURL(/\/login\/\?next=%2Ftrade%2F/);
  });
});
