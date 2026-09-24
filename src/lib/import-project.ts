import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Blueprint, Files } from "@/lib/schemas";
import type { CodebaseMap } from "@/lib/github";
import { addMessage, createCheckpoint } from "@/lib/projects";

export function importBlueprint(name: string, files: Files, map: CodebaseMap): Blueprint {
  const readme = files["README.md"] ?? files["readme.md"] ?? "";
  const firstPara =
    readme
      .split(/\n\s*\n/)
      .map((p) => p.replace(/^#+\s.*$/gm, "").trim())
      .find((p) => p.length > 20) ?? "";
  return {
    appName: name,
    tagline: map.stack.length ? `Imported ${map.stack.slice(0, 3).join(" · ")} project` : "Imported project",
    summary: (firstPara || `An existing codebase with ${map.totalFiles} files, imported to keep building in Architect.`).slice(0, 400),
    audience: "Your team",
    pages: map.entryPoints.slice(0, 5).map((p) => ({ name: p.split("/").pop() ?? p, purpose: `Entry point at ${p}`, components: [] })),
    dataModel: [],
    agents: [],
    integrations: ["GitHub"],
    theme: { accent: "#2346d8", mode: "light" },
  };
}

export async function createImportedProject(opts: {
  userId: string;
  name: string;
  files: Files;
  map: CodebaseMap;
  githubRepo?: string;
  sourceLabel: string;
}) {
  const bp = importBlueprint(opts.name, opts.files, opts.map);
  const project = await db.project.create({
    data: {
      userId: opts.userId,
      name: opts.name,
      prompt: `Imported from ${opts.sourceLabel}`,
      framework: opts.map.frameworkGuess,
      lens: "PRO",
      source: "import",
      status: "READY",
      githubRepo: opts.githubRepo,
      blueprint: bp as unknown as Prisma.InputJsonValue,
    },
  });
  await addMessage(project.id, "user", `Import ${opts.sourceLabel}`);
  const cp = await createCheckpoint(project.id, opts.files, `Imported ${opts.map.importedFiles} files from ${opts.sourceLabel}`, "import");
  await addMessage(
    project.id,
    "assistant",
    `Imported ${opts.map.importedFiles} of ${opts.map.totalFiles} files. I mapped the codebase below. Ask me to add an agent, or open the Code tab to keep working.`,
    { kind: "import", map: opts.map, version: cp.version } as Record<string, unknown>,
  );
  return project;
}
