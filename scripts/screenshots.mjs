// Capture product screenshots for review/README. Usage: node scripts/screenshots.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3100";
const out = "docs/screens";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const shot = async (name) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("saved", name);
};
const theme = async (t) => {
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, t);
};

await page.goto(base);
await theme("light");
await shot("01-landing");
await page.evaluate(() => window.scrollTo(0, 820));
await shot("02-landing-lens");
await page.goto(`${base}/signup?prompt=${encodeURIComponent("Triage credit-card disputes from email")}`);
await shot("03-signup");

const email = `demo-${Date.now()}@example.com`;
await page.getByLabel("Name").fill("Priya Nair");
await page.getByLabel("Work email").fill(email);
await page.getByLabel("Password", { exact: true }).fill("architect123");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL(/onboarding/);
await page.getByRole("radio", { name: /I describe outcomes/ }).click();
await shot("04-onboarding");
await page.getByRole("button", { name: "Continue" }).click();
await shot("05-onboarding-prompt");
await page.getByRole("button", { name: /Draft my Blueprint/ }).click();
await page.waitForURL(/\/p\//);
await page.waitForTimeout(900);
await shot("06-planning");
await page.getByRole("button", { name: /Approve & build/ }).first().waitFor();
await shot("07-blueprint-ready");
await page.getByRole("tablist", { name: "Workspace" }).getByRole("tab", { name: /Blueprint/ }).click();
await shot("08-blueprint-tab");
await page.getByRole("button", { name: /Approve & build/ }).first().click();
await page.waitForTimeout(2200);
await shot("09-ui-being-built");
await page.getByRole("button", { name: /v1/ }).waitFor({ timeout: 60000 });
await shot("10-preview");
await page.getByLabel("Message Architect").fill("Make it dark and add a page called Audit log");
await page.getByRole("button", { name: "Send", exact: true }).click();
await page.getByRole("button", { name: /v2/ }).waitFor({ timeout: 60000 });
await shot("11-iterated");
await page.getByRole("tablist", { name: "Workspace" }).getByRole("tab", { name: /Agents/ }).click();
await page.getByRole("tab", { name: "Test" }).click();
await page.getByLabel("Try a message").fill("Cardholder says they never received order #1234");
await page.getByRole("button", { name: /Run agent/ }).click();
await page.getByText(/Trace ·/).waitFor();
await shot("12-agent-studio");
await page.getByRole("radio", { name: "Pro" }).click();
await page.getByRole("tablist", { name: "Workspace" }).getByRole("tab", { name: /Code/ }).click();
await page.locator(".monaco-editor").first().waitFor({ timeout: 30000 });
await shot("13-code-pro");
await page.getByRole("tablist", { name: "Workspace" }).getByRole("tab", { name: /Data/ }).click();
await shot("14-data");
await page.getByRole("tablist", { name: "Workspace" }).getByRole("tab", { name: /Deploy/ }).click();
await page.getByRole("button", { name: /Deploy to production/ }).click();
await page.getByText(/✓ Live at/).waitFor({ timeout: 60000 });
await shot("15-deployed");
await theme("dark");
await page.getByRole("tablist", { name: "Workspace" }).getByRole("tab", { name: /Preview/ }).click();
await shot("16-workspace-dark");
await page.goto(`${base}/home`);
await shot("17-home-dark");
await theme("light");
await page.reload();
await shot("18-home");
await page.goto(`${base}/templates`);
await shot("19-templates");
await page.goto(`${base}/import`);
await shot("20-import");
await page.goto(`${base}/settings`);
await shot("21-settings");

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const m = await mobile.newPage();
await m.goto(base);
await m.screenshot({ path: `${out}/22-mobile-landing.png` });
console.log("saved 22-mobile-landing");
await browser.close();
