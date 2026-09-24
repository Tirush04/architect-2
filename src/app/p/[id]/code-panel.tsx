"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, FilePlus2, Folder, GitCompare, Lock, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Spinner } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { useTheme } from "@/components/theme";
import { buildTree, languageFor, type TreeNode } from "@/lib/file-tree";
import { isSafePath } from "@/lib/engine/file-stream-parser";
import type { Files } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { WorkspaceApi } from "./types";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false, loading: () => <EditorLoading /> });
const DiffEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), { ssr: false, loading: () => <EditorLoading /> });

function EditorLoading() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-3">
      <Spinner /> Loading editor…
    </div>
  );
}

function Tree({ nodes, active, onOpen, depth = 0 }: { nodes: TreeNode[]; active: string; onOpen: (p: string) => void; depth?: number }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <ul role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Files" : undefined}>
      {nodes.map((n) =>
        n.children ? (
          <li key={n.path} role="treeitem" aria-expanded={!closed[n.path]} aria-selected={false}>
            <button onClick={() => setClosed((c) => ({ ...c, [n.path]: !c[n.path] }))} className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[13px] text-ink-2 hover:bg-sunken" style={{ paddingLeft: 8 + depth * 12 }}>
              {closed[n.path] ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <Folder className="h-3.5 w-3.5 text-ink-3" /> {n.name}
            </button>
            {!closed[n.path] && <Tree nodes={n.children} active={active} onOpen={onOpen} depth={depth + 1} />}
          </li>
        ) : (
          <li key={n.path} role="treeitem" aria-selected={active === n.path}>
            <button
              onClick={() => onOpen(n.path)}
              className={cn("flex w-full items-center gap-1.5 truncate rounded px-2 py-1 text-left text-[13px] hover:bg-sunken", active === n.path ? "bg-accent-soft text-accent" : "text-ink-2")}
              style={{ paddingLeft: 22 + depth * 12 }}
            >
              <FileCode2 className="h-3.5 w-3.5 flex-none opacity-70" /> <span className="truncate">{n.name}</span>
            </button>
          </li>
        ),
      )}
    </ul>
  );
}

