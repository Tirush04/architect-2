"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { TEMPLATES } from "@/lib/templates";
import { createProject } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];

export function TemplatesView() {
  const router = useRouter();
  const [cat, setCat] = useState("All");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const list = TEMPLATES.filter((t) => cat === "All" || t.category === cat);

  const use = (id: string, prompt: string) => {
    setPendingId(id);
    start(async () => {
      try {
        const pid = await createProject({ prompt, templateId: id });
        router.push(`/p/${pid}?start=1`);
      } catch (e) {
        toast.error((e as Error).message);
        setPendingId(null);
      }
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="annotation">Templates</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Start from a working agentic app</h1>
      <p className="mt-3 max-w-2xl text-ink-2">Each template drafts a Blueprint you can edit before anything is built. Nothing is locked in.</p>
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={cn("rounded-full border px-3.5 py-1.5 text-[13px]", cat === c ? "border-ink bg-ink text-bg" : "border-line bg-elev text-ink-2 hover:text-ink")}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <li key={t.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-elev transition hover:border-line-strong hover:shadow-card">
            <div className="blueprint-grid relative h-32 border-b border-line" style={{ backgroundColor: `color-mix(in srgb, ${t.accent} 8%, transparent)` }}>
              <div className="absolute inset-4 rounded-lg border border-line bg-elev/90 p-3 shadow-sm">
                <div className="flex gap-2">
                  <span className="h-2 w-12 rounded-full" style={{ background: t.accent }} />
                  <span className="h-2 w-8 rounded-full bg-sunken" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-8 rounded-md bg-sunken" />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{t.name}</p>
                <span className="annotation">{t.category}</span>
              </div>
              <p className="mt-1.5 flex-1 text-[13.5px] text-ink-2">{t.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                  <Bot className="h-3.5 w-3.5" /> {t.agents} agent{t.agents === 1 ? "" : "s"}
                </span>
                <Button size="sm" onClick={() => use(t.id, t.prompt)} loading={pendingId === t.id} disabled={!!pendingId}>
                  Use template <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
