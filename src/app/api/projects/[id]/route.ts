import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { BlueprintSchema, type Files } from "@/lib/schemas";
import { FRAMEWORKS } from "@/lib/frameworks";
import { regenerateSupportFiles } from "@/lib/engine";
import { renderAppHtml } from "@/lib/engine/render-app";
import { addMessage, createCheckpoint, latestCheckpoint, syncAgents } from "@/lib/projects";
import { badRequest, projectForRequest } from "@/lib/route-helpers";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  lens: z.enum(["GUIDED", "PRO"]).optional(),
  framework: z.string().refine((f) => FRAMEWORKS.some((x) => x.id === f), "Unknown framework").optional(),
  blueprint: BlueprintSchema.optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  const { name, lens, framework, blueprint } = parsed.data;
  const project = r.project;

  const nextFramework = framework ?? project.framework;
  const nextBlueprint = blueprint ?? (project.blueprint as z.infer<typeof BlueprintSchema> | null);
  let checkpoint: { id: string; version: number } | null = null;

  const latest = await latestCheckpoint(id);
  const structural = (framework && framework !== project.framework) || blueprint;
  if (latest && nextBlueprint && structural && project.source !== "import") {
    const files = latest.files as Files;
    let next = regenerateSupportFiles(files, nextBlueprint, nextFramework);
    // Demo-engine builds are pure functions of the Blueprint, so re-render the UI too.
    if (blueprint && latest.engine === "demo") next = { ...next, "index.html": renderAppHtml(nextBlueprint) };
    const summary = framework && framework !== project.framework ? `Switched agents to ${FRAMEWORKS.find((f) => f.id === framework)?.name}` : "Updated the Blueprint";
    checkpoint = await createCheckpoint(id, next, summary, latest.engine);
    await syncAgents(id, nextBlueprint, nextFramework);
    await addMessage(id, "assistant", summary, { kind: "build", version: checkpoint.version, engine: latest.engine });
  }

  const updated = await db.project.update({
    where: { id },
    data: {
      name: name ?? (blueprint && project.source !== "template" ? blueprint.appName : undefined),
      lens,
      framework: nextFramework,
      blueprint: blueprint ? (blueprint as unknown as Prisma.InputJsonValue) : undefined,
    },
    select: { id: true, name: true, lens: true, framework: true, status: true },
  });
  return NextResponse.json({ project: updated, checkpoint });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
