"use client";

import { useMemo, useState } from "react";
import { Database, Sheet, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "@/components/ui";
import { sampleRows } from "@/lib/engine/render-app";
import { generateSchemaSql } from "@/lib/codegen/sql";
import { cn } from "@/lib/utils";
import type { WorkspaceApi } from "./types";

const SOURCES = [
  { id: "architect", name: "Architect Postgres", body: "Managed Postgres per project, with branching per preview.", icon: Database, connected: true },
  { id: "supabase", name: "Supabase", body: "Bring your own Supabase project and auth.", icon: Database },
  { id: "sheets", name: "Google Sheets", body: "Great for ops teams already living in a spreadsheet.", icon: Sheet },
  { id: "airtable", name: "Airtable", body: "Sync bases and views as tables.", icon: Table2 },
];

export function DataPanel({ api }: { api: WorkspaceApi }) {
  const bp = api.data.blueprint;
  const [entityIdx, setEntityIdx] = useState(0);
  const [view, setView] = useState<"records" | "schema">(api.lens === "PRO" ? "schema" : "records");
  const rows = useMemo(() => {
    if (!bp || !bp.dataModel[entityIdx]) return [];
    return sampleRows({ ...bp, dataModel: [bp.dataModel[entityIdx]] }, 12);
  }, [bp, entityIdx]);
  const sql = useMemo(() => (bp ? generateSchemaSql(bp) : ""), [bp]);

  if (!bp || bp.dataModel.length === 0) {
    return (
      <div className="blueprint-grid flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="font-display text-3xl">No data model yet</p>
          <p className="mt-2 text-sm text-ink-2">Entities from your Blueprint show up here with sample records and a schema.</p>
        </div>
      </div>
    );
  }
  const entity = bp.dataModel[entityIdx] ?? bp.dataModel[0];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="annotation">Data</p>
            <h2 className="mt-1 text-xl font-semibold">Your app&apos;s records</h2>
          </div>
          <div className="flex rounded-lg border border-line bg-sunken p-0.5" role="tablist" aria-label="Data view">
            {(["records", "schema"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("rounded-md px-3 py-1 text-[13px] capitalize", view === v ? "bg-elev shadow-sm" : "text-ink-3")}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === "records" ? (
          <div className="overflow-hidden rounded-xl border border-line bg-elev">
            <div className="flex gap-1 border-b border-line p-2">
              {bp.dataModel.map((e, i) => (
                <button key={e.entity + i} onClick={() => setEntityIdx(i)} className={cn("rounded-md px-3 py-1.5 text-[13px]", i === entityIdx ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-sunken")}>
                  {e.entity}
                </button>
              ))}
              <Badge tone="neutral" className="ml-auto self-center">Sample data</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    {entity.fields.map((f) => (
                      <th key={f.name} className="whitespace-nowrap px-4 py-2.5 font-medium text-ink-2">
                        {f.name} <span className="font-mono text-[10.5px] font-normal text-ink-3">{f.type}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-0 hover:bg-sunken/60">
                      {entity.fields.map((f) => (
                        <td key={f.name} className="whitespace-nowrap px-4 py-2">
                          {f.type === "currency" ? `$${Number(r[f.name]).toFixed(2)}` : f.type === "boolean" ? (r[f.name] ? "Yes" : "No") : String(r[f.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0e1015] px-4 py-2">
              <span className="font-mono text-[12px] text-[#b1b6c1]">schema.sql · Postgres</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-[#b1b6c1] hover:bg-white/10 hover:text-white"
                onClick={() => void navigator.clipboard.writeText(sql).then(() => toast.success("Copied"))}
              >
                Copy
              </Button>
            </div>
            <pre className="overflow-x-auto bg-[#0e1015] p-4 font-mono text-[12.5px] leading-relaxed text-[#b1b6c1]">{sql}</pre>
          </div>
        )}

        <div>
          <h3 className="mb-3 font-semibold">Where the data lives</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SOURCES.map((s) => (
              <div key={s.id} className="rounded-xl border border-line bg-elev p-4">
                <s.icon className="h-5 w-5 text-accent" aria-hidden />
                <p className="mt-2 font-medium">{s.name}</p>
                <p className="mt-1 text-[12.5px] text-ink-2">{s.body}</p>
                {s.connected ? (
                  <Badge tone="ok" className="mt-3">Provisioned</Badge>
                ) : (
                  <Button size="sm" variant="secondary" className="mt-3" onClick={() => toast.info(`${s.name} connection is a designed flow in this prototype.`)}>
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
