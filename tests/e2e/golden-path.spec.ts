import { expect, test } from "@playwright/test";
import { buildProject, createPlannedProject, expectNoSeriousA11yViolations, signUpAndOnboard } from "./helpers";

test.describe.configure({ mode: "serial" });

test("prompt → Blueprint → build → iterate → code → agents → deploy → share → rollback", async ({ page, request }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "Guided");

  // 1. Plan
  await createPlannedProject(page, "Build a credit card dispute management app for my payments team");
  await expect(page.getByText("Blueprint · DisputeDesk")).toBeVisible();
  await expect(page.getByText("Wireframes · Plan mode").or(page.getByRole("heading", { name: "DisputeDesk" }))).toBeVisible();

  // 2. Edit the Blueprint before building
  await page.getByRole("tab", { name: /Blueprint/ }).click();
  await page.getByLabel("Tagline").fill("Resolve card disputes before lunch.");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Blueprint saved")).toBeVisible();

  // 3. Build
  await buildProject(page);
  const preview = page.frameLocator('iframe[title="App preview"]');
  await expect(preview.getByText("DisputeDesk").first()).toBeVisible();
  await expect(preview.getByRole("button", { name: "Queue" })).toBeVisible();
  await expect(page.getByText(/files? changed/).first()).toBeVisible();

  // 4. Iterate in chat (demo engine understands this)
  await page.getByLabel("Message Architect").fill("Make it dark and add a page called Audit log");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: /v2/ })).toBeVisible({ timeout: 30_000 });
  await expect(preview.locator("html")).toHaveClass(/dark/);
  await expect(preview.getByRole("button", { name: "Audit Log" })).toBeVisible();

  // 5. Unknown request explains itself instead of failing silently
  await page.getByLabel("Message Architect").fill("optimise the database indexes");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/couldn't map that to a change/).last()).toBeVisible();

  // 6. Pro lens: code, edit and save a checkpoint
  await page.getByRole("radio", { name: "Pro" }).click();
  await page.getByRole("tab", { name: /Code/ }).click();
  await expect(page.getByRole("treeitem", { name: /index\.html/ })).toBeVisible();
  await page.getByRole("button", { name: "README.md" }).click();
  const editor = page.locator(".monaco-editor").first();
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n\nEdited in the Pro lens.");
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/Saved as v3/)).toBeVisible();

  // 7. Agent Studio: canvas + playground
  await page.getByRole("tab", { name: /Agents/ }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.getByText("Intake Agent").first()).toBeVisible();
  await page.getByRole("tab", { name: "Code" }).last().click();
  await expect(page.locator(".monaco-editor").first()).toContainText("create_agent", { timeout: 30_000 });
  await page.getByRole("tab", { name: "Test" }).click();
  await page.getByLabel("Try a message").fill("Customer says they never received order #1234");
  await page.getByRole("button", { name: /Run agent/ }).click();
  await expect(page.getByText(/Trace ·/)).toBeVisible();
  await expect(page.getByText(/PII redaction ✓/)).toBeVisible();

  // 8. Switch agent framework → code regenerates as a new checkpoint
  await page.getByRole("tab", { name: /Settings/ }).click();
  await page.getByLabel("Agent framework").selectOption("langgraph");
  await expect(page.getByText(/Framework updated/)).toBeVisible();
  await page.getByRole("tab", { name: /Code/ }).first().click();
  await page.getByRole("button", { name: "intake_agent.py" }).click();
  await expect(page.locator(".monaco-editor").first()).toContainText("create_react_agent", { timeout: 30_000 });

  // 9. Secrets
  await page.getByRole("tab", { name: /Settings/ }).click();
  await page.getByLabel("Variable name").fill("STRIPE_KEY");
  await page.getByLabel("Variable value").fill("sk_test_1234567890");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(page.getByText("STRIPE_KEY")).toBeVisible();
  await expect(page.getByText(/7890$/)).toBeVisible();
  await expect(page.getByText("sk_test_1234567890")).toHaveCount(0);

  // 10. Deploy → live share URL
  await page.getByRole("tab", { name: /Deploy/ }).click();
  await expect(page.getByText("Pre-deploy checklist")).toBeVisible();
  await page.getByRole("button", { name: /Deploy to production/ }).click();
  await expect(page.getByText(/✓ Live at/)).toBeVisible({ timeout: 30_000 });
  const link = page.getByRole("link", { name: /\/share\// }).first();
  const url = await link.getAttribute("href");
  expect(url).toMatch(/\/share\/disputedesk-[a-z2-9]{10}$/);

  const shared = await request.get(url!);
  expect(shared.status()).toBe(200);
  expect(shared.headers()["content-security-policy"]).toContain("sandbox allow-scripts");
  expect(shared.headers()["content-security-policy"]).not.toContain("allow-same-origin");
  expect(await shared.text()).toContain("DisputeDesk");

  // 11. Restore v1 then roll the deployment back
  await page.getByRole("button", { name: /^v\d+$/ }).click();
  await page.getByRole("menuitem", { name: "Restore" }).last().click();
  await expect(page.getByText(/Restored v1/).first()).toBeVisible();
  await page.getByRole("tab", { name: /Deploy/ }).click();
  await page.getByRole("button", { name: /Deploy v\d+/ }).click();
  await expect(page.getByRole("button", { name: /Roll back to v/ }).first()).toBeVisible({ timeout: 30_000 });

  // 12. Accessibility of the workspace (preview iframe and Monaco are third-party surfaces)
  await page.getByRole("tab", { name: /Preview/ }).click();
  await expectNoSeriousA11yViolations(page, ["iframe", ".monaco-editor", ".react-flow"]);

  // 13. Dashboard reflects the live project
  await page.goto("/home");
  await expect(page.getByText("Live").first()).toBeVisible();
  await page.getByRole("tab", { name: "live" }).click();
  await expect(page.getByRole("link", { name: /Open DisputeDesk/ })).toBeVisible();
});

