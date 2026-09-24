"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Code2,
  Database,
  Eye,
  FileText,
  GitBranch,
  History,
  MessageSquare,
  Rocket,
  Settings2,
  Share2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/logo";
import { Badge, Button } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { postJson } from "@/lib/client-api";
import type { Blueprint, BuildEvent } from "@/lib/schemas";
import type { WorkspaceData } from "@/lib/workspace-data";
import { cn, timeAgo } from "@/lib/utils";
import { StreamError, useStream } from "./use-stream";
import type { LiveRun, RunKind, Selection, Tab, WorkspaceApi } from "./types";
import { ChatPanel } from "./chat-panel";
import { PreviewPanel } from "./preview-panel";
import { BlueprintPanel } from "./blueprint-panel";
import { CodePanel } from "./code-panel";
import { AgentsPanel } from "./agents-panel";
import { DataPanel } from "./data-panel";
import { DeployPanel } from "./deploy-panel";
import { SettingsPanel } from "./settings-panel";
import { GitHubDialog, ShareDialog } from "./dialogs";

const TABS: Record<Tab, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  preview: { label: "Preview", icon: Eye },
  blueprint: { label: "Blueprint", icon: FileText },
  agents: { label: "Agents", icon: Bot },
  code: { label: "Code", icon: Code2 },
  data: { label: "Data", icon: Database },
  deploy: { label: "Deploy", icon: Rocket },
  settings: { label: "Settings", icon: Settings2 },
};
const ORDER: Record<"GUIDED" | "PRO", Tab[]> = {
  GUIDED: ["preview", "blueprint", "agents", "data", "deploy", "settings", "code"],
  PRO: ["preview", "code", "agents", "blueprint", "data", "deploy", "settings"],
};

const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "accent" | "ok" | "warn" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PLANNING: { label: "Planning", tone: "warn" },
  BUILDING: { label: "Building", tone: "warn" },
  READY: { label: "Ready", tone: "accent" },
  DEPLOYED: { label: "Live", tone: "ok" },
};

function emptyRun(kind: RunKind): LiveRun {
  return { kind, steps: [], current: null, written: [], logs: [], engineNote: null, error: null };
}

