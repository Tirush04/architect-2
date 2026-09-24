import { expect, test } from "@playwright/test";
import { buildProject, createPlannedProject, signUpAndOnboard } from "./helpers";

test.describe("security", () => {
  test("APIs require a session", async ({ request }) => {
    for (const [method, url] of [
      ["GET", "/api/projects"],
      ["POST", "/api/projects"],
      ["POST", "/api/projects/x/plan"],
      ["POST", "/api/projects/x/build"],
      ["POST", "/api/projects/x/chat"],
      ["POST", "/api/projects/x/deploy"],
      ["GET", "/api/projects/x/env"],
      ["POST", "/api/import"],
      ["GET", "/api/github/repos"],
      ["POST", "/api/agents/run"],
    ] as const) {
      const res = method === "GET" ? await request.get(url) : await request.post(url, { data: { projectId: "x", agent: { name: "a", instructions: "", tools: [] }, input: "hi", kind: "upload", name: "n", files: {} } });
      expect([400, 401], `${method} ${url}`).toContain(res.status());
      if (url !== "/api/agents/run") expect(res.status(), `${method} ${url}`).toBe(401);
    }
  });

  test("users cannot see or modify each other's projects", async ({ page, browser }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page);
    await createPlannedProject(page, "A sales CRM for leads");
    const projectUrl = page.url().split("?")[0];
    const id = projectUrl.split("/p/")[1];

    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signUpAndOnboard(other);
    const view = await other.goto(projectUrl);
    expect(view?.status()).toBe(404);
    for (const [method, path, data] of [
      ["GET", `/api/projects/${id}/state`, undefined],
      ["PATCH", `/api/projects/${id}`, { name: "pwned" }],
      ["POST", `/api/projects/${id}/build`, {}],
      ["POST", `/api/projects/${id}/deploy`, {}],
      ["DELETE", `/api/projects/${id}`, undefined],
    ] as const) {
      const res = await other.request.fetch(path, { method, data });
      expect(res.status(), `${method} ${path}`).toBe(404);
    }
    await ctx.close();
    await page.reload();
    await expect(page.getByRole("button", { name: /Pipeline Pilot|sales CRM/i }).first()).toBeVisible();
  });

  test("file API rejects path traversal and oversize content", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page, "Pro");
    await createPlannedProject(page, "A vendor onboarding portal");
    await buildProject(page);
    const id = page.url().split("/p/")[1].split("?")[0];
    for (const path of ["../../etc/passwd", "/abs.txt", "a/../b.txt", ".env"]) {
      const res = await page.request.post(`/api/projects/${id}/files`, { data: { path, content: "x" } });
      expect(res.status(), path).toBe(400);
    }
    const big = await page.request.post(`/api/projects/${id}/files`, { data: { path: "big.txt", content: "x".repeat(400_001) } });
    expect(big.status()).toBe(400);
    const ok = await page.request.post(`/api/projects/${id}/files`, { data: { path: "notes/todo.md", content: "- ship it" } });
    expect(ok.status()).toBe(200);
  });

  test("preview iframe is sandboxed without same-origin", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page);
    await createPlannedProject(page, "A recruiting pipeline tracker");
    await buildProject(page);
    const sandbox = await page.locator('iframe[title="App preview"]').getAttribute("sandbox");
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
    const leaked = await page.frameLocator('iframe[title="App preview"]').locator("body").evaluate(() => {
      try {
        return document.cookie + String(window.parent.document.cookie);
      } catch {
        return "blocked";
      }
    });
    expect(leaked).toBe("blocked");
  });

  test("env var keys are validated", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page);
    await createPlannedProject(page, "An internal tool for approvals");
    const id = page.url().split("/p/")[1].split("?")[0];
    const bad = await page.request.post(`/api/projects/${id}/env`, { data: { key: "lower-case", value: "x" } });
    expect(bad.status()).toBe(400);
    const good = await page.request.post(`/api/projects/${id}/env`, { data: { key: "API_TOKEN", value: "supersecretvalue" } });
    const body = await good.json();
    expect(JSON.stringify(body)).not.toContain("supersecretvalue");
  });

  test("unknown share links 404 safely", async ({ request }) => {
    const res = await request.get("/share/nope-nope-nope");
    expect(res.status()).toBe(404);
    expect(res.headers()["content-security-policy"]).toContain("sandbox");
    const weird = await request.get("/share/%3Cscript%3E");
    expect(weird.status()).toBe(404);
  });
});
