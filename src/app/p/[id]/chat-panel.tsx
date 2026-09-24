"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  Check,
  CircleAlert,
  ExternalLink,
  FileCode2,
  FolderTree,
  GitBranch,
  Loader2,
  MousePointerClick,
  Rocket,
  Square,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { FileChange } from "@/lib/diff";
import type { CodebaseMap } from "@/lib/github";
import type { WorkspaceMessage } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import type { LiveRun, WorkspaceApi } from "./types";

const SUGGESTIONS = {
  GUIDED: ["Make it dark", "Use a green accent", "Add a page called Reports", "Add an agent that sends weekly summaries"],
  PRO: ["Add a page called Audit Log", "Use #0f766e as the accent", "Add an agent that flags duplicate records", "/deploy"],
};

export function ChatPanel({ api }: { api: WorkspaceApi }) {
  const { data, live, busy, lens, selection, setSelection } = api;
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [data.messages.length, live?.steps.length, live?.written.length, live?.error]);

  useEffect(() => {
    if (selection) inputRef.current?.focus();
  }, [selection]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const send = (value = text) => {
    const msg = value.trim();
    if (!msg || busy) return;
    setText("");
    if (msg === "/deploy") return void api.startDeploy();
    if (msg === "/build") return void api.startBuild();
    void api.sendChat(msg, selection ?? undefined);
  };

  const built = data.version > 0;
  const planned = !!data.blueprint;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
        {data.messages.length === 0 && !live && (
          <div className="rounded-xl border border-dashed border-line-strong p-5 text-sm text-ink-2">
            <p className="font-medium text-ink">Start with the job to be done.</p>
            <p className="mt-1">Architect drafts a Blueprint first. You approve it, then it builds.</p>
          </div>
        )}
        {data.messages.map((m) => (
          <MessageView key={m.id} m={m} api={api} />
        ))}
        {live && <LiveCard live={live} onRetry={() => (live.kind === "plan" ? api.startPlan() : live.kind === "build" ? api.startBuild() : undefined)} />}
      </div>

      <div className="flex-none border-t border-line p-3">
        {!busy && planned && !built && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft p-3">
            <p className="flex-1 text-[13px] text-ink">Happy with the Blueprint? Approve it and I&apos;ll build.</p>
            <Button size="sm" onClick={() => void api.startBuild()}>
              Approve &amp; build
            </Button>
          </div>
        )}
        {!busy && built && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {SUGGESTIONS[lens].map((s) => (
              <button key={s} onClick={() => send(s)} className="flex-none rounded-full border border-line bg-bg px-2.5 py-1 text-[12px] text-ink-2 hover:border-accent hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        )}
        {selection && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1.5 text-[12px] text-accent">
            <MousePointerClick className="h-3.5 w-3.5 flex-none" />
            <span className="truncate">
              Editing <span className="font-mono">{selection.selector}</span>
              {selection.text ? ` · “${selection.text.slice(0, 40)}”` : ""}
            </span>
            <button onClick={() => setSelection(null)} aria-label="Clear selection" className="ml-auto rounded p-0.5 hover:bg-accent/10">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 rounded-xl border border-line bg-bg p-1.5 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message Architect
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={
              !planned ? "Describe what you want to build…" : !built ? "Ask for changes to the plan, or approve it above" : lens === "PRO" ? "Describe a change, or /deploy" : "Describe a change in plain English…"
            }
            className="max-h-44 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-ink-3"
          />
          {busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={api.stop} aria-label="Stop">
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Send">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </form>
        <p className="mt-1.5 px-1 text-[11px] text-ink-3">
          {data.engine.mode === "demo" ? "Demo engine: common edits work offline. " : `${data.engine.limit - data.engine.used} AI turns left today. `}
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}

function MessageView({ m, api }: { m: WorkspaceMessage; api: WorkspaceApi }) {
  const kind = (m.meta?.kind as string | undefined) ?? null;
  if (m.role === "user") {
    const sel = m.meta?.selection as { selector: string; text: string } | undefined;
    return (
      <div className="ml-auto max-w-[88%]">
        {sel && (
          <p className="mb-1 text-right text-[11px] text-ink-3">
            <MousePointerClick className="mr-1 inline h-3 w-3" />
            on {sel.text ? `“${sel.text.slice(0, 30)}”` : sel.selector}
          </p>
        )}
        <div className="whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-[14px] text-accent-ink">{m.content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md bg-accent-soft text-accent" aria-hidden>
        <Bot className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        {kind === "blueprint" ? (
          <BlueprintCard api={api} content={m.content} />
        ) : kind === "build" ? (
          <BuildCard m={m} lens={api.lens} />
        ) : kind === "deploy" ? (
          <LinkCard icon={<Rocket className="h-4 w-4" />} title={`Deployed v${m.meta?.version}`} url={String(m.meta?.url ?? "")} />
        ) : kind === "github" ? (
          <LinkCard icon={<GitBranch className="h-4 w-4" />} title={m.content} url={String(m.meta?.url ?? "")} />
        ) : kind === "import" ? (
          <ImportCard content={m.content} map={m.meta?.map as CodebaseMap} />
        ) : (
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{m.content}</p>
        )}
      </div>
    </div>
  );
}

function BlueprintCard({ api, content }: { api: WorkspaceApi; content: string }) {
  const bp = api.data.blueprint;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg">
      <div className="border-b border-line bg-sunken/60 px-3.5 py-2">
        <p className="annotation">Blueprint · {bp?.appName}</p>
      </div>
      <div className="p-3.5">
        <p className="text-[14px] leading-relaxed">{content}</p>
        {bp && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              [bp.pages.length, "pages"],
              [bp.dataModel.length, bp.dataModel.length === 1 ? "entity" : "entities"],
              [bp.agents.length, bp.agents.length === 1 ? "agent" : "agents"],
            ].map(([n, l]) => (
              <div key={String(l)} className="rounded-lg border border-line bg-elev py-2">
                <p className="text-lg font-semibold">{n}</p>
                <p className="text-[11px] text-ink-3">{l}</p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {api.data.version === 0 && (
            <Button size="sm" onClick={() => void api.startBuild()} disabled={api.busy}>
              Approve &amp; build
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => api.setTab("blueprint")}>
            {api.data.version === 0 ? "Review & edit" : "Open Blueprint"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BuildCard({ m, lens }: { m: WorkspaceMessage; lens: "GUIDED" | "PRO" }) {
  const changes = (m.meta?.changes as FileChange[] | undefined) ?? [];
  const engine = m.meta?.engine as string | undefined;
  const [open, setOpen] = useState(lens === "PRO");
  const added = changes.reduce((n, c) => n + c.added, 0);
  const removed = changes.reduce((n, c) => n + c.removed, 0);
  return (
    <div className="rounded-xl border border-line bg-bg p-3.5">
      <div className="mb-1.5 flex items-center gap-2">
        <Badge tone="accent">v{String(m.meta?.version ?? "")}</Badge>
        {engine && <span className="text-[11px] text-ink-3">{engine === "claude" ? "AI engine" : engine === "demo" ? "demo engine" : engine}</span>}
      </div>
      <p className="text-[14px] leading-relaxed">{m.content}</p>
      {changes.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setOpen((o) => !o)} className="text-[12px] text-ink-3 hover:text-ink" aria-expanded={open}>
            {changes.length} file{changes.length === 1 ? "" : "s"} changed <span className="text-ok">+{added}</span> <span className="text-danger">−{removed}</span>
          </button>
          {open && (
            <ul className="mt-1.5 space-y-0.5 font-mono text-[11.5px]">
              {changes.map((c) => (
                <li key={c.path} className="flex items-center gap-2 text-ink-2">
                  <FileCode2 className="h-3 w-3 flex-none text-ink-3" />
                  <span className="truncate">{c.path}</span>
                  <span className="ml-auto flex-none text-ok">+{c.added}</span>
                  <span className="flex-none text-danger">−{c.removed}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LinkCard({ icon, title, url }: { icon: React.ReactNode; title: string; url: string }) {
  return (
    <div className="rounded-xl border border-ok/30 bg-ok-soft p-3.5">
      <p className="flex items-center gap-2 text-[14px] font-medium text-ok">
        {icon} {title}
      </p>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[13px] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
          {url} <ExternalLink className="h-3 w-3 flex-none" />
        </a>
      )}
    </div>
  );
}

function ImportCard({ content, map }: { content: string; map?: CodebaseMap }) {
  const max = Math.max(1, ...(map?.topDirs.map((d) => d.files) ?? [1]));
  return (
    <div className="rounded-xl border border-line bg-bg p-3.5">
      <p className="text-[14px] leading-relaxed">{content}</p>
      {map && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {map.stack.map((s) => (
              <Badge key={s} tone="accent">
                {s}
              </Badge>
            ))}
          </div>
          <div>
            <p className="annotation mb-1.5 flex items-center gap-1">
              <FolderTree className="h-3 w-3" /> Structure
            </p>
            {map.topDirs.map((d) => (
              <div key={d.dir} className="flex items-center gap-2 text-[12px]">
                <span className="w-24 truncate font-mono text-ink-2">{d.dir}</span>
                <span className="h-1.5 flex-1 rounded-full bg-sunken">
                  <span className="block h-full rounded-full bg-accent/60" style={{ width: `${(d.files / max) * 100}%` }} />
                </span>
                <span className="w-8 text-right text-ink-3">{d.files}</span>
              </div>
            ))}
          </div>
          {map.entryPoints.length > 0 && (
            <p className="text-[12px] text-ink-3">
              Entry points: <span className="font-mono text-ink-2">{map.entryPoints.join(", ")}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const TITLES: Record<LiveRun["kind"], string> = {
  plan: "Drafting your Blueprint",
  build: "Building your app",
  edit: "Applying your change",
  deploy: "Deploying",
};

function LiveCard({ live, onRetry }: { live: LiveRun; onRetry: () => void }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md bg-accent-soft text-accent" aria-hidden>
        <Bot className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-line bg-bg p-3.5">
        <p className="mb-2 text-[14px] font-medium">{TITLES[live.kind]}</p>
        {live.engineNote && <p className="mb-2 rounded-md bg-warn-soft px-2 py-1 text-[12px] text-warn">{live.engineNote}</p>}
        <ul className="space-y-1.5">
          {live.steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[13px]">
              {s.state === "done" ? <Check className="h-3.5 w-3.5 text-ok" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
              <span className={cn(s.state === "done" ? "text-ink-2" : "text-ink")}>{s.label}</span>
            </li>
          ))}
          {live.steps.length === 0 && !live.error && (
            <li className="flex items-center gap-2 text-[13px] text-ink-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…
            </li>
          )}
        </ul>
        {live.written.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {live.written.map((p) => (
              <span key={p} className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                {p}
              </span>
            ))}
            {live.current && !live.written.includes(live.current.path) && (
              <span className="animate-pulse rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] text-accent">{live.current.path}</span>
            )}
          </div>
        )}
        {live.error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-soft p-2.5 text-[13px] text-danger" role="alert">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-none" />
            <div className="flex-1">
              <p>{live.error}</p>
              {(live.kind === "plan" || live.kind === "build") && (
                <button onClick={onRetry} className="mt-1 font-medium underline">
                  Try again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
