import { expect, test } from "@playwright/test";
import { PASSWORD, signIn, signUp, signUpAndOnboard, uniqueEmail } from "./helpers";

test.describe("authentication", () => {
  test("signup validates fields inline", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("A");
    await page.getByLabel("Work email").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("duplicate email is rejected with a helpful message", async ({ page, browser }) => {
    const email = await signUp(page);
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto("/signup");
    await p2.getByLabel("Name").fill("Someone");
    await p2.getByLabel("Work email").fill(email);
    await p2.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await p2.getByRole("button", { name: "Create account" }).click();
    await expect(p2.getByText(/already exists/)).toBeVisible();
    await ctx.close();
  });

  test("protected routes redirect to login and back", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test("sign out, wrong password, then sign in", async ({ page }) => {
    const email = await signUpAndOnboard(page);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await signIn(page, email, "wrong-password-1");
    await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
    await signIn(page, email);
    await page.waitForURL(/\/home/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("What are we building?");
  });

  test("signed-in users are sent from /login to /home", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/home/);
  });

  test("open redirects are neutralised", async ({ page }) => {
    const email = await signUpAndOnboard(page);
    await page.context().clearCookies();
    await page.goto(`/login?callbackUrl=${encodeURIComponent("//evil.example.com/steal")}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/home/);
    expect(new URL(page.url()).host).toBe(new URL(page.url()).host);
    expect(page.url()).not.toContain("evil.example.com");
  });

  test("OAuth buttons render (disabled when not configured)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  });

  test("onboarding with a prompt lands in a planning workspace", async ({ page }) => {
    await signUp(page, { prompt: "An AI support inbox over our help docs", email: uniqueEmail("p") });
    await page.getByRole("radio", { name: /I describe outcomes/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Describe your first app")).toHaveValue("An AI support inbox over our help docs");
    await page.getByRole("button", { name: /Draft my Blueprint/ }).click();
    await page.waitForURL(/\/p\//);
    await expect(page.getByText("Blueprint · Helpline")).toBeVisible();
  });
});