export function CodePanel({ api }: { api: WorkspaceApi }) {
  const { files, lens, data } = api;
  const paths = useMemo(() => Object.keys(files).sort(), [files]);
  const tree = useMemo(() => buildTree(paths), [paths]);
  const theme = useTheme();
  const [active, setActive] = useState<string>(() => (files["index.html"] !== undefined ? "index.html" : paths[0] ?? ""));
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const [diffAgainst, setDiffAgainst] = useState<number | null>(null);
  const [baseFiles, setBaseFiles] = useState<Files | null>(null);
  const [saving, setSaving] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const readOnly = lens === "GUIDED";

  useEffect(() => {
    if (active && files[active] === undefined) setActive(files["index.html"] !== undefined ? "index.html" : paths[0] ?? "");
  }, [files, active, paths]);

  // On a new version, keep unsaved edits; drop buffers that now match disk, and warn on conflicts.
  const prevFiles = useRef(files);
  useEffect(() => {
    const before = prevFiles.current;
    prevFiles.current = files;
    if (before === files) return;
    setBuffers((b) => {
      const next: Record<string, string> = {};
      for (const [path, content] of Object.entries(b)) {
        if (files[path] === undefined || files[path] === content) continue;
        if (before[path] !== files[path]) toast.warning(`${path} changed in v${data.version}. Your unsaved edits are kept; saving will overwrite it.`);
        next[path] = content;
      }
      return next;
    });
  }, [files, data.version]);

  useEffect(() => {
    if (diffAgainst == null) return setBaseFiles(null);
    let cancelled = false;
    fetch(`/api/projects/${data.project.id}/checkpoints/${diffAgainst}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((j: { files: Files }) => !cancelled && setBaseFiles(j.files))
      .catch(() => toast.error("Couldn't load that version"));
    return () => {
      cancelled = true;
    };
  }, [diffAgainst, data.project.id]);

  const value = buffers[active] ?? files[active] ?? "";
  const dirty = buffers[active] !== undefined && buffers[active] !== files[active];

  const save = useCallback(async () => {
    if (!dirty || readOnly) return;
    setSaving(true);
    const ok = await api.saveFile(active, buffers[active]);
    setSaving(false);
    if (ok) setBuffers((b) => {
      const n = { ...b };
      delete n[active];
      return n;
    });
  }, [active, api, buffers, dirty, readOnly]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  if (paths.length === 0) {
    return (
      <div className="blueprint-grid flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="font-display text-3xl">No code yet</p>
          <p className="mt-2 text-sm text-ink-2">Approve the Blueprint to generate the app and its agents.</p>
        </div>
      </div>
    );
  }

  const previous = data.checkpoints.filter((c) => c.version < data.version);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(160px,220px)_1fr]">
      <div className="flex min-h-0 flex-col border-r border-line bg-elev">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="annotation">Files · v{data.version}</p>
          {!readOnly && (
            <Button variant="ghost" size="icon-sm" onClick={() => setNewOpen(true)} aria-label="New file" title="New file">
              <FilePlus2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-1 pb-3">
          <Tree nodes={tree} active={active} onOpen={setActive} />
        </div>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="flex flex-none items-center gap-2 border-b border-line bg-elev px-3 py-1.5">
          <span className="truncate font-mono text-[12px] text-ink-2">
            {active}
            {dirty && <span className="ml-1 text-accent">●</span>}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <label className="flex items-center gap-1.5 text-[12px] text-ink-3">
              <GitCompare className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Diff</span>
              <select
                value={diffAgainst ?? ""}
                onChange={(e) => setDiffAgainst(e.target.value ? Number(e.target.value) : null)}
                className="h-7 rounded-md border border-line bg-elev px-1.5 text-[12px] text-ink"
                aria-label="Compare with version"
                disabled={previous.length === 0}
              >
                <option value="">off</option>
                {previous.map((c) => (
                  <option key={c.version} value={c.version}>
                    vs v{c.version}
                  </option>
                ))}
              </select>
            </label>
            {readOnly ? (
              <Button size="sm" variant="secondary" onClick={() => api.switchLens("PRO")} title="Editing is available in the Pro lens">
                <Lock className="h-3.5 w-3.5" /> Edit in Pro
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${active}`}
                  title="Delete file"
                  onClick={() => {
                    if (paths.length > 1) void api.saveFile(active, "", true);
                  }}
                  disabled={paths.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={!dirty} loading={saving}>
                  <Save className="h-3.5 w-3.5" /> Save <span className="hidden text-[11px] opacity-70 lg:inline">Ctrl S</span>
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {diffAgainst != null ? (
            baseFiles ? (
              <DiffEditor
                original={baseFiles[active] ?? ""}
                modified={value}
                language={languageFor(active)}
                theme={theme === "dark" ? "vs-dark" : "light"}
                options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, fontSize: 13 }}
              />
            ) : (
              <EditorLoading />
            )
          ) : (
            <Editor
              path={active}
              value={value}
              language={languageFor(active)}
              theme={theme === "dark" ? "vs-dark" : "light"}
              onChange={(v) => setBuffers((b) => ({ ...b, [active]: v ?? "" }))}
              options={{ readOnly, minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false, tabSize: 2 }}
            />
          )}
        </div>
      </div>
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="New file" description="Paths are relative to the project root, like agents/router.py">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const path = String(new FormData(e.currentTarget).get("path") ?? "").trim();
            if (!isSafePath(path)) return toast.error("Use letters, numbers, dashes, dots and slashes");
            if (files[path] !== undefined) return toast.error("That file already exists");
            const ok = await api.saveFile(path, "");
            if (ok) {
              setNewOpen(false);
              setActive(path);
            }
          }}
          className="grid gap-4"
        >
          <Input name="path" placeholder="src/new-file.ts" autoFocus aria-label="File path" className="font-mono" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
