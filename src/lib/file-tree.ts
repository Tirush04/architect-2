export type TreeNode = { name: string; path: string; children?: TreeNode[] };

/** Build a sorted folder tree (folders first) from flat file paths. */
export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const p of paths) {
    const parts = p.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      node.children ??= [];
      let child = node.children.find((c) => c.name === part && !!c.children === !isFile);
      if (!child) {
        child = isFile ? { name: part, path } : { name: part, path, children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) => (!!b.children === !!a.children ? a.name.localeCompare(b.name) : a.children ? -1 : 1))
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n));
  return sort(root.children ?? []);
}

export function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return (
    {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      mjs: "javascript",
      json: "json",
      md: "markdown",
      html: "html",
      css: "css",
      py: "python",
      yml: "yaml",
      yaml: "yaml",
      sql: "sql",
      toml: "ini",
      prisma: "graphql",
      go: "go",
      rs: "rust",
      java: "java",
    } as Record<string, string>
  )[ext] ?? "plaintext";
}
