"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, Bot, ChevronDown, FolderGit2, LayoutTemplate, MoreHorizontal, Paperclip, Pencil, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Input } from "@/components/ui";
import { FRAMEWORKS, getFramework } from "@/lib/frameworks";
import { TEMPLATES } from "@/lib/templates";
import { createProject } from "@/lib/client-api";
import { PREVIEW_SANDBOX } from "@/lib/share";
import { cn, timeAgo } from "@/lib/utils";
import { Dialog } from "@/components/dialog";
import { deleteProject, renameProject, toggleStar } from "../actions";

export type ProjectCard = {
  id: string;
  name: string;
  status: string;
  framework: string;
  source: string;
  starred: boolean;
  updatedAt: string;
  accent: string;
  agents: number;
  versions: number;
  live: boolean;
  preview: string | null;
};

const STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "ok" | "warn" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PLANNING: { label: "Planning", tone: "warn" },
  BUILDING: { label: "Building", tone: "warn" },
  READY: { label: "Ready", tone: "accent" },
  DEPLOYED: { label: "Live", tone: "ok" },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function HomeView({
  firstName,
  projects,
  initialPrompt,
  lens,
}: {
  firstName: string;
  projects: ProjectCard[];
  initialPrompt: string;
  lens: "GUIDED" | "PRO";
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [framework, setFramework] = useState("lyzr");
  const [fwOpen, setFwOpen] = useState(false);
  const [creating, startCreate] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "starred" | "live">("all");
  const [hello, setHello] = useState("Welcome back");
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHello(greeting());
    if (window.location.hash === "#new" || initialPrompt) promptRef.current?.focus();
  }, [initialPrompt]);

  const submit = (text = prompt, templateId?: string) => {
    if (text.trim().length < 3) {
      toast.error("Describe what you want to build");
      return;
    }
    startCreate(async () => {
      try {
        const id = await createProject({ prompt: text.trim(), framework, templateId });
        router.push(`/p/${id}?start=1`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't create the project");
      }
    });
  };

  const visible = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) &&
          (filter === "all" || (filter === "starred" ? p.starred : p.live)),
      ),
    [projects, query, filter],
  );

  const fw = getFramework(framework);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <section className="py-12 text-center">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          {hello}
          {firstName ? `, ${firstName}` : ""}. What are we building?
        </h1>
        <form
          id="new"
          className="mx-auto mt-8 max-w-3xl scroll-mt-24 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="rounded-2xl border border-line bg-elev p-2 shadow-card transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
            <label htmlFor="prompt" className="sr-only">
              Describe your app
            </label>
            <textarea
              id="prompt"
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              maxLength={4000}
              placeholder={
                lens === "PRO"
                  ? "Describe the app and its agents. Mention your stack if it matters: “LangGraph agent that triages GitHub issues, Next.js review UI…”"
                  : "Describe the job to be done: “When a customer emails about a refund, check the order and draft a reply for me to approve…”"
              }
              className="w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-ink-3"
            />
            <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
              <button
                type="button"
                onClick={() => toast.info("Attachments (PRDs, screenshots, Figma links) are part of the designed flow, but not wired up in this prototype.")}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <Paperclip className="h-4 w-4" /> Attach
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFwOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={fwOpen}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink-3 hover:bg-sunken hover:text-ink"
                >
                  <Bot className="h-4 w-4" /> Agents: <span className="text-ink">{fw.name}</span> <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {fwOpen && (
                  <ul role="listbox" aria-label="Agent framework" className="absolute left-0 top-9 z-20 w-72 rounded-xl border border-line bg-elev p-1 shadow-card">
                    {FRAMEWORKS.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={f.id === framework}
                          onClick={() => {
                            setFramework(f.id);
                            setFwOpen(false);
                          }}
                          className={cn("w-full rounded-lg px-3 py-2 text-left hover:bg-sunken", f.id === framework && "bg-accent-soft")}
                        >
                          <span className="text-sm font-medium">{f.name}</span>
                          <span className="block text-[12px] text-ink-3">{f.bestFor}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button type="submit" className="ml-auto" loading={creating} disabled={prompt.trim().length < 3}>
                Draft Blueprint <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
        <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
          {TEMPLATES.slice(0, 4).map((t) => (
            <button
              key={t.id}
              onClick={() => submit(t.prompt, t.id)}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-elev px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-accent hover:text-ink"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: t.accent }} aria-hidden />
              {t.name}
            </button>
          ))}
          <Link href="/templates" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-ink-3 hover:text-ink">
            <LayoutTemplate className="h-3.5 w-3.5" /> All templates
          </Link>
          <Link href="/import" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-ink-3 hover:text-ink">
            <FolderGit2 className="h-3.5 w-3.5" /> Import a repo
          </Link>
        </div>
      </section>

      <section aria-labelledby="projects-h">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="projects-h" className="text-lg font-semibold">
            Your projects <span className="text-ink-3">{projects.length}</span>
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-lg border border-line bg-elev p-0.5 text-[13px]" role="tablist" aria-label="Filter projects">
              {(["all", "starred", "live"] as const).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn("rounded-md px-2.5 py-1 capitalize", filter === f ? "bg-sunken text-ink" : "text-ink-3 hover:text-ink")}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search projects" className="h-8 w-44 pl-8 text-[13px]" />
            </div>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong p-12 text-center">
            <p className="font-display text-2xl">No projects yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">Describe an idea above, start from a template, or import an existing repo to keep working on it here.</p>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-3">No projects match.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <ProjectTile key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProjectTile({ p }: { p: ProjectCard }) {
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [pending, start] = useTransition();
  const status = STATUS[p.status] ?? STATUS.DRAFT;
  return (
    <li className={cn("group relative overflow-hidden rounded-xl border border-line bg-elev transition hover:border-line-strong hover:shadow-card", pending && "opacity-60")}>
      <Link href={`/p/${p.id}`} className="block" aria-label={`Open ${p.name}`}>
        <div className="relative h-40 overflow-hidden border-b border-line bg-sunken">
          {p.preview ? (
            <iframe
              title={`${p.name} preview`}
              srcDoc={p.preview}
              sandbox={PREVIEW_SANDBOX}
              loading="lazy"
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-[640px] w-[1280px] origin-top-left scale-[0.3] border-0"
            />
          ) : (
            <div className="blueprint-grid flex h-full items-center justify-center">
              <span className="font-display text-3xl italic" style={{ color: p.accent }}>
                {p.name.slice(0, 1)}
              </span>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: p.accent }} aria-hidden />
            <p className="truncate font-medium">{p.name}</p>
            {p.starred && <Star className="h-3.5 w-3.5 flex-none fill-warn text-warn" aria-label="Starred" />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>{getFramework(p.framework).name}</span>
            <span aria-hidden>·</span>
            <span>
              {p.agents} agent{p.agents === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>v{p.versions}</span>
            <span className="ml-auto">{timeAgo(p.updatedAt)}</span>
          </div>
        </div>
      </Link>
      <div className="absolute right-2 top-2">
        <button
          onClick={() => setMenu((m) => !m)}
          aria-label={`Actions for ${p.name}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-elev/90 text-ink-2 opacity-0 shadow-sm transition hover:text-ink focus:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-line bg-elev p-1 shadow-card" onMouseLeave={() => setMenu(false)}>
            <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sunken" onClick={() => start(async () => { await toggleStar(p.id); setMenu(false); })}>
              <Star className="h-4 w-4" /> {p.starred ? "Unstar" : "Star"}
            </button>
            <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sunken" onClick={() => { setMenu(false); setDialog("rename"); }}>
              <Pencil className="h-4 w-4" /> Rename
            </button>
            <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-soft" onClick={() => { setMenu(false); setDialog("delete"); }}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        )}
      </div>
      <Dialog open={dialog === "rename"} onClose={() => setDialog(null)} title="Rename project">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
            if (!name) return;
            start(async () => {
              await renameProject(p.id, name);
              setDialog(null);
              toast.success("Renamed");
            });
          }}
          className="grid gap-4"
        >
          <Input name="name" defaultValue={p.name} maxLength={80} autoFocus aria-label="Project name" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save</Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={dialog === "delete"} onClose={() => setDialog(null)} title={`Delete “${p.name}”?`} description="This deletes its checkpoints, agents and live link. It can't be undone.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                await deleteProject(p.id);
                setDialog(null);
                toast.success("Project deleted");
              })
            }
          >
            Delete project
          </Button>
        </div>
      </Dialog>
    </li>
  );
}
