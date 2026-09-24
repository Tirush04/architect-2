import type { Files } from "@/lib/schemas";

/** The subset of Octokit's REST surface we use — injectable for tests. */
export type GitHubRest = {
  repos: {
    createForAuthenticatedUser(p: { name: string; description?: string; private?: boolean; auto_init?: boolean }): Promise<{ data: { full_name: string; html_url: string; default_branch: string; owner: { login: string }; name: string } }>;
    get(p: { owner: string; repo: string }): Promise<{ data: { default_branch: string; html_url: string } }>;
    listForAuthenticatedUser(p: { sort?: "updated"; per_page?: number; affiliation?: string }): Promise<{ data: Array<{ full_name: string; name: string; description: string | null; private: boolean; language: string | null; updated_at: string | null; html_url: string; default_branch: string }> }>;
    getContent(p: { owner: string; repo: string; path: string; ref?: string }): Promise<{ data: unknown }>;
  };
  git: {
    getRef(p: { owner: string; repo: string; ref: string }): Promise<{ data: { object: { sha: string } } }>;
    getCommit(p: { owner: string; repo: string; commit_sha: string }): Promise<{ data: { tree: { sha: string } } }>;
    createBlob(p: { owner: string; repo: string; content: string; encoding: "utf-8" | "base64" }): Promise<{ data: { sha: string } }>;
    createTree(p: { owner: string; repo: string; base_tree?: string; tree: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> }): Promise<{ data: { sha: string } }>;
    createCommit(p: { owner: string; repo: string; message: string; tree: string; parents: string[] }): Promise<{ data: { sha: string } }>;
    updateRef(p: { owner: string; repo: string; ref: string; sha: string; force?: boolean }): Promise<unknown>;
    getTree(p: { owner: string; repo: string; tree_sha: string; recursive?: string }): Promise<{ data: { tree: Array<{ path?: string; type?: string; size?: number }>; truncated?: boolean } }>;
  };
};

export function repoNameFor(appName: string): string {
  const n = appName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return n || "architect-app";
}

