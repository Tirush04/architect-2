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

  return sseResponse(async (emit, signal) => {
    await db.project.update({ where: { id }, data: { status: "BUILDING" } });
    const before = ((await latestCheckpoint(id))?.files as Files | undefined) ?? {};
    let result;
    let checkpoint;
    try {
      const gen = runBuild(blueprint, project.framework, mode, signal);
      let step = await gen.next();
      while (!step.done) {
        emit(step.value);
        step = await gen.next();
      }
      result = step.value;
      checkpoint = await createCheckpoint(id, result.files, result.summary, result.engine);
    } catch (err) {
      await db.project.update({ where: { id }, data: { status: project.status } });
      throw err;
    }
    const { files, summary, engine } = result;
    await syncAgents(id, blueprint, project.framework);
    await db.project.update({ where: { id }, data: { status: project.status === "DEPLOYED" ? "DEPLOYED" : "READY" } });
    const changes = diffFiles(before, files);
    await addMessage(id, "assistant", summary, { kind: "build", version: checkpoint.version, engine, changes });
    emit({ type: "done", summary, checkpointId: checkpoint.id, version: checkpoint.version });
  }, req.signal);
}