export function Workspace({ initial, autoStart }: { initial: WorkspaceData; autoStart: boolean }) {
  const [data, setData] = useState(initial);
  const [live, setLive] = useState<LiveRun | null>(null);
  const [lastDeploy, setLastDeploy] = useState<LiveRun | null>(null);
  const liveRef = useRef<LiveRun | null>(null);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);
  const [lens, setLens] = useState<"GUIDED" | "PRO">(initial.project.lens);
  const [tab, setTab] = useState<Tab>(initial.project.source === "import" ? "code" : "preview");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mobilePane, setMobilePane] = useState<"chat" | "canvas">("chat");
  const [dialog, setDialog] = useState<"share" | "github" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const { run, stop } = useStream();
  const started = useRef(false);
  const busy = !!live && !live.error;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${data.project.id}/state`, { cache: "no-store" });
    if (res.ok) setData((await res.json()) as WorkspaceData);
  }, [data.project.id]);

  const apply = useCallback((e: BuildEvent) => {
    setLive((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      switch (e.type) {
        case "engine":
          if (e.engine === "demo" && e.reason) next.engineNote = e.reason;
          break;
        case "step": {
          const steps = prev.steps.filter((s) => s.id !== e.id);
          const idx = prev.steps.findIndex((s) => s.id === e.id);
          const step = { id: e.id, label: e.label, state: e.state };
          if (idx === -1) steps.push(step);
          else steps.splice(idx, 0, step);
          next.steps = steps;
          break;
        }
        case "file_start":
          next.current = { path: e.path, content: "" };
          break;
        case "file_delta":
          next.current = prev.current?.path === e.path ? { path: e.path, content: prev.current.content + e.chunk } : { path: e.path, content: e.chunk };
          break;
        case "file":
          next.written = prev.written.includes(e.path) ? prev.written : [...prev.written, e.path];
          next.current = { path: e.path, content: e.content };
          break;
        case "blueprint":
          setData((d) => ({ ...d, blueprint: e.blueprint }));
          break;
        case "text":
          next.logs = [...prev.logs, e.text];
          break;
        case "error":
          next.error = e.message;
          break;
      }
      return next;
    });
  }, []);

  const execute = useCallback(
    async (kind: RunKind, url: string, body: unknown, after?: (last: BuildEvent | null) => void) => {
      setLive(emptyRun(kind));
      let last: BuildEvent | null = null;
      try {
        await run(url, body, (e) => {
          last = e;
          apply(e);
        });
        await refresh();
        if (last && (last as BuildEvent).type === "error") {
          toast.error((last as Extract<BuildEvent, { type: "error" }>).message);
        } else {
          after?.(last);
          if (kind === "deploy" && liveRef.current) setLastDeploy(liveRef.current);
          setLive(null);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          toast.message("Stopped");
          setLive(null);
          await refresh();
          return;
        }
        const message = err instanceof Error ? err.message : "Something went wrong";
        setLive((p) => (p ? { ...p, error: message } : p));
        if (err instanceof StreamError) toast.error(message);
      }
    },
    [apply, refresh, run],
  );

  const pid = data.project.id;
  const startPlan = useCallback(
    (prompt?: string) => execute("plan", `/api/projects/${pid}/plan`, { prompt }, () => setTab("blueprint")),
    [execute, pid],
  );
  const startBuild = useCallback(() => {
    setTab("preview");
    return execute("build", `/api/projects/${pid}/build`, {}, () => toast.success("Build complete"));
  }, [execute, pid]);
  const sendChat = useCallback(
    (message: string, sel?: Selection) => {
      setSelection(null);
      setData((d) => ({
        ...d,
        messages: [...d.messages, { id: `tmp-${Date.now()}`, role: "user", content: message, meta: sel ? { selection: sel } : null, createdAt: new Date().toISOString() }],
      }));
      if (!data.blueprint) return startPlan(message);
      if (data.version === 0) return startBuild();
      return execute("edit", `/api/projects/${pid}/chat`, { message, selection: sel });
    },
    [data.blueprint, data.version, execute, pid, startBuild, startPlan],
  );
  const startDeploy = useCallback(
    (version?: number) => {
      setTab("deploy");
      return execute("deploy", `/api/projects/${pid}/deploy`, { version }, () => toast.success("Your app is live"));
    },
    [execute, pid],
  );

  const saveBlueprint = useCallback(
    async (bp: Blueprint) => {
      try {
        await postJson(`/api/projects/${pid}`, { blueprint: bp }, "PATCH");
        await refresh();
        toast.success(data.version ? "Blueprint saved and applied" : "Blueprint saved");
        return true;
      } catch (e) {
        toast.error((e as Error).message);
        return false;
      }
    },
    [data.version, pid, refresh],
  );

  const patchProject = useCallback(
    async (patch: { name?: string; framework?: string; lens?: "GUIDED" | "PRO" }) => {
      try {
        await postJson(`/api/projects/${pid}`, patch, "PATCH");
        await refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [pid, refresh],
  );

  const restore = useCallback(
    async (version: number) => {
      try {
        await postJson(`/api/projects/${pid}/restore`, { version });
        await refresh();
        toast.success(`Restored v${version}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [pid, refresh],
  );

  const saveFile = useCallback(
    async (path: string, content: string, remove?: boolean) => {
      try {
        const r = await postJson<{ version: number; unchanged?: boolean }>(`/api/projects/${pid}/files`, { path, content, remove });
        await refresh();
        if (!r.unchanged) toast.success(`Saved as v${r.version}`);
        return true;
      } catch (e) {
        toast.error((e as Error).message);
        return false;
      }
    },
    [pid, refresh],
  );

  const switchLens = useCallback(
    (next: "GUIDED" | "PRO") => {
      setLens(next);
      void postJson(`/api/projects/${pid}`, { lens: next }, "PATCH").catch(() => {});
    },
    [pid],
  );

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void startPlan();
    }
  }, [autoStart, startPlan]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && /^[1-7]$/.test(e.key)) {
        const t = ORDER[lens][Number(e.key) - 1];
        if (t) {
          e.preventDefault();
          setTab(t);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lens]);

  const api: WorkspaceApi = useMemo(
    () => ({
      data,
      live,
      lastDeploy,
      lens,
      busy,
      setTab,
      switchLens,
      refresh,
      startPlan,
      startBuild,
      sendChat,
      startDeploy,
      stop,
      saveBlueprint,
      patchProject,
      restore,
      saveFile,
      selection,
      setSelection,
      files: data.files,
    }),
    [data, live, lastDeploy, lens, busy, switchLens, refresh, startPlan, startBuild, sendChat, startDeploy, stop, saveBlueprint, patchProject, restore, saveFile, selection],
  );

  const status = STATUS_LABEL[busy ? (live?.kind === "plan" ? "PLANNING" : live?.kind === "deploy" ? data.project.status : "BUILDING") : data.project.status] ?? STATUS_LABEL.DRAFT;
  const liveUrl = data.project.shareSlug && data.deployments.length ? data.deployments[0].url : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-12 flex-none items-center gap-2 border-b border-line bg-elev px-2 sm:px-3">
        <Link href="/home" aria-label="Back to projects" className="rounded-md p-1 hover:bg-sunken">
          <LogoMark className="h-6 w-6" />
        </Link>
        <span className="text-ink-3" aria-hidden>
          /
        </span>
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
              setEditingName(false);
              if (name && name !== data.project.name) void patchProject({ name });
            }}
          >
            <input
              name="name"
              defaultValue={data.project.name}
              autoFocus
              maxLength={80}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              aria-label="Project name"
              className="h-8 w-48 rounded-md border border-accent bg-elev px-2 text-sm outline-none"
            />
          </form>
        ) : (
          <button onClick={() => setEditingName(true)} className="max-w-[40vw] truncate rounded-md px-1.5 py-1 text-sm font-medium hover:bg-sunken" title="Rename">
            {data.project.name}
          </button>
        )}
        <Badge tone={status.tone} className="hidden sm:inline-flex">
          {busy && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
          {status.label}
        </Badge>
        <Badge tone={data.engine.mode === "claude" ? "accent" : "neutral"} className="hidden md:inline-flex" title={data.engine.reason ?? "Real AI generation"}>
          <Sparkles className="h-3 w-3" />
          {data.engine.mode === "claude" ? "AI engine" : "Demo engine"}
        </Badge>

        <div className="mx-auto flex rounded-lg border border-line bg-sunken p-0.5" role="radiogroup" aria-label="Lens">
          {(["GUIDED", "PRO"] as const).map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={lens === l}
              onClick={() => switchLens(l)}
              className={cn("rounded-md px-2.5 py-1 text-[12.5px] transition sm:px-3", lens === l ? "bg-elev font-medium text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
            >
              {l === "GUIDED" ? "Guided" : "Pro"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <div className="relative hidden sm:block">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen((o) => !o)} aria-expanded={historyOpen} aria-haspopup="menu" disabled={data.checkpoints.length === 0}>
              <History className="h-4 w-4" /> v{data.version}
            </Button>
            {historyOpen && (
              <div role="menu" className="absolute right-0 z-30 mt-1 max-h-96 w-80 overflow-auto rounded-xl border border-line bg-elev p-1 shadow-card" onMouseLeave={() => setHistoryOpen(false)}>
                <p className="annotation px-3 py-2">Checkpoints</p>
                {data.checkpoints.map((c) => (
                  <div key={c.version} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-sunken">
                    <span className="mt-0.5 font-mono text-[12px] text-accent">v{c.version}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">{c.summary}</p>
                      <p className="text-[11px] text-ink-3">
                        {timeAgo(c.createdAt)} · {c.engine}
                      </p>
                    </div>
                    {c.version !== data.version && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          setHistoryOpen(false);
                          void restore(c.version);
                        }}
                        className="rounded-md px-2 py-1 text-[12px] text-accent hover:bg-accent-soft"
                        disabled={busy}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDialog("share")} className="hidden sm:inline-flex">
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setDialog("github")} aria-label="GitHub" title={data.project.githubRepo ?? "GitHub"}>
            <GitBranch className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <Button size="sm" onClick={() => setTab("deploy")} disabled={data.version === 0}>
            <Rocket className="h-4 w-4" /> <span className="hidden sm:inline">{liveUrl ? "Redeploy" : "Deploy"}</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "min-h-0 w-full flex-none flex-col border-r border-line bg-elev md:flex md:w-[380px] lg:w-[420px]",
            mobilePane === "chat" ? "flex" : "hidden",
          )}
          aria-label="Chat"
        >
          <ChatPanel api={api} />
        </aside>
        <section className={cn("min-h-0 min-w-0 flex-1 flex-col md:flex", mobilePane === "canvas" ? "flex" : "hidden")}>
          <div role="tablist" aria-label="Workspace" className="flex flex-none items-center gap-0.5 overflow-x-auto border-b border-line bg-bg px-2">
            {ORDER[lens].map((t) => {
              const T = TABS[t];
              const proOnly = lens === "GUIDED" && t === "code";
              return (
                <button
                  key={t}
                  role="tab"
                  id={`tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`panel-${t}`}
                  onClick={() => setTab(t)}
                  className={cn(
                    "relative flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] transition",
                    tab === t ? "text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent" : "text-ink-3 hover:text-ink",
                  )}
                >
                  <T.icon className="h-4 w-4" />
                  {T.label}
                  {proOnly && <span className="rounded bg-sunken px-1 text-[10px] text-ink-3">Pro</span>}
                  {t === "deploy" && liveUrl && <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-label="Live" />}
                </button>
              );
            })}
          </div>
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-hidden">
            {tab === "preview" && <PreviewPanel api={api} />}
            {tab === "blueprint" && <BlueprintPanel api={api} />}
            {tab === "agents" && <AgentsPanel api={api} />}
            {tab === "code" && <CodePanel api={api} />}
            {tab === "data" && <DataPanel api={api} />}
            {tab === "deploy" && <DeployPanel api={api} />}
            {tab === "settings" && <SettingsPanel api={api} />}
          </div>
        </section>
      </div>

      <nav className="flex flex-none border-t border-line bg-elev md:hidden" aria-label="Panes">
        {(["chat", "canvas"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setMobilePane(p)}
            aria-pressed={mobilePane === p}
            className={cn("flex flex-1 items-center justify-center gap-2 py-3 text-sm", mobilePane === p ? "font-medium text-accent" : "text-ink-3")}
          >
            {p === "chat" ? <MessageSquare className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {p === "chat" ? "Chat" : "App"}
          </button>
        ))}
      </nav>

      <ShareDialog open={dialog === "share"} onClose={() => setDialog(null)} api={api} />
      <GitHubDialog open={dialog === "github"} onClose={() => setDialog(null)} api={api} />
    </div>
  );
}