export function parseRepo(full: string): { owner: string; repo: string } | null {
  const m = full.trim().match(/^(?:https?:\/\/github\.com\/)?([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** Create (if needed) and push all files as one commit on the default branch. */
export async function pushFiles(
  gh: GitHubRest,
  opts: { existing?: string | null; appName: string; description: string; files: Files; message: string },
): Promise<{ fullName: string; url: string; commitSha: string }> {
  let owner: string;
  let repo: string;
  let branch: string;
  let url: string;
  const parsed = opts.existing ? parseRepo(opts.existing) : null;
  if (parsed) {
    ({ owner, repo } = parsed);
    const info = await gh.repos.get({ owner, repo });
    branch = info.data.default_branch;
    url = info.data.html_url;
  } else {
    const created = await gh.repos.createForAuthenticatedUser({
      name: repoNameFor(opts.appName),
      description: opts.description.slice(0, 300),
      private: false,
      auto_init: true,
    });
    owner = created.data.owner.login;
    repo = created.data.name;
    branch = created.data.default_branch;
    url = created.data.html_url;
  }

  const ref = await gh.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const parentSha = ref.data.object.sha;
  const parent = await gh.git.getCommit({ owner, repo, commit_sha: parentSha });

  const tree = [];
  for (const [path, content] of Object.entries(opts.files)) {
    const blob = await gh.git.createBlob({ owner, repo, content, encoding: "utf-8" });
    tree.push({ path, mode: "100644" as const, type: "blob" as const, sha: blob.data.sha });
  }
  const newTree = await gh.git.createTree({ owner, repo, base_tree: parent.data.tree.sha, tree });
  const commit = await gh.git.createCommit({ owner, repo, message: opts.message, tree: newTree.data.sha, parents: [parentSha] });
  await gh.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.data.sha });
  return { fullName: `${owner}/${repo}`, url, commitSha: commit.data.sha };
}

const TEXT_EXT = /\.(tsx?|jsx?|mjs|cjs|json|md|mdx|css|scss|html|py|toml|ya?ml|txt|env\.example|sql|prisma|go|rb|java|kt|rs|vue|svelte)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|out|coverage|vendor|__pycache__|\.venv)(\/|$)/;

export type CodebaseMap = {
  stack: string[];
  frameworkGuess: string;
  totalFiles: number;
  importedFiles: number;
  truncated: boolean;
  entryPoints: string[];
  topDirs: Array<{ dir: string; files: number }>;
};

export function detectStack(pkg: Record<string, unknown> | null, paths: string[], pyReqs?: string): string[] {
  const deps = {
    ...((pkg?.dependencies as Record<string, string>) ?? {}),
    ...((pkg?.devDependencies as Record<string, string>) ?? {}),
  };
  const has = (d: string) => d in deps;
  const stack: string[] = [];
  if (has("next")) stack.push("Next.js");
  else if (has("react")) stack.push("React");
  if (has("vue")) stack.push("Vue");
  if (has("svelte") || has("@sveltejs/kit")) stack.push("Svelte");
  if (has("express")) stack.push("Express");
  if (has("typescript") || paths.some((p) => p.endsWith(".ts") || p.endsWith(".tsx"))) stack.push("TypeScript");
  if (has("tailwindcss")) stack.push("Tailwind");
  if (has("prisma") || has("@prisma/client")) stack.push("Prisma");
  if (has("langchain") || has("@langchain/core")) stack.push("LangChain");
  if (paths.some((p) => p.endsWith(".py"))) stack.push("Python");
  const reqs = (pyReqs ?? "").toLowerCase();
  if (/fastapi/.test(reqs)) stack.push("FastAPI");
  if (/django/.test(reqs)) stack.push("Django");
  if (/langgraph/.test(reqs)) stack.push("LangGraph");
  if (/crewai/.test(reqs)) stack.push("CrewAI");
  return [...new Set(stack)];
}

export function guessAgentFramework(stack: string[]): string {
  if (stack.includes("LangGraph") || stack.includes("LangChain")) return "langgraph";
  if (stack.includes("CrewAI")) return "crewai";
  if (stack.includes("TypeScript") && !stack.includes("Python")) return "claude-agent-sdk";
  return "lyzr";
}

export function selectImportPaths(entries: Array<{ path?: string; type?: string; size?: number }>, max = 60): string[] {
  return entries
    .filter((e) => e.type === "blob" && e.path && !SKIP_DIR.test(e.path) && TEXT_EXT.test(e.path) && (e.size ?? 0) <= 60_000)
    .map((e) => e.path as string)
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
    .slice(0, max);
}

function decodeContent(data: unknown): string | null {
  if (data && typeof data === "object" && "content" in data && "encoding" in data) {
    const d = data as { content: string; encoding: string };
    if (d.encoding === "base64") return Buffer.from(d.content, "base64").toString("utf8");
  }
  return null;
}

export async function importRepo(gh: GitHubRest, full: string): Promise<{ files: Files; map: CodebaseMap; url: string }> {
  const parsed = parseRepo(full);
  if (!parsed) throw new Error("Use the owner/repo format");
  const { owner, repo } = parsed;
  const info = await gh.repos.get({ owner, repo });
  const branch = info.data.default_branch;
  const ref = await gh.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const tree = await gh.git.getTree({ owner, repo, tree_sha: ref.data.object.sha, recursive: "1" });
  const allBlobs = tree.data.tree.filter((e) => e.type === "blob" && e.path);
  const paths = selectImportPaths(tree.data.tree);
  const files: Files = {};
  for (const path of paths) {
    const res = await gh.repos.getContent({ owner, repo, path, ref: branch });
    const text = decodeContent(res.data);
    if (text !== null) files[path] = text;
  }
  let pkg: Record<string, unknown> | null = null;
  try {
    pkg = files["package.json"] ? (JSON.parse(files["package.json"]) as Record<string, unknown>) : null;
  } catch {
    pkg = null;
  }
  const stack = detectStack(pkg, allBlobs.map((b) => b.path as string), files["requirements.txt"]);
  const dirCounts = new Map<string, number>();
  for (const b of allBlobs) {
    const p = b.path as string;
    if (SKIP_DIR.test(p)) continue;
    const dir = p.includes("/") ? p.split("/")[0] : "(root)";
    dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
  }
  const entryPoints = Object.keys(files).filter((p) =>
    /(^|\/)(index\.html|main\.(py|ts|tsx|js)|app\.(py|ts|tsx|js)|page\.tsx|server\.(ts|js))$/.test(p),
  );
  return {
    files,
    url: info.data.html_url,
    map: {
      stack,
      frameworkGuess: guessAgentFramework(stack),
      totalFiles: allBlobs.length,
      importedFiles: Object.keys(files).length,
      truncated: !!tree.data.truncated || allBlobs.length > paths.length,
      entryPoints: entryPoints.slice(0, 8),
      topDirs: [...dirCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([dir, n]) => ({ dir, files: n })),
    },
  };
}
