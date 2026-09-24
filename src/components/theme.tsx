"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";


export function setTheme(next: "light" | "dark") {
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem("theme", next);
  } catch {
    // storage unavailable
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
}

export function useTheme(): "light" | "dark" {
  const [theme, set] = useState<"light" | "dark">("light");
  useEffect(() => {
    set(document.documentElement.classList.contains("dark") ? "dark" : "light");
    const on = (e: Event) => set((e as CustomEvent<"light" | "dark">).detail);
    window.addEventListener("themechange", on);
    return () => window.removeEventListener("themechange", on);
  }, []);
  return theme;
}

export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
