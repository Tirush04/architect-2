"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KeyRound, Plug, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Input, Label } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { FRAMEWORKS } from "@/lib/frameworks";
import { cn } from "@/lib/utils";
import type { WorkspaceApi } from "./types";

const INTEGRATIONS = ["Slack", "Gmail", "Stripe", "HubSpot", "Notion", "Google Sheets", "Salesforce", "Zendesk"];

type EnvVar = { key: string; masked: string };

export function SettingsPanel({ api }: { api: WorkspaceApi }) {
  const { data } = api;
  const router = useRouter();
  const pid = data.project.id;
  const [vars, setVars] = useState<EnvVar[] | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${pid}/env`)
      .then((r) => r.json())
      .then((j: { vars: EnvVar[] }) => setVars(j.vars))
      .catch(() => setVars([]));
  }, [pid]);

  const addVar = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/projects/${pid}/env`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim(), value }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Couldn't save");
    setVars(j.vars);
    setKey("");
    setValue("");
    toast.success("Secret saved (encrypted)");
  };

  const removeVar = async (k: string) => {
    const res = await fetch(`/api/projects/${pid}/env?key=${encodeURIComponent(k)}`, { method: "DELETE" });
    const j = await res.json();
    if (res.ok) setVars(j.vars);
  };

  const inUse = new Set((data.blueprint?.integrations ?? []).map((i) => i.toLowerCase()));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <section className="rounded-xl border border-line bg-elev p-5">
          <h3 className="font-semibold">General</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <form
              className="grid gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
                if (name) void api.patchProject({ name }).then(() => toast.success("Renamed"));
              }}
            >
              <Label htmlFor="set-name">Project name</Label>
              <div className="flex gap-2">
                <Input id="set-name" name="name" defaultValue={data.project.name} maxLength={80} key={data.project.name} />
                <Button type="submit" variant="secondary">
                  Save
                </Button>
              </div>
            </form>
            <div className="grid gap-1.5">
              <Label htmlFor="set-fw">Agent framework</Label>
              <select
                id="set-fw"
                value={data.project.framework}
                onChange={(e) => void api.patchProject({ framework: e.target.value }).then(() => toast.success("Framework updated. Agent code regenerated."))}
                className="h-10 rounded-lg border border-line bg-elev px-3 text-sm"
                disabled={api.busy}
              >
                {FRAMEWORKS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-elev p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4 text-accent" /> Secrets &amp; environment variables
          </h3>
          <p className="mt-1 text-[13px] text-ink-2">Encrypted at rest (AES-256-GCM). Values are never shown again after saving.</p>
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {vars === null && <li className="px-3 py-2.5 text-[13px] text-ink-3">Loading…</li>}
            {vars?.length === 0 && <li className="px-3 py-2.5 text-[13px] text-ink-3">No variables yet.</li>}
            {vars?.map((v) => (
              <li key={v.key} className="flex items-center gap-3 px-3 py-2">
                <span className="font-mono text-[13px]">{v.key}</span>
                <span className="font-mono text-[12px] text-ink-3">{v.masked}</span>
                <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Delete ${v.key}`} onClick={() => void removeVar(v.key)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          <form onSubmit={addVar} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <Input value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="OPENAI_API_KEY" aria-label="Variable name" className="font-mono text-[13px]" />
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" type="password" aria-label="Variable value" autoComplete="off" />
            <Button type="submit" disabled={!key.trim() || !value}>
              Add
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-line bg-elev p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Plug className="h-4 w-4 text-accent" /> Integrations
          </h3>
          <p className="mt-1 text-[13px] text-ink-2">Tools your agents can use. Connections are a designed flow in this prototype.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {INTEGRATIONS.map((name) => {
              const on = connected[name];
              return (
                <div key={name} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", on ? "border-ok/40 bg-ok-soft/40" : "border-line")}>
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-sunken text-[12px] font-semibold">{name.slice(0, 2)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{name}</p>
                    {inUse.has(name.toLowerCase()) && <p className="text-[11px] text-ink-3">Used by your Blueprint</p>}
                  </div>
                  <Button
                    size="sm"
                    variant={on ? "ghost" : "secondary"}
                    onClick={() => {
                      setConnected((c) => ({ ...c, [name]: !c[name] }));
                      toast.success(on ? `${name} disconnected` : `${name} connected (simulated OAuth)`);
                    }}
                  >
                    {on ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-danger/30 bg-elev p-5">
          <h3 className="font-semibold text-danger">Danger zone</h3>
          <div className="mt-3 flex items-center gap-3">
            <p className="flex-1 text-[13px] text-ink-2">Delete this project, its checkpoints, agents and live link.</p>
            <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
              Delete project
            </Button>
          </div>
        </section>
        {data.project.source === "import" && <Badge tone="neutral">Imported project</Badge>}
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`Delete “${data.project.name}”?`} description="This can't be undone.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={async () => {
              setDeleting(true);
              const res = await fetch(`/api/projects/${pid}`, { method: "DELETE" });
              if (res.ok) {
                toast.success("Project deleted");
                router.push("/home");
              } else {
                setDeleting(false);
                toast.error("Couldn't delete");
              }
            }}
          >
            Delete project
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
