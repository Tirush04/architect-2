"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Bot, Plus, Trash2, X } from "lucide-react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { FIELD_TYPES, type Blueprint } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { WorkspaceApi } from "./types";

function Section({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-elev">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h3 className="text-[14px] font-semibold">{title}</h3>
          {hint && <p className="text-[12px] text-ink-3">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function BlueprintPanel({ api }: { api: WorkspaceApi }) {
  const source = api.data.blueprint;
  const [draft, setDraft] = useState<Blueprint | null>(source);
  const [saving, setSaving] = useState(false);
  const [newIntegration, setNewIntegration] = useState("");

  useEffect(() => setDraft(source), [source]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(source), [draft, source]);

  if (!draft) {
    return (
      <div className="blueprint-grid flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="font-display text-3xl">No Blueprint yet</p>
          <p className="mt-2 text-sm text-ink-2">Describe your app in the chat and Architect will draft one for you to review here.</p>
        </div>
      </div>
    );
  }

  const set = (fn: (d: Blueprint) => void) =>
    setDraft((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      fn(next);
      return next;
    });

  const built = api.data.version > 0;
  const imported = api.data.project.source === "import";

  const save = async (then?: "build") => {
    setSaving(true);
    const ok = await api.saveBlueprint(draft);
    setSaving(false);
    if (ok && then === "build") void api.startBuild();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 p-6">
          <div>
            <p className="annotation">Blueprint · the plan you approve</p>
            <h2 className="mt-1 font-display text-4xl tracking-tight">{draft.appName}</h2>
            <p className="mt-1 text-ink-2">{draft.tagline}</p>
          </div>

          <Section title="Overview" hint="Plain-English description anyone on the team can approve">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="bp-name">App name</Label>
                <Input id="bp-name" value={draft.appName} maxLength={60} onChange={(e) => set((d) => void (d.appName = e.target.value))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bp-aud">Who it&apos;s for</Label>
                <Input id="bp-aud" value={draft.audience} maxLength={120} onChange={(e) => set((d) => void (d.audience = e.target.value))} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="bp-tag">Tagline</Label>
                <Input id="bp-tag" value={draft.tagline} maxLength={140} onChange={(e) => set((d) => void (d.tagline = e.target.value))} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="bp-sum">Summary</Label>
                <Textarea id="bp-sum" rows={3} value={draft.summary} maxLength={800} onChange={(e) => set((d) => void (d.summary = e.target.value))} />
              </div>
            </div>
          </Section>

          <Section
            title={`Pages (${draft.pages.length})`}
            hint="What users will see, in navigation order"
            action={
              <Button size="sm" variant="secondary" onClick={() => set((d) => void d.pages.push({ name: "New page", purpose: "", components: [] }))}>
                <Plus className="h-3.5 w-3.5" /> Page
              </Button>
            }
          >
            <ul className="space-y-3">
              {draft.pages.map((p, i) => (
                <li key={i} className="grid gap-2 rounded-lg border border-line bg-bg p-3 sm:grid-cols-[1fr_2fr_auto]">
                  <Input aria-label={`Page ${i + 1} name`} value={p.name} maxLength={40} onChange={(e) => set((d) => void (d.pages[i].name = e.target.value))} />
                  <Input aria-label={`Page ${i + 1} purpose`} value={p.purpose} placeholder="Purpose" maxLength={160} onChange={(e) => set((d) => void (d.pages[i].purpose = e.target.value))} />
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => set((d) => void d.pages.splice(i - 1, 0, ...d.pages.splice(i, 1)))}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === draft.pages.length - 1} onClick={() => set((d) => void d.pages.splice(i + 1, 0, ...d.pages.splice(i, 1)))}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.name}`} disabled={draft.pages.length <= 1} onClick={() => set((d) => void d.pages.splice(i, 1))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    aria-label={`Page ${i + 1} components`}
                    className="sm:col-span-3 text-[13px]"
                    value={p.components.join(", ")}
                    placeholder="Components, comma separated"
                    onChange={(e) => set((d) => void (d.pages[i].components = e.target.value.split(",").map((s) => s.trim()).filter(Boolean)))}
                  />
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Data model"
            hint="The records your app stores"
            action={
              <Button size="sm" variant="secondary" onClick={() => set((d) => void d.dataModel.push({ entity: "Record", fields: [{ name: "name", type: "string" }] }))}>
                <Plus className="h-3.5 w-3.5" /> Entity
              </Button>
            }
          >
            {draft.dataModel.length === 0 && <p className="text-sm text-ink-3">No entities yet.</p>}
            <div className="space-y-4">
              {draft.dataModel.map((ent, ei) => (
                <div key={ei} className="rounded-lg border border-line bg-bg">
                  <div className="flex items-center gap-2 border-b border-line p-3">
                    <Input aria-label="Entity name" value={ent.entity} maxLength={40} className="h-8 max-w-56 font-medium" onChange={(e) => set((d) => void (d.dataModel[ei].entity = e.target.value))} />
                    <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Remove ${ent.entity}`} onClick={() => set((d) => void d.dataModel.splice(ei, 1))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ul className="divide-y divide-line">
                    {ent.fields.map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2 px-3 py-2">
                        <Input aria-label="Field name" value={f.name} maxLength={40} className="h-8 font-mono text-[13px]" onChange={(e) => set((d) => void (d.dataModel[ei].fields[fi].name = e.target.value))} />
                        <select
                          aria-label="Field type"
                          value={f.type}
                          onChange={(e) => set((d) => void (d.dataModel[ei].fields[fi].type = e.target.value as (typeof FIELD_TYPES)[number]))}
                          className="h-8 rounded-lg border border-line bg-elev px-2 text-[13px]"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove field ${f.name}`} onClick={() => set((d) => void d.dataModel[ei].fields.splice(fi, 1))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => set((d) => void d.dataModel[ei].fields.push({ name: "field", type: "string" }))} className="w-full border-t border-line px-3 py-2 text-left text-[12px] text-accent hover:bg-accent-soft">
                    + Add field
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title={`Agents (${draft.agents.length})`}
            hint="What runs on its own, and when"
            action={
              <Button size="sm" variant="secondary" onClick={() => api.setTab("agents")}>
                <Bot className="h-3.5 w-3.5" /> Open Agent Studio
              </Button>
            }
          >
            {draft.agents.length === 0 ? (
              <p className="text-sm text-ink-3">No agents. Ask in chat: “add an agent that …”.</p>
            ) : (
              <ul className="space-y-3">
                {draft.agents.map((a) => (
                  <li key={a.name} className="rounded-lg border border-line bg-bg p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{a.name}</p>
                      <span className="rounded bg-sunken px-1.5 py-0.5 text-[11px] text-ink-3">When: {a.trigger}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-2">{a.role}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="grid gap-5 sm:grid-cols-2">
            <Section title="Integrations">
              <div className="flex flex-wrap gap-1.5">
                {draft.integrations.map((it, i) => (
                  <span key={it + i} className="inline-flex items-center gap-1 rounded-full border border-line bg-bg px-2.5 py-1 text-[12px]">
                    {it}
                    <button aria-label={`Remove ${it}`} onClick={() => set((d) => void d.integrations.splice(i, 1))} className="text-ink-3 hover:text-ink">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = newIntegration.trim();
                  if (v && !draft.integrations.includes(v)) set((d) => void d.integrations.push(v.slice(0, 40)));
                  setNewIntegration("");
                }}
              >
                <Input value={newIntegration} onChange={(e) => setNewIntegration(e.target.value)} placeholder="Add e.g. Salesforce" aria-label="Add integration" className="h-8 text-[13px]" />
                <Button size="sm" variant="secondary" type="submit">
                  Add
                </Button>
              </form>
            </Section>
            <Section title="Look & feel">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Accent colour"
                  value={/^#[0-9a-fA-F]{6}$/.test(draft.theme.accent) ? draft.theme.accent : "#2346d8"}
                  onChange={(e) => set((d) => void (d.theme.accent = e.target.value))}
                  className="h-9 w-12 cursor-pointer rounded-md border border-line bg-elev"
                />
                <span className="font-mono text-[13px] text-ink-2">{draft.theme.accent}</span>
                <div className="ml-auto flex rounded-lg border border-line bg-sunken p-0.5" role="radiogroup" aria-label="Colour mode">
                  {(["light", "dark"] as const).map((m) => (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={draft.theme.mode === m}
                      onClick={() => set((d) => void (d.theme.mode = m))}
                      className={cn("rounded-md px-2.5 py-1 text-[12px] capitalize", draft.theme.mode === m ? "bg-elev shadow-sm" : "text-ink-3")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>

      <div className={cn("flex flex-none items-center gap-2 border-t border-line bg-elev px-5 py-3", !dirty && built && "hidden")}>
        <p className="text-[13px] text-ink-2">
          {dirty ? "Unsaved changes" : "This plan hasn't been built yet."}
          {dirty && built && !imported && <span className="text-ink-3"> · Saving regenerates agents{api.data.checkpoints[0]?.engine === "demo" ? " and the UI" : ""}.</span>}
        </p>
        <div className="ml-auto flex gap-2">
          {dirty && (
            <Button variant="ghost" size="sm" onClick={() => setDraft(source)}>
              Discard
            </Button>
          )}
          {dirty && (
            <Button variant={built ? "primary" : "secondary"} size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          )}
          {built && dirty && api.data.checkpoints[0]?.engine === "claude" && (
            <Button size="sm" variant="secondary" disabled={saving || api.busy} onClick={() => void save("build")}>
              Save &amp; rebuild UI
            </Button>
          )}
          {!built && (
            <Button size="sm" disabled={saving || api.busy} onClick={() => void (dirty ? save("build") : api.startBuild())}>
              {dirty ? "Save & build" : "Approve & build"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
