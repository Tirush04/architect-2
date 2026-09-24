"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Copy, ExternalLink, Globe, Loader2, Rocket, RotateCcw, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Input } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import type { WorkspaceApi } from "./types";

type CheckItem = { ok: boolean | "warn"; label: string; hint?: string; action?: { label: string; onClick: () => void } };

export function DeployPanel({ api }: { api: WorkspaceApi }) {
  const { data, live } = api;
  const [envCount, setEnvCount] = useState<number | null>(null);
  const [version, setVersion] = useState<number>(data.version);
  const [domain, setDomain] = useState("");
  const [pendingDomain, setPendingDomain] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const deploying = live?.kind === "deploy" && !live.error;
  const log = live?.kind === "deploy" ? live : api.lastDeploy;
  const current = data.deployments[0];

  useEffect(() => setVersion(data.version), [data.version]);
  useEffect(() => {
    fetch(`/api/projects/${data.project.id}/env`)
      .then((r) => r.json())
      .then((j: { vars: unknown[] }) => setEnvCount(j.vars?.length ?? 0))
      .catch(() => setEnvCount(0));
  }, [data.project.id]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log?.logs.length]);

  const agents = data.blueprint?.agents.length ?? 0;
  const checks: CheckItem[] = [
    { ok: !!data.blueprint, label: "Blueprint approved", action: data.blueprint ? undefined : { label: "Open", onClick: () => api.setTab("blueprint") } },
    { ok: data.version > 0, label: data.version > 0 ? `Build v${data.version} ready` : "App built", action: data.version > 0 ? undefined : { label: "Build", onClick: () => void api.startBuild() } },
    {
      ok: agents === 0 || (envCount ?? 0) > 0 ? true : "warn",
      label: agents ? `${agents} agent${agents === 1 ? "" : "s"} configured` : "No agents to configure",
      hint: agents && !envCount ? "No secrets set. Agents will run with platform-managed keys." : undefined,
      action: agents && !envCount ? { label: "Add secret", onClick: () => api.setTab("settings") } : undefined,
    },
    {
      ok: data.github.connected ? true : "warn",
      label: data.project.githubRepo ? `Synced to ${data.project.githubRepo}` : "GitHub (optional)",
      hint: data.project.githubRepo ? undefined : "Push to GitHub to keep a copy of the code you own.",
    },
  ];
  const blocking = checks.slice(0, 2).some((c) => c.ok !== true);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-elev p-5">
          <div className="min-w-0">
            <p className="annotation">Production</p>
            {current ? (
              <>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full bg-ok shadow-[0_0_0_4px] shadow-ok/20" aria-hidden /> Live · v{current.version}
                </p>
                <a href={current.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm text-accent hover:underline">
                  {current.url} <ExternalLink className="h-3.5 w-3.5 flex-none" />
                </a>
                <p className="mt-1 text-[12px] text-ink-3">Deployed {timeAgo(current.createdAt)}</p>
              </>
            ) : (
              <p className="mt-1 text-lg font-semibold text-ink-2">Not deployed yet</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {current && (
              <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard.writeText(current.url).then(() => toast.success("Link copied"))}>
                <Copy className="h-3.5 w-3.5" /> Copy link
              </Button>
            )}
          </div>
        </div>

        <section className="rounded-xl border border-line bg-elev">
          <div className="border-b border-line px-5 py-3">
            <h3 className="font-semibold">Pre-deploy checklist</h3>
          </div>
          <ul className="divide-y divide-line">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-3 px-5 py-3">
                {c.ok === true ? (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-ok-soft text-ok">
                    <Check className="h-3 w-3" />
                  </span>
                ) : (
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full", c.ok === "warn" ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger")}>
                    <CircleAlert className="h-3 w-3" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{c.label}</p>
                  {c.hint && <p className="text-[12px] text-ink-3">{c.hint}</p>}
                </div>
                {c.action && (
                  <Button size="sm" variant="ghost" onClick={c.action.onClick}>
                    {c.action.label}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Version
              <select value={version} onChange={(e) => setVersion(Number(e.target.value))} className="h-8 rounded-lg border border-line bg-elev px-2 text-[13px] text-ink" disabled={data.checkpoints.length === 0}>
                {data.checkpoints.map((c) => (
                  <option key={c.version} value={c.version}>
                    v{c.version}
                    {c.version === data.version ? " (latest)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button className="ml-auto" size="lg" onClick={() => void api.startDeploy(version)} disabled={blocking || api.busy} loading={deploying}>
              <Rocket className="h-4 w-4" /> {current ? `Deploy v${version}` : "Deploy to production"}
            </Button>
          </div>
        </section>

        {log && (
          <section className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-center gap-2 border-b border-white/10 bg-[#0e1015] px-4 py-2 font-mono text-[12px] text-[#b1b6c1]">
              {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6d8bff]" /> : <Terminal className="h-3.5 w-3.5" />}
              Build log
              <span className="ml-auto flex gap-3">
                {log.steps.map((s) => (
                  <span key={s.id} className={s.state === "done" ? "text-[#4fc58c]" : "text-[#e7b24c]"}>
                    {s.state === "done" ? "✓" : "…"} {s.label}
                  </span>
                ))}
              </span>
            </div>
            <div ref={logRef} className="max-h-72 overflow-auto bg-[#0e1015] p-4 font-mono text-[12.5px] leading-6 text-[#b1b6c1]" role="log" aria-live="polite">
              {log.logs.map((l, i) => (
                <div key={i} className={cn(l.startsWith("✓") && "text-[#4fc58c]", l.startsWith("▲") && "text-white")}>
                  {l}
                </div>
              ))}
              {log.error && <div className="text-[#ff7b6e]">✗ {log.error}</div>}
            </div>
          </section>
        )}

        {data.deployments.length > 0 && (
          <section className="rounded-xl border border-line bg-elev">
            <div className="border-b border-line px-5 py-3">
              <h3 className="font-semibold">Deployments</h3>
            </div>
            <ul className="divide-y divide-line">
              {data.deployments.map((d, i) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Badge tone={i === 0 ? "ok" : "neutral"}>{i === 0 ? "Current" : "Previous"}</Badge>
                  <span className="font-mono text-[12px] text-accent">v{d.version}</span>
                  <span className="text-ink-3">{timeAgo(d.createdAt)}</span>
                  {i > 0 && (
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void api.startDeploy(d.version)} disabled={api.busy}>
                      <RotateCcw className="h-3.5 w-3.5" /> Roll back to v{d.version}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-line bg-elev p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <Globe className="h-4 w-4 text-accent" /> Custom domain
            </h3>
            {pendingDomain ? (
              <div className="mt-3 space-y-2 text-[13px]">
                <p>
                  Add this record at your DNS provider for <span className="font-medium">{pendingDomain}</span>:
                </p>
                <div className="grid grid-cols-[60px_1fr] gap-x-3 gap-y-1 rounded-lg bg-sunken p-3 font-mono text-[12px]">
                  <span className="text-ink-3">Type</span>
                  <span>CNAME</span>
                  <span className="text-ink-3">Value</span>
                  <span>cname.architect.app</span>
                </div>
                <Badge tone="warn">Waiting for DNS · designed flow</Badge>
              </div>
            ) : (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = domain.trim().toLowerCase();
                  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return toast.error("Enter a domain like app.acme.com");
                  setPendingDomain(d);
                }}
              >
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="app.acme.com" aria-label="Custom domain" className="h-9" />
                <Button type="submit" variant="secondary">
                  Add
                </Button>
              </form>
            )}
          </section>
          <section className="rounded-xl border border-line bg-elev p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <Terminal className="h-4 w-4 text-accent" /> Deploy from your terminal
            </h3>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0e1015] p-3 font-mono text-[12px] leading-relaxed text-[#b1b6c1]">
              {`npm i -g @architect/cli
architect login
architect deploy --project ${data.project.id}`}
            </pre>
            <p className="mt-2 text-[12px] text-ink-3">Create an API key in Settings → Developer. The CLI is a designed flow; the REST API is live.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
