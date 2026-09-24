import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./helpers";

test.describe("public pages", () => {
  test("landing: hero, lens demo and comparison", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Describe it.");
    await page.getByRole("tab", { name: "Pro lens" }).click();
    await expect(page.getByText("agents/resolution_agent.py").first()).toBeVisible();
    await page.getByRole("tab", { name: "Guided lens" }).click();
    await expect(page.getByText("Escalate anything over $5,000 to Priya")).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Architect 2.0");
  });

  test("hero prompt hands off to signup with the prompt", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Triage credit-card disputes from email" }).click();
    await page.getByRole("button", { name: /Plan it/ }).click();
    await page.waitForURL(/\/signup\?prompt=/);
    await expect(page.getByText("We'll plan")).toBeVisible();
  });

  test("pricing and 404", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Start free");
    await expect(page.getByText("Most popular")).toBeVisible();
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("This page isn't on the plan")).toBeVisible();
  });

  test("dark mode toggle persists", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const wasDark = await html.evaluate((el) => el.classList.contains("dark"));
    await page.getByRole("button", { name: /Switch to (dark|light) mode/ }).click();
    await expect(html).toHaveClass(wasDark ? /^(?!.*dark)/ : /dark/);
    await page.reload();
    expect(await html.evaluate((el) => el.classList.contains("dark"))).toBe(!wasDark);
  });

  for (const path of ["/", "/login", "/signup", "/pricing"]) {
    test(`a11y: ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectNoSeriousA11yViolations(page);
    });
  }
});
