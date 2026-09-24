"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Search, Settings, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { Avatar, Kbd } from "@/components/ui";
import { CommandPalette, openCommandPalette, type PaletteProject } from "@/components/command-palette";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/home", label: "Projects" },
  { href: "/templates", label: "Templates" },
  { href: "/import", label: "Import" },
];

export function AppHeader({
  user,
  projects,
  usage,
  signOut,
}: {
  user: { name: string | null; email: string | null; image: string | null };
  projects: PaletteProject[];
  usage: { used: number; limit: number; engine: "claude" | "demo" };
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const pct = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo href="/home" />
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/home" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-ink-2 transition hover:bg-sunken hover:text-ink",
                  active && "bg-sunken font-medium text-ink",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={openCommandPalette}
            className="hidden h-8 items-center gap-2 rounded-lg border border-line bg-elev px-2.5 text-[13px] text-ink-3 transition hover:border-line-strong sm:flex"
          >
            <Search className="h-3.5 w-3.5" /> Search <Kbd>Ctrl K</Kbd>
          </button>
          <Link
            href="/settings#usage"
            className="hidden items-center gap-2 rounded-lg px-2 py-1 text-[12px] text-ink-3 hover:bg-sunken lg:flex"
            title={usage.engine === "demo" ? "Running on the demo engine" : `${usage.used} of ${usage.limit} AI builds used today`}
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            {usage.engine === "demo" ? (
              <span>Demo engine</span>
            ) : (
              <>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-sunken" aria-hidden>
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </span>
                {usage.limit - usage.used} left
              </>
            )}
          </Link>
          <ThemeToggle />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenu((m) => !m)}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label="Account menu"
              className="rounded-full transition hover:ring-4 hover:ring-accent/15"
            >
              <Avatar name={user.name ?? user.email} image={user.image} />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-elev p-1 shadow-card">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">{user.name ?? "You"}</p>
                  <p className="truncate text-[12px] text-ink-3">{user.email}</p>
                </div>
                <div className="my-1 h-px bg-line" />
                <Link role="menuitem" href="/settings" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <form action={signOut}>
                  <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
      <CommandPalette projects={projects} onSignOut={() => void signOut()} />
    </header>
  );
}
