import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BlueprintSchema, type Blueprint, type Files } from "@/lib/schemas";
import { getFramework } from "@/lib/frameworks";

export function readBlueprint(value: unknown): Blueprint | null {
  const parsed = BlueprintSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function latestCheckpoint(projectId: string) {
  return db.checkpoint.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
}

export async function createCheckpoint(projectId: string, files: Files, summary: string, engine: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await db.checkpoint.findFirst({ where: { projectId }, orderBy: { version: "desc" }, select: { version: true } });
    try {
      return await db.checkpoint.create({
        data: { projectId, version: (last?.version ?? 0) + 1, files: files as Prisma.InputJsonValue, summary: summary.slice(0, 500), engine },
      });
    } catch (err) {
      // Unique (projectId, version) race with a concurrent turn: retry with the next version.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Could not save checkpoint");
}

export async function syncAgents(projectId: string, blueprint: Blueprint, frameworkId: string) {
  const fw = getFramework(frameworkId).id;
  await db.$transaction([
    db.agent.deleteMany({ where: { projectId } }),
    db.agent.createMany({
      data: blueprint.agents.map((a) => ({
        projectId,
        name: a.name,
        role: a.role,
        framework: fw,
        config: { instructions: a.instructions, tools: a.tools, trigger: a.trigger } as Prisma.InputJsonValue,
      })),
    }),
  ]);
}

export async function addMessage(projectId: string, role: "user" | "assistant" | "system", content: string, meta?: Record<string, unknown>) {
  return db.message.create({
    data: { projectId, role, content: content.slice(0, 8000), meta: meta ? (meta as Prisma.InputJsonValue) : undefined },
  });
}

export const MAX_FILE_BYTES = 400_000;
export const MAX_FILES = 200;
