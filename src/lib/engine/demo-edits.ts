import type { Blueprint } from "@/lib/schemas";

export const COLOR_WORDS: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  purple: "#7c3aed",
  violet: "#7c3aed",
  orange: "#ea580c",
  pink: "#db2777",
  teal: "#0d9488",
  black: "#111827",
  yellow: "#ca8a04",
  indigo: "#4f46e5",
  gold: "#b45309",
};

const clean = (s: string) =>
  s
    .trim()
    .replace(/^["'“”]+|["'“”.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export type DemoEditResult = { blueprint: Blueprint; changes: string[] };

/** Rule-based edits so the scripted engine can respond to common follow-ups. */
export function applyDemoEdit(input: Blueprint, instruction: string): DemoEditResult {
  const bp: Blueprint = structuredClone(input);
  const text = instruction.toLowerCase();
  const changes: string[] = [];

  const hex = instruction.match(/#[0-9a-fA-F]{6}\b/);
  const colorWord = Object.keys(COLOR_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(text));
  if (hex) {
    bp.theme.accent = hex[0].toLowerCase();
    changes.push(`Changed the accent colour to ${bp.theme.accent}`);
  } else if (colorWord) {
    bp.theme.accent = COLOR_WORDS[colorWord];
    changes.push(`Changed the accent colour to ${colorWord}`);
  }

  if (/\bdark\b/.test(text) && bp.theme.mode !== "dark") {
    bp.theme.mode = "dark";
    changes.push("Switched to dark mode");
  } else if (/\blight\b/.test(text) && bp.theme.mode !== "light") {
    bp.theme.mode = "light";
    changes.push("Switched to light mode");
  }

  const rename = instruction.match(/(?:rename(?: the app)?|call it|name it)(?: to)?\s+(.+)$/i);
  if (rename) {
    const name = clean(rename[1]);
    if (name) {
      bp.appName = titleCase(name);
      changes.push(`Renamed the app to ${bp.appName}`);
    }
  }

  const addPage = instruction.match(/add (?:a |an )?(?:new )?(?:page|tab|screen|section)(?: called| named| for)?\s+(.+)$/i);
  if (addPage) {
    const name = titleCase(clean(addPage[1]));
    if (name && !bp.pages.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      bp.pages.push({ name, purpose: `Everything about ${name.toLowerCase()}`, components: ["Table", "Filters"] });
      changes.push(`Added a "${name}" page`);
    }
  }

  const removePage = instruction.match(/(?:remove|delete) (?:the )?(.+?) (?:page|tab|screen)/i);
  if (removePage) {
    const target = clean(removePage[1]).toLowerCase();
    const before = bp.pages.length;
    bp.pages = bp.pages.filter((p) => p.name.toLowerCase() !== target);
    if (bp.pages.length < before) changes.push(`Removed the "${titleCase(target)}" page`);
  }

  const addAgent = instruction.match(/add (?:an? )?(?:new )?agent(?: that| to| which| for)?\s+(.+)$/i);
  if (addAgent) {
    const job = clean(addAgent[1]);
    if (job) {
      const agentName = `${titleCase(job.split(" ").slice(0, 2).join(" "))} Agent`;
      bp.agents.push({
        name: agentName,
        role: `Handles: ${job}.`,
        instructions: `You ${job}. Ask a human before any irreversible action and explain your reasoning briefly.`,
        tools: ["search_records", "notify_team"],
        trigger: "On demand",
      });
      changes.push(`Added the ${agentName}`);
    }
  }

  return { blueprint: bp, changes };
}
