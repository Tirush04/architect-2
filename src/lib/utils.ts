import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string, max = 40): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function timeAgo(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function titleFromPrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/^(build|create|make|i want|i need|design|generate)\s+(me\s+)?(an?\s+|the\s+)?/i, "")
    .replace(/[.!?].*$/s, "")
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 5).join(" ");
  if (!words) return "Untitled app";
  return words.charAt(0).toUpperCase() + words.slice(1);
}
