"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, Monitor, MousePointerClick, RotateCw, Smartphone, Sparkles, Tablet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { PREVIEW_SANDBOX } from "@/lib/share";
import type { Blueprint } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { LiveRun, WorkspaceApi } from "./types";

const SELECT_SCRIPT = `<script>(function(){var last=null;function sel(el){var parts=[];while(el&&el.nodeType===1&&parts.length<4&&el!==document.body){var s=el.tagName.toLowerCase();if(el.id){parts.unshift(s+'#'+el.id);break;}var a=el.getAttribute('data-arch-id');if(a){parts.unshift(s+'[data-arch-id="'+a+'"]');break;}var p=el.parentElement;if(p){s+=':nth-child('+(Array.prototype.indexOf.call(p.children,el)+1)+')';}parts.unshift(s);el=el.parentElement;}return parts.join(' > ')||'body';}
var st=document.createElement('style');st.textContent='.__arch_hover{outline:2px solid #2346d8!important;outline-offset:2px!important;cursor:crosshair!important}';document.head.appendChild(st);
document.addEventListener('mouseover',function(e){if(last)last.classList.remove('__arch_hover');last=e.target;if(last&&last.classList)last.classList.add('__arch_hover');},true);
document.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var t=e.target;if(t&&t.classList)t.classList.remove('__arch_hover');parent.postMessage({__architect:'select',selector:sel(t),text:((t&&t.innerText)||'').trim().slice(0,120)},'*');},true);})();</script>`;

function withSelectMode(html: string): string {
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i === -1 ? html + SELECT_SCRIPT : html.slice(0, i) + SELECT_SCRIPT + html.slice(i);
}

const DEVICES = {
  desktop: { icon: Monitor, width: "100%", label: "Desktop" },
  tablet: { icon: Tablet, width: "820px", label: "Tablet" },
  mobile: { icon: Smartphone, width: "390px", label: "Phone" },
} as const;