test("click-to-edit selection is attached to the next message", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page);
  await createPlannedProject(page, "A customer support helpdesk with ticket triage");
  await buildProject(page);
  await page.getByRole("button", { name: /Select to edit/ }).click();
  await page.frameLocator('iframe[title="App preview"]').getByRole("heading", { level: 1 }).click();
  await expect(page.getByText(/Editing/)).toBeVisible();
  await page.getByLabel("Message Architect").fill("Use a green accent");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/on “/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /v2/ })).toBeVisible({ timeout: 30_000 });
});

test("templates, API keys and the public REST API", async ({ page, request }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "Pro");
  await page.goto("/templates");
  await page.getByRole("tab", { name: "People" }).click();
  await page.getByRole("button", { name: /Use template/ }).first().click();
  await page.waitForURL(/\/p\//);
  await expect(page.getByText("Blueprint · Shortlist")).toBeVisible({ timeout: 30_000 });

  await page.goto("/settings#developer");
  await page.getByLabel("API key name").fill("CI");
  await page.getByRole("button", { name: /Create key/ }).click();
  const key = await page.getByLabel("New API key").inputValue();
  expect(key).toMatch(/^arch_/);

  const res = await request.get("/api/v1/projects", { headers: { Authorization: `Bearer ${key}` } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data[0].name).toBe("Resume screener");

  const bad = await request.get("/api/v1/projects", { headers: { Authorization: "Bearer arch_nope" } });
  expect(bad.status()).toBe(401);

  await page.reload();
  await page.getByRole("button", { name: "Revoke CI" }).click();
  await expect(page.getByText("Key revoked")).toBeVisible();
  const revoked = await request.get("/api/v1/projects", { headers: { Authorization: `Bearer ${key}` } });
  expect(revoked.status()).toBe(401);
});

test("mobile: chat and app panes switch", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await signUpAndOnboard(page);
  await createPlannedProject(page, "An expense approval tool");
  await expect(page.getByLabel("Message Architect")).toBeVisible();
  await page.getByRole("navigation", { name: "Panes" }).getByRole("button", { name: "App" }).click();
  await expect(page.getByRole("tablist", { name: "Workspace" })).toBeVisible();
  await page.getByRole("navigation", { name: "Panes" }).getByRole("button", { name: "Chat" }).click();
  await expect(page.getByLabel("Message Architect")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await ctx.close();
});
