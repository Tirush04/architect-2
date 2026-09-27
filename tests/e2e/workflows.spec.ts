import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PASSWORD, buildProject, createPlannedProject, signIn, signUpAndOnboard } from "./helpers";

const tab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Workspace" }).getByRole("tab", { name });

test.describe("secondary workflows", () => {
  test("import a local folder → codebase map → Pro code view", async ({ page }) => {
    test.setTimeout(120_000);
    await signUpAndOnboard(page, "Pro");
    await page.goto("/import");
    await page.getByRole("tab", { name: "Upload a folder" }).click();
    const dir = mkdtempSync(path.join(tmpdir(), "acme-portal-"));
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ dependencies: { next: "15", react: "19" }, devDependencies: { typescript: "5" } }));
    writeFileSync(path.join(dir, "README.md"), ["# Acme portal", "", "A customer portal for Acme's field technicians to log jobs and invoices."].join("\n"));
    writeFileSync(path.join(dir, "page.tsx"), "export default function Page() { return <main>Hello</main>; }");
    writeFileSync(path.join(dir, "logo.png"), Buffer.from([0x89, 0x50]));
    await page.getByLabel("Choose folder").setInputFiles(dir);
    await expect(page.getByText(/3 source files ready/)).toBeVisible();
    await expect(page.getByText(/1 skipped/)).toBeVisible();
    await page.getByRole("button", { name: /Import 3 files/ }).click();
    await page.waitForURL(/\/p\//);
    await expect(page.getByText(/Imported 3 of 3 files/)).toBeVisible();
    await expect(page.getByText("Next.js", { exact: true })).toBeVisible();
    await expect(page.getByRole("treeitem", { name: /package\.json/ })).toBeVisible();
    await tab(page, /Preview/).click();
    await expect(page.getByText(/Your app will appear here|Wireframes/)).toBeVisible();
  });

  test("home: star, filter, rename and delete via dialogs; command palette", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page);
    await createPlannedProject(page, "A sales CRM for leads");
    await page.goto("/home");
    const card = page.getByRole("listitem").filter({ hasText: "Pipeline Pilot" });
    await card.hover();
    await page.getByRole("button", { name: "Actions for Pipeline Pilot" }).click();
    await page.getByRole("menuitem", { name: "Star" }).click();
    await expect(card.getByLabel("Starred")).toBeVisible();
    await page.getByRole("tab", { name: "starred" }).click();
    await expect(page.getByRole("link", { name: "Open Pipeline Pilot" })).toBeVisible();
    await page.getByRole("tab", { name: "all" }).click();

    await card.hover();
    await page.getByRole("button", { name: "Actions for Pipeline Pilot" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByLabel("Project name").fill("Deal Desk");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("link", { name: "Open Deal Desk" })).toBeVisible();

    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Search projects or run a command/).fill("templates");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/templates/);
    await page.goto("/home");

    const renamed = page.getByRole("listitem").filter({ hasText: "Deal Desk" });
    await renamed.hover();
    await page.getByRole("button", { name: "Actions for Deal Desk" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete project" }).click();
    await expect(page.getByText("No projects yet")).toBeVisible();
  });

  test("Blueprint data model edits flow into Data schema and wireframes", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page, "Pro");
    await createPlannedProject(page, "An expense approval tool");
    await tab(page, /Blueprint/).click();
    await page.getByRole("button", { name: "+ Add field" }).first().click();
    await page.getByLabel("Field name").last().fill("approvedBy");
    await page.getByRole("button", { name: /Page$/ }).click();
    await page.getByLabel(/Page \d name/).last().fill("Audit");
    await page.getByRole("button", { name: "Move up" }).last().click();
    await page.getByRole("button", { name: /Save & build/ }).click();
    await expect(page.frameLocator('iframe[title="App preview"]').getByRole("button", { name: "Audit" })).toBeVisible({ timeout: 60_000 });
    await tab(page, /Data/).click();
    await expect(page.getByText(/approved_by text/)).toBeVisible();
  });

  test("agents: add, rename, save, code regenerates, delete", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page, "Pro");
    await createPlannedProject(page, "A customer support helpdesk");
    await buildProject(page);
    await tab(page, /Agents/).click();
    await page.getByRole("button", { name: "Agent", exact: true }).click();
    await page.getByLabel("Name").fill("Refund Agent");
    await page.getByLabel("Add tool").fill("issue refund");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Blueprint saved/)).toBeVisible();
    await tab(page, /Code/).click();
    await page.getByRole("button", { name: "refund_agent.py" }).click();
    await expect(page.locator(".monaco-editor").first()).toContainText("issue_refund", { timeout: 30_000 });
    await tab(page, /Agents/).click();
    await page.locator(".react-flow__node").filter({ hasText: "Refund Agent" }).click();
    await page.getByRole("button", { name: "Delete Refund Agent" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Blueprint saved/).last()).toBeVisible();
    await tab(page, /Code/).click();
    await expect(page.getByRole("button", { name: "refund_agent.py" })).toHaveCount(0);
  });

  test("code: new file, diff against v1, delete file", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page, "Pro");
    await createPlannedProject(page, "A recruiting pipeline tracker");
    await buildProject(page);
    await tab(page, /Code/).click();
    await page.getByRole("button", { name: "New file" }).click();
    await page.getByLabel("File path").fill("notes/plan.md");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("treeitem", { name: "plan.md" })).toBeVisible();
    await page.getByLabel("Compare with version").selectOption("1");
    await expect(page.locator(".monaco-diff-editor").first()).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Compare with version").selectOption("");
    await page.getByRole("button", { name: "Delete notes/plan.md" }).click();
    await expect(page.getByRole("treeitem", { name: "plan.md" })).toHaveCount(0);
  });

  test("share and GitHub dialogs; deploy then roll back serves the older version", async ({ page, request }) => {
    test.setTimeout(180_000);
    await signUpAndOnboard(page);
    await createPlannedProject(page, "A vendor onboarding portal");
    await buildProject(page);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByText("Deploy to get a public link.")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "GitHub", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(/isn't configured|Connect GitHub|Push/);
    await page.keyboard.press("Escape");

    await tab(page, /Deploy/).click();
    await page.getByRole("button", { name: /Deploy to production/ }).click();
    await expect(page.getByText(/✓ Live at/)).toBeVisible({ timeout: 60_000 });
    const url = (await page.getByRole("link", { name: /\/share\// }).first().getAttribute("href"))!;
    expect(await (await request.get(url)).text()).not.toContain('class="dark"');

    await page.getByLabel("Message Architect").fill("make it dark");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("button", { name: "v2", exact: true })).toBeVisible({ timeout: 60_000 });
    await tab(page, /Deploy/).click();
    await page.getByRole("button", { name: "Deploy v2" }).click();
    await expect(page.getByRole("button", { name: /Roll back to v1/ })).toBeVisible({ timeout: 60_000 });
    expect(await (await request.get(url)).text()).toContain('class="dark"');

    await page.getByRole("button", { name: /Roll back to v1/ }).click();
    await expect(page.getByText(/Deployed v1/)).toHaveCount(2, { timeout: 60_000 });
    expect(await (await request.get(url)).text()).not.toContain('class="dark"');

    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByLabel("Public link")).toHaveValue(url);
  });

  test("settings: profile, default lens, project delete, account delete", async ({ page }) => {
    test.setTimeout(150_000);
    const email = await signUpAndOnboard(page);
    await page.goto("/settings");
    await page.locator("#s-name").fill("Renamed User");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();
    await page.getByRole("radiogroup", { name: "Default lens" }).getByRole("radio", { name: "Pro" }).click();
    await expect(page.getByText(/New projects open in the Pro lens/)).toBeVisible();

    await createPlannedProject(page, "An internal approvals tool");
    await expect(page.getByRole("radio", { name: "Pro" })).toHaveAttribute("aria-checked", "true");
    await tab(page, /Settings/).click();
    await page.getByRole("button", { name: "Delete project" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
    await page.waitForURL(/\/home/);

    await page.goto("/settings#danger");
    await page.getByRole("button", { name: "Delete account" }).click();
    await page.getByLabel("Confirm email").fill(email);
    await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await signIn(page, email, PASSWORD);
    await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
  });
});
