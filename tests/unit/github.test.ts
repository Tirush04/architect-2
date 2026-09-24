import { describe, expect, it, vi } from "vitest";
import { detectStack, guessAgentFramework, importRepo, parseRepo, pushFiles, repoNameFor, selectImportPaths, type GitHubRest } from "@/lib/github";

function fakeGitHub(overrides: Partial<{ defaultBranch: string }> = {}) {
  const branch = overrides.defaultBranch ?? "main";
  const calls: Record<string, unknown[]> = {};
  const rec = <T,>(name: string, ret: T) =>
    vi.fn(async (p: unknown): Promise<T> => {
      (calls[name] ??= []).push(p);
      return ret;
    });
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  const contents: Record<string, string> = {
    "package.json": JSON.stringify({ dependencies: { next: "15", react: "19" }, devDependencies: { typescript: "5", tailwindcss: "4" } }),
    "src/app/page.tsx": "export default function Page(){}",
    "README.md": "# hi",
  };
  const gh: GitHubRest = {
    repos: {
      createForAuthenticatedUser: rec("createRepo", {
        data: { full_name: "tirush/dispute-desk", html_url: "https://github.com/tirush/dispute-desk", default_branch: branch, owner: { login: "tirush" }, name: "dispute-desk" },
      }),
      get: rec("getRepo", { data: { default_branch: branch, html_url: "https://github.com/o/r" } }),
      listForAuthenticatedUser: rec("list", { data: [] }),
      getContent: vi.fn(async ({ path }: { path: string }) => ({ data: { content: b64(contents[path] ?? ""), encoding: "base64" } })),
    },
    git: {
      getRef: rec("getRef", { data: { object: { sha: "parent-sha" } } }),
      getCommit: rec("getCommit", { data: { tree: { sha: "base-tree" } } }),
      createBlob: vi.fn(async ({ content }: { content: string }) => ({ data: { sha: `blob-${content.length}` } })),
      createTree: rec("createTree", { data: { sha: "new-tree" } }),
      createCommit: rec("createCommit", { data: { sha: "new-commit" } }),
      updateRef: rec("updateRef", {}),
      getTree: rec("getTree", {
        data: {
          truncated: false,
          tree: [
            { path: "package.json", type: "blob", size: 100 },
            { path: "src/app/page.tsx", type: "blob", size: 50 },
            { path: "README.md", type: "blob", size: 10 },
            { path: "node_modules/x/index.js", type: "blob", size: 10 },
            { path: "public/logo.png", type: "blob", size: 10 },
            { path: "src", type: "tree" },
          ],
        },
      }),
    },
  };
  return { gh, calls };
}

describe("repo names", () => {
  it("sanitises app names", () => {
    expect(repoNameFor("Dispute Desk 2.0!")).toBe("dispute-desk-2.0");
    expect(repoNameFor("***")).toBe("architect-app");
  });
  it("parses owner/repo and URLs", () => {
    expect(parseRepo("octo/hello")).toEqual({ owner: "octo", repo: "hello" });
    expect(parseRepo("https://github.com/octo/hello.git")).toEqual({ owner: "octo", repo: "hello" });
    expect(parseRepo("octo")).toBeNull();
    expect(parseRepo("../../etc")).toBeNull();
  });
});

describe("pushFiles", () => {
  it("creates a repo and commits all files on the default branch", async () => {
    const { gh, calls } = fakeGitHub({ defaultBranch: "main" });
    const res = await pushFiles(gh, {
      appName: "Dispute Desk",
      description: "desc",
      files: { "index.html": "<html/>", "agents/a.py": "print(1)" },
      message: "Architect checkpoint v1",
    });
    expect(res).toEqual({ fullName: "tirush/dispute-desk", url: "https://github.com/tirush/dispute-desk", commitSha: "new-commit" });
    expect(calls.createRepo[0]).toMatchObject({ name: "dispute-desk", auto_init: true, private: false });
    expect(calls.createTree[0]).toMatchObject({ base_tree: "base-tree" });
    expect((calls.createTree[0] as { tree: unknown[] }).tree).toHaveLength(2);
    expect(calls.createCommit[0]).toMatchObject({ parents: ["parent-sha"], tree: "new-tree" });
    expect(calls.updateRef[0]).toMatchObject({ ref: "heads/main", sha: "new-commit" });
  });

  it("pushes to an existing repo without creating one", async () => {
    const { gh, calls } = fakeGitHub({ defaultBranch: "trunk" });
    await pushFiles(gh, { existing: "o/r", appName: "x", description: "", files: { a: "1" }, message: "m" });
    expect(calls.createRepo).toBeUndefined();
    expect(calls.updateRef[0]).toMatchObject({ owner: "o", repo: "r", ref: "heads/trunk" });
  });
});

describe("import", () => {
  it("selects text files and skips vendored/binary", () => {
    const paths = selectImportPaths([
      { path: "a.ts", type: "blob", size: 1 },
      { path: "node_modules/b.js", type: "blob", size: 1 },
      { path: "img.png", type: "blob", size: 1 },
      { path: "big.json", type: "blob", size: 70_000 },
      { path: "deep/x/y.py", type: "blob", size: 1 },
    ]);
    expect(paths).toEqual(["a.ts", "deep/x/y.py"]);
  });

  it("detects stacks", () => {
    expect(detectStack({ dependencies: { next: "1" } }, ["a.tsx"])).toEqual(["Next.js", "TypeScript"]);
    expect(detectStack(null, ["main.py"], "fastapi\nlanggraph==0.2")).toEqual(["Python", "FastAPI", "LangGraph"]);
    expect(guessAgentFramework(["Python", "LangGraph"])).toBe("langgraph");
    expect(guessAgentFramework(["Next.js", "TypeScript"])).toBe("claude-agent-sdk");
    expect(guessAgentFramework(["Python"])).toBe("lyzr");
  });

  it("imports a repo into files + a codebase map", async () => {
    const { gh } = fakeGitHub();
    const out = await importRepo(gh, "o/r");
    expect(Object.keys(out.files).sort()).toEqual(["README.md", "package.json", "src/app/page.tsx"]);
    expect(out.map.stack).toEqual(expect.arrayContaining(["Next.js", "TypeScript", "Tailwind"]));
    expect(out.map.frameworkGuess).toBe("claude-agent-sdk");
    expect(out.map.entryPoints).toContain("src/app/page.tsx");
    expect(out.map.totalFiles).toBe(5);
  });

  it("rejects malformed repo names", async () => {
    const { gh } = fakeGitHub();
    await expect(importRepo(gh, "not a repo")).rejects.toThrow(/owner\/repo/);
  });
});
