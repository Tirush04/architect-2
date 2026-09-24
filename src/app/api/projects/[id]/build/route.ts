import { db } from "@/lib/db";
import { runBuild } from "@/lib/engine";
import { sseResponse } from "@/lib/sse";
import { diffFiles } from "@/lib/diff";
import { addMessage, createCheckpoint, latestCheckpoint, readBlueprint, syncAgents } from "@/lib/projects";
import { badRequest, engineFor, projectForRequest } from "@/lib/route-helpers";
import type { Files } from "@/lib/schemas";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const { project, userId } = r;
  const blueprint = readBlueprint(project.blueprint);
  if (!blueprint) return badRequest("Draft and approve a Blueprint first");
  const mode = await engineFor(userId);
  const settled = project.status === "DEPLOYED" ? "DEPLOYED" : "READY";

  return sseResponse(async (emit, signal) => {
    await db.project.update({ where: { id }, data: { status: "BUILDING" } });
    const previous = await latestCheckpoint(id);
    const before = (previous?.files as Files | undefined) ?? {};
    try {
      const gen = runBuild(blueprint, project.framework, mode, signal);
      let step = await gen.next();
      while (!step.done) {
        emit(step.value);
        step = await gen.next();
      }
      const { files, summary, engine } = step.value;
      const checkpoint = await createCheckpoint(id, files, summary, engine);
      await syncAgents(id, blueprint, project.framework);
      await db.project.update({ where: { id }, data: { status: settled } });
      await addMessage(id, "assistant", summary, { kind: "build", version: checkpoint.version, engine, changes: diffFiles(before, files) });
      emit({ type: "done", summary, checkpointId: checkpoint.id, version: checkpoint.version });
    } catch (err) {
      // Reconcile from what actually persisted: a checkpoint may exist even if a later write failed.
      const now = await latestCheckpoint(id).catch(() => null);
      const status = now && now.version !== previous?.version ? settled : project.status === "BUILDING" ? "PLANNING" : project.status;
      await db.project.update({ where: { id }, data: { status } }).catch(() => {});
      throw err;
    }
  }, req.signal);
}
