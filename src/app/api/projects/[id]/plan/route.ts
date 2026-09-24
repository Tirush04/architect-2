import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runPlan } from "@/lib/engine";
import { sseResponse } from "@/lib/sse";
import { addMessage } from "@/lib/projects";
import { engineFor, projectForRequest } from "@/lib/route-helpers";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const { project, userId } = r;
  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  const prompt = (typeof body.prompt === "string" && body.prompt.trim().slice(0, 4000)) || project.prompt;
  const mode = await engineFor(userId);

  return sseResponse(async (emit, signal) => {
    await db.project.update({ where: { id }, data: { status: "PLANNING", prompt } });
    let engine: "claude" | "demo" = mode.claude ? "claude" : "demo";
    let blueprint;
    try {
      const gen = runPlan(prompt, mode, signal);
      let step = await gen.next();
      while (!step.done) {
        if (step.value.type === "engine") engine = step.value.engine;
        emit(step.value);
        step = await gen.next();
      }
      blueprint = step.value;
    } catch (err) {
      await db.project.update({ where: { id }, data: { status: project.status === "PLANNING" ? "DRAFT" : project.status } });
      throw err;
    }
    await db.project.update({
      where: { id },
      data: { blueprint: blueprint as unknown as Prisma.InputJsonValue, name: project.source === "template" ? project.name : blueprint.appName },
    });
    const msg = await addMessage(id, "assistant", blueprint.summary, { kind: "blueprint", engine });
    emit({ type: "done", summary: msg.content });
  }, req.signal);
}
