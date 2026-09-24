import type { Prisma } from "@prisma/client";
import { LIMITS, readJson } from "@/lib/body";
import { db } from "@/lib/db";
import { runEdit } from "@/lib/engine";
import { sseResponse } from "@/lib/sse";
import { diffFiles } from "@/lib/diff";
import { addMessage, createCheckpoint, latestCheckpoint, readBlueprint, syncAgents } from "@/lib/projects";
import { badRequest, engineFor, projectForRequest } from "@/lib/route-helpers";
import { ChatSchema, type Files } from "@/lib/schemas";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = await readJson(req, LIMITS.small);
  if (!raw.ok) return raw.response;
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const { project, userId } = r;
  const parsed = ChatSchema.safeParse(raw.data);
  if (!parsed.success) return badRequest("Message is required");
  const blueprint = readBlueprint(project.blueprint);
  const latest = await latestCheckpoint(id);
  if (!blueprint || !latest) return badRequest("Build the app before iterating on it");
  const { message, selection } = parsed.data;
  const mode = await engineFor(userId);

  await addMessage(id, "user", message, selection ? { selection } : undefined);

  return sseResponse(async (emit, signal) => {
    const files = latest.files as Files;
    const gen = runEdit({ blueprint, files, frameworkId: project.framework, instruction: message, selection, mode, signal });
    let step = await gen.next();
    while (!step.done) {
      emit(step.value);
      step = await gen.next();
    }
    const result = step.value;
    if (!result.changed) {
      await addMessage(id, "assistant", result.summary, { kind: "note", engine: result.engine });
      emit({ type: "done", summary: result.summary });
      return;
    }
    const checkpoint = await createCheckpoint(id, result.files, result.summary, result.engine);
    if (result.blueprint !== blueprint) {
      await db.project.update({ where: { id }, data: { blueprint: result.blueprint as unknown as Prisma.InputJsonValue } });
      await syncAgents(id, result.blueprint, project.framework);
    }
    await db.project.update({ where: { id }, data: { updatedAt: new Date() } });
    await addMessage(id, "assistant", result.summary, {
      kind: "build",
      version: checkpoint.version,
      engine: result.engine,
      changes: diffFiles(files, result.files),
    });
    emit({ type: "done", summary: result.summary, checkpointId: checkpoint.id, version: checkpoint.version });
  }, req.signal);
}
