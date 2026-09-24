"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FolderGit2, Home, LayoutTemplate, LogOut, Moon, Plus, Search, Settings, Sun, Terminal } from "lucide-react";
import { setTheme } from "@/components/theme";

export type PaletteProject = { id: string; name: string };

export function openCommandPalette() {
  window.dispatchEvent(new Event("open-command-palette"));
}

export function CommandPalette({ projects, onSignOut }: { projects: PaletteProject[]; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const item =
    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-2 aria-selected:bg-accent-soft aria-selected:text-ink";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command menu"
      overlayClassName="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
      contentClassName="fixed left-1/2 top-[18vh] z-50 w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-elev shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search className="h-4 w-4 text-ink-3" aria-hidden />
        <Command.Input placeholder="Search projects or run a command…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3" />
      </div>
      <Command.List className="max-h-[50vh] overflow-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-ink-3">Nothing found.</Command.Empty>
        <Command.Group heading="Create" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-3">
          <Command.Item className={item} onSelect={() => go("/home#new")}>
            <Plus className="h-4 w-4" /> New project from a prompt
          </Command.Item>
          <Command.Item className={item} onSelect={() => go("/import")}>
            <FolderGit2 className="h-4 w-4" /> Import a GitHub repo
          </Command.Item>
          <Command.Item className={item} onSelect={() => go("/templates")}>
            <LayoutTemplate className="h-4 w-4" /> Browse templates
          </Command.Item>
        </Command.Group>
        {projects.length > 0 && (
          <Command.Group heading="Projects" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-3">
            {projects.map((p) => (
              <Command.Item key={p.id} value={`project ${p.name} ${p.id}`} className={item} onSelect={() => go(`/p/${p.id}`)}>
                <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> {p.name}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-3">
          <Command.Item className={item} onSelect={() => go("/home")}>
            <Home className="h-4 w-4" /> Home
          </Command.Item>
          <Command.Item className={item} onSelect={() => go("/settings")}>
            <Settings className="h-4 w-4" /> Settings
          </Command.Item>
          <Command.Item className={item} onSelect={() => go("/settings#developer")}>
            <Terminal className="h-4 w-4" /> API keys &amp; CLI
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Preferences" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-3">
          <Command.Item className={item} onSelect={() => { setTheme("dark"); setOpen(false); }}>
            <Moon className="h-4 w-4" /> Dark mode
          </Command.Item>
          <Command.Item className={item} onSelect={() => { setTheme("light"); setOpen(false); }}>
            <Sun className="h-4 w-4" /> Light mode
          </Command.Item>
          <Command.Item className={item} onSelect={() => { setOpen(false); onSignOut(); }}>
            <LogOut className="h-4 w-4" /> Sign out
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
