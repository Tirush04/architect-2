import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M16 6.5 8.5 25.5h3.2l1.6-4.3h5.4l1.6 4.3h3.2L16 6.5Zm-1.6 11.8L16 13.6l1.6 4.7h-3.2Z" className="fill-accent-ink" />
      <circle cx="16" cy="6.5" r="1.6" className="fill-accent-ink" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2", className)} aria-label="Architect home">
      <LogoMark />
      <span className="font-semibold tracking-tight">
        Architect <span className="font-display text-[17px] italic text-accent">2.0</span>
      </span>
    </Link>
  );
}
