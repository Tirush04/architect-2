import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { LIMITS, readJson } from "@/lib/body";
import { db } from "@/lib/db";
import { runPlan } from "@/lib/engine";
import { sseResponse } from "@/lib/sse";
import { addMessage, latestCheckpoint, readBlueprint } from "@/lib/projects";
import { badRequest, engineFor, projectForRequest } from "@/lib/route-helpers";

export const maxDuration = 300;

const PlanSchema = z.object({
  /** A chat message: a fresh idea (no Blueprint yet) or a revision request (Blueprint drafted, not built). */
  message: z.string().trim().min(1).max(4000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = await readJson(req, LIMITS.small);
  if (!raw.ok) return raw.response;
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const { project, userId } = r;
  const parsed = PlanSchema.safeParse(raw.data ?? {});
  if (!parsed.success) return badRequest("Invalid message");
  const message = parsed.data.message;
  const current = readBlueprint(project.blueprint);
  if (current && message && (await latestCheckpoint(id))) return badRequest("This project is already built. Use chat to change it.");
  const revision = current && message ? message : undefined;
  const prompt = !current && message ? message : project.prompt;
  const mode = await engineFor(userId);
  if (message) await addMessage(id, "user", message);

  return sseResponse(async (emit, signal) => {
    await db.project.update({ where: { id }, data: { status: "PLANNING", prompt } });
    try {
      let engine: "claude" | "demo" = mode.claude ? "claude" : "demo";
      let note = "";
      const gen = runPlan(prompt, mode, signal, { current: revision ? current : null, revision });
      let step = await gen.next();
      while (!step.done) {
        if (step.value.type === "engine") engine = step.value.engine;
        if (step.value.type === "status") note = step.value.text;
        emit(step.value);
        step = await gen.next();
      }
      const blueprint = step.value;
      await db.project.update({
        where: { id },
        data: {
          blueprint: blueprint as unknown as Prisma.InputJsonValue,
          name: project.source === "template" ? project.name : blueprint.appName,
        },
      });
      const msg = await addMessage(id, "assistant", revision ? note || "Revised the Blueprint." : blueprint.summary, {
        kind: revision ? "note" : "blueprint",
        engine,
      });
      emit({ type: "done", summary: msg.content });
    } catch (err) {
      await db.project.update({ where: { id }, data: { status: current ? "PLANNING" : "DRAFT" } }).catch(() => {});
      throw err;
    }
  }, req.signal);
}
