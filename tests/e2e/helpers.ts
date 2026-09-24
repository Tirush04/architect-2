import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const PASSWORD = "architect123";

export function uniqueEmail(tag = "u") {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

export async function signUp(page: Page, opts: { name?: string; email?: string; prompt?: string } = {}) {
  const email = opts.email ?? uniqueEmail();
  await page.goto(opts.prompt ? `/signup?prompt=${encodeURIComponent(opts.prompt)}` : "/signup");
  await page.getByLabel("Name").fill(opts.name ?? "Priya Test");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);
  return email;
}

/** Sign up and finish onboarding without creating a project. */
export async function signUpAndOnboard(page: Page, lens: "Guided" | "Pro" = "Guided") {
  const email = await signUp(page);
  await page.getByRole("radio", { name: lens === "Guided" ? /I describe outcomes/ : /I write code/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  if (lens === "Pro") await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /explore first/ }).click();
  await page.waitForURL(/\/home/);
  return email;
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function expectNoSeriousA11yViolations(page: Page, exclude: string[] = []) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  for (const sel of exclude) builder = builder.exclude(sel);
  const results = await builder.analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`),
  ).toEqual([]);
}

/** Create a project from /home and wait until the Blueprint is drafted. */
export async function createPlannedProject(page: Page, prompt: string) {
  await page.goto("/home");
  await page.getByLabel("Describe your app").fill(prompt);
  await page.getByRole("button", { name: /Draft Blueprint/ }).click();
  await page.waitForURL(/\/p\/[a-z0-9]+/);
  await expect(page.getByRole("button", { name: /Approve & build/ }).first()).toBeVisible();
}

export async function buildProject(page: Page) {
  await page.getByRole("button", { name: /Approve & build/ }).first().click();
  await expect(page.frameLocator('iframe[title="App preview"]').locator("body")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("button", { name: /v1/ })).toBeVisible();
}
