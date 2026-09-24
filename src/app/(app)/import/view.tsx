"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FolderUp, GitBranch, Lock, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Input, Spinner } from "@/components/ui";
import { oauthAction } from "@/app/(auth)/actions";
import { cn, timeAgo } from "@/lib/utils";

type Repo = { fullName: string; description: string | null; private: boolean; language: string | null; updatedAt: string | null };

const TEXT_EXT = /\.(tsx?|jsx?|mjs|cjs|json|md|css|scss|html|py|toml|ya?ml|txt|sql|prisma|go|rb|java|kt|rs|vue|svelte)$/i;
const SKIP = /(^|\/)(node_modules|\.git|dist|build|\.next|out|coverage|__pycache__|\.venv)(\/|$)/;

export function ImportView({ githubConfigured }: { githubConfigured: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"github" | "upload">(githubConfigured ? "github" : "upload");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; files: Record<string, string>; skipped: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== "github" || !githubConfigured || repos) return;
    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((j: { connected: boolean; repos: Repo[] }) => {
        setConnected(j.connected);
        setRepos(j.repos);
      })
      .catch(() => setConnected(false));
  }, [tab, githubConfigured, repos]);

  const importBody = async (body: unknown, label: string) => {
    setImporting(label);
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Import failed");
      toast.success("Imported. Mapping the codebase…");
      router.push(`/p/${j.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setImporting(null);
    }
  };

  const onFolder = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files: Record<string, string> = {};
    let skipped = 0;
    let total = 0;
    let root = "";
    for (const f of Array.from(list)) {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const parts = rel.split("/");
      if (!root && parts.length > 1) root = parts[0];
      const path = parts.length > 1 ? parts.slice(1).join("/") : rel;
      if (SKIP.test(path) || !TEXT_EXT.test(path) || f.size > 200_000 || Object.keys(files).length >= 120 || total + f.size > 3_500_000) {
        skipped++;
        continue;
      }
      files[path] = await f.text();
      total += f.size;
    }
    if (Object.keys(files).length === 0) return toast.error("No readable source files found in that folder");
    setUpload({ name: root || "uploaded-project", files, skipped });
  };

  const shown = (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="annotation">Import</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Bring an existing project</h1>
      <p className="mt-3 text-ink-2">Architect maps the codebase, detects the stack and picks a matching agent framework. You keep working in the Pro lens, with checkpoints from the first commit.</p>

      <div className="mt-8 flex rounded-lg border border-line bg-sunken p-0.5" role="tablist" aria-label="Import source">
        {(
          [
            ["github", "GitHub repository", GitBranch],
            ["upload", "Upload a folder", FolderUp],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm", tab === id ? "bg-elev font-medium shadow-sm" : "text-ink-3 hover:text-ink")}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-elev p-5">
        {tab === "github" ? (
          !githubConfigured ? (
            <p className="text-sm text-ink-2">GitHub isn&apos;t configured on this deployment. Use folder upload instead, or set the GitHub OAuth env vars.</p>
          ) : connected === null ? (
            <div className="flex items-center gap-2 text-sm text-ink-3">
              <Spinner /> Checking your GitHub connection…
            </div>
          ) : !connected ? (
            <form action={oauthAction} className="text-center">
              <input type="hidden" name="provider" value="github" />
              <input type="hidden" name="callbackUrl" value="/import" />
              <GitBranch className="mx-auto h-8 w-8 text-ink-3" />
              <p className="mt-3 font-medium">Connect GitHub to see your repositories</p>
              <p className="mt-1 text-[13px] text-ink-2">Read access to your repos, plus public-repo write so you can push back.</p>
              <Button type="submit" className="mt-4">
                Connect GitHub
              </Button>
            </form>
          ) : (
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your repositories" aria-label="Search repositories" className="pl-9" />
              </div>
              <ul className="mt-3 max-h-96 divide-y divide-line overflow-auto rounded-lg border border-line">
                {shown.length === 0 && <li className="p-4 text-center text-sm text-ink-3">No repositories found.</li>}
                {shown.map((r) => (
                  <li key={r.fullName} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {r.private && <Lock className="h-3 w-3 text-ink-3" aria-label="Private" />}
                        {r.fullName}
                      </p>
                      <p className="truncate text-[12px] text-ink-3">
                        {r.language ?? "—"} {r.updatedAt ? `· updated ${timeAgo(r.updatedAt)}` : ""} {r.description ? `· ${r.description}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => void importBody({ kind: "github", repo: r.fullName }, r.fullName)} loading={importing === r.fullName} disabled={!!importing}>
                      Import
                    </Button>
                  </li>
                ))}
              </ul>
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manual.trim()) void importBody({ kind: "github", repo: manual.trim() }, manual.trim());
                }}
              >
                <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="or paste owner/repo or a GitHub URL" aria-label="Repository" />
                <Button type="submit" variant="secondary" disabled={!manual.trim() || !!importing}>
                  Import
                </Button>
              </form>
            </div>
          )
        ) : upload ? (
          <div>
            <div className="flex items-center gap-3">
              <FolderUp className="h-8 w-8 text-accent" />
              <div className="flex-1">
                <p className="font-medium">{upload.name}</p>
                <p className="text-[13px] text-ink-2">
                  {Object.keys(upload.files).length} source files ready {upload.skipped > 0 && <span className="text-ink-3">· {upload.skipped} skipped (binary, vendored or large)</span>}
                </p>
              </div>
              <Badge tone="accent">Ready</Badge>
            </div>
            <ul className="mt-4 max-h-48 overflow-auto rounded-lg bg-sunken p-3 font-mono text-[12px] text-ink-2">
              {Object.keys(upload.files)
                .sort()
                .slice(0, 50)
                .map((p) => (
                  <li key={p}>{p}</li>
                ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setUpload(null)}>
                Choose another
              </Button>
              <Button onClick={() => void importBody({ kind: "upload", name: upload.name, files: upload.files }, "upload")} loading={importing === "upload"}>
                Import {Object.keys(upload.files).length} files
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center rounded-lg border-2 border-dashed border-line-strong px-6 py-10 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              toast.info("Drag-and-drop of folders varies by browser. Use the button to pick a folder.");
            }}
          >
            <Upload className="h-8 w-8 text-ink-3" />
            <p className="mt-3 font-medium">Pick a project folder</p>
            <p className="mt-1 text-[13px] text-ink-2">Source files are read in your browser. node_modules, builds and binaries are skipped.</p>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              multiple
              // @ts-expect-error non-standard but widely supported folder picker
              webkitdirectory=""
              onChange={(e) => void onFolder(e.target.files)}
              aria-label="Choose folder"
            />
            <Button className="mt-4" variant="secondary" onClick={() => inputRef.current?.click()}>
              Choose folder
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