export function PreviewPanel({ api }: { api: WorkspaceApi }) {
  const { data, live, files, setSelection } = api;
  const [device, setDevice] = useState<keyof typeof DEVICES>("desktop");
  const [selectMode, setSelectMode] = useState(false);
  const [nonce, setNonce] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const html = files["index.html"];

  const srcDoc = useMemo(() => (html ? (selectMode ? withSelectMode(html) : html) : ""), [html, selectMode]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const d = e.data as { __architect?: string; selector?: unknown; text?: unknown };
      if (d?.__architect !== "select" || typeof d.selector !== "string") return;
      setSelection({ selector: d.selector.slice(0, 300), text: typeof d.text === "string" ? d.text.slice(0, 300) : "" });
      setSelectMode(false);
      toast.message("Element selected. Describe the change in chat.");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setSelection]);

  if (live && (live.kind === "build" || live.kind === "edit") && !live.error) return <BuildingView live={live} />;
  if (live && live.kind === "plan" && !live.error) return <PlanningView live={live} />;

  if (!html) {
    if (data.blueprint) return <WireframeView bp={data.blueprint} onBuild={() => void api.startBuild()} built={data.version > 0} busy={api.busy} />;
    return (
      <Empty
        title="Your app will appear here"
        body="Describe what you want in the chat. Architect drafts a Blueprint with wireframes first, then builds the app live."
      />
    );
  }

  const liveUrl = data.deployments[0]?.url;
  const host = data.project.shareSlug ? `${data.project.shareSlug}.architect.app` : `preview.architect.app/${data.project.id.slice(-6)}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none items-center gap-2 border-b border-line bg-elev px-3 py-2">
        <div className="flex rounded-lg border border-line bg-sunken p-0.5" role="radiogroup" aria-label="Device">
          {(Object.keys(DEVICES) as Array<keyof typeof DEVICES>).map((d) => {
            const D = DEVICES[d];
            return (
              <button
                key={d}
                role="radio"
                aria-checked={device === d}
                aria-label={D.label}
                title={D.label}
                onClick={() => setDevice(d)}
                className={cn("rounded-md p-1.5", device === d ? "bg-elev text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
              >
                <D.icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-1.5 text-[12px] text-ink-3">
          <span className="h-2 w-2 flex-none rounded-full bg-ok" aria-hidden />
          <span className="truncate">{host}</span>
          <span className="ml-auto flex-none font-mono text-[11px]">v{data.version}</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setNonce((n) => n + 1)} aria-label="Reload preview" title="Reload">
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={selectMode ? "primary" : "secondary"}
          size="sm"
          onClick={() => setSelectMode((s) => !s)}
          aria-pressed={selectMode}
          title="Click an element in the preview to edit it"
        >
          <MousePointerClick className="h-3.5 w-3.5" /> <span className="hidden lg:inline">{selectMode ? "Click an element…" : "Select to edit"}</span>
        </Button>
        {liveUrl && (
          <a href={liveUrl} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Open live app" title="Open live app">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className={cn("flex min-h-0 flex-1 justify-center overflow-auto", device === "desktop" ? "bg-elev" : "blueprint-grid bg-sunken p-6")}>
        <iframe
          key={nonce}
          ref={frameRef}
          title="App preview"
          srcDoc={srcDoc}
          sandbox={PREVIEW_SANDBOX}
          style={{ width: DEVICES[device].width }}
          className={cn("h-full max-w-full border-0 bg-white", device !== "desktop" && "rounded-2xl border border-line shadow-card", selectMode && "ring-2 ring-accent")}
        />
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="blueprint-grid flex h-full items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <Sparkles className="mx-auto h-8 w-8 text-accent" aria-hidden />
        <p className="mt-4 font-display text-3xl">{title}</p>
        <p className="mt-2 text-sm text-ink-2">{body}</p>
      </div>
    </div>
  );
}

function PlanningView({ live }: { live: LiveRun }) {
  return (
    <div className="blueprint-grid flex h-full items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-line bg-elev p-6 shadow-card">
        <p className="annotation">Plan mode</p>
        <p className="mt-2 font-display text-3xl">Drafting the Blueprint</p>
        <ul className="mt-5 space-y-2.5">
          {live.steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 text-sm">
              {s.state === "done" ? <Check className="h-4 w-4 text-ok" /> : <Loader2 className="h-4 w-4 animate-spin text-accent" />}
              <span className={s.state === "done" ? "text-ink-2" : "text-ink"}>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BuildingView({ live }: { live: LiveRun }) {
  const codeRef = useRef<HTMLPreElement>(null);
  const content = live.current?.content ?? "";
  const lines = content.split("\n");
  const tail = lines.slice(-60);
  const offset = lines.length - tail.length;
  useEffect(() => {
    codeRef.current?.scrollTo({ top: codeRef.current.scrollHeight });
  }, [content]);
  const done = live.steps.filter((s) => s.state === "done").length;
  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[280px_1fr]">
      <div className="border-b border-line bg-elev p-5 lg:border-b-0 lg:border-r">
        <p className="annotation">UI being built</p>
        <p className="mt-2 text-lg font-semibold">{live.kind === "edit" ? "Applying your change" : "Building your app"}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={done}>
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(8, (done / Math.max(4, live.steps.length)) * 100)}%` }} />
        </div>
        <ul className="mt-5 space-y-2.5">
          {live.steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 text-[13px]">
              {s.state === "done" ? <Check className="h-4 w-4 text-ok" /> : <Loader2 className="h-4 w-4 animate-spin text-accent" />}
              {s.label}
            </li>
          ))}
        </ul>
        {live.engineNote && <p className="mt-4 rounded-md bg-warn-soft px-2 py-1.5 text-[12px] text-warn">{live.engineNote}</p>}
        {live.written.length > 0 && (
          <div className="mt-5">
            <p className="annotation mb-2">Files written</p>
            <ul className="space-y-1 font-mono text-[12px] text-ink-2">
              {live.written.map((p) => (
                <li key={p} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-ok" /> {p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-col bg-[#0e1015]">
        <div className="flex flex-none items-center gap-2 border-b border-white/10 px-4 py-2 font-mono text-[12px] text-[#b1b6c1]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6d8bff]" /> {live.current?.path ?? "preparing…"}
          <span className="ml-auto text-[#7d8391]">{lines.length} lines</span>
        </div>
        <pre ref={codeRef} className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[12px] leading-5 text-[#b1b6c1]" aria-label="Code being written">
          {tail.map((l, i) => (
            <div key={offset + i} className="flex">
              <span className="w-10 flex-none select-none pr-3 text-right text-[#4a4f5a]">{offset + i + 1}</span>
              <span className={cn("whitespace-pre-wrap break-all", i === tail.length - 1 && "caret")}>{l}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function WireframeView({ bp, onBuild, built, busy }: { bp: Blueprint; onBuild: () => void; built: boolean; busy: boolean }) {
  const [page, setPage] = useState(0);
  const p = bp.pages[page] ?? bp.pages[0];
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none items-center gap-3 border-b border-line bg-elev px-4 py-2.5">
        <p className="annotation">Wireframes · Plan mode</p>
        {!built && (
          <Button size="sm" className="ml-auto" onClick={onBuild} disabled={busy}>
            Approve &amp; build
          </Button>
        )}
      </div>
      <div className="blueprint-grid min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Pages">
            {bp.pages.map((pg, i) => (
              <button
                key={pg.name + i}
                role="tab"
                aria-selected={i === page}
                onClick={() => setPage(i)}
                className={cn("rounded-md border px-2.5 py-1 font-mono text-[12px]", i === page ? "border-accent bg-accent-soft text-accent" : "border-line bg-elev text-ink-2")}
              >
                {pg.name}
              </button>
            ))}
          </div>
          <div className="rounded-xl border-2 border-dashed border-accent/40 bg-elev/80 p-5">
            <div className="flex items-center justify-between border-b border-dashed border-accent/30 pb-3">
              <p className="font-mono text-[13px] text-accent">{bp.appName} / {p?.name}</p>
              <p className="max-w-[60%] truncate text-[12px] text-ink-3">{p?.purpose}</p>
            </div>
            <div className="mt-4 grid grid-cols-[140px_1fr] gap-4">
              <div className="space-y-2">
                {bp.pages.map((pg, i) => (
                  <div key={pg.name + i} className={cn("rounded border border-dashed px-2 py-1.5 font-mono text-[11px]", i === page ? "border-accent text-accent" : "border-line-strong text-ink-3")}>
                    {pg.name}
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(p?.components.length ? p.components : ["Content"]).map((c, i) => (
                  <div key={c + i} className={cn("flex items-center justify-center rounded-lg border border-dashed border-line-strong bg-sunken/60 p-4 font-mono text-[12px] text-ink-3", i === 0 && "sm:col-span-2 h-24")}>
                    [ {c} ]
                  </div>
                ))}
              </div>
            </div>
          </div>
          {!built && <p className="mt-4 text-center text-[13px] text-ink-2">These are wireframes from your Blueprint. Nothing is built yet. Edit the Blueprint or approve it to build.</p>}
        </div>
      </div>
    </div>
  );
}
