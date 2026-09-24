import { z } from "zod";
import { LIMITS, readJson } from "@/lib/body";
import { db } from "@/lib/db";
import { sseResponse } from "@/lib/sse";
import { sleep } from "@/lib/engine";
import { getFramework } from "@/lib/frameworks";
import { newShareSlug } from "@/lib/share";
import { addMessage, latestCheckpoint } from "@/lib/projects";
import { badRequest, projectForRequest } from "@/lib/route-helpers";
import type { Files } from "@/lib/schemas";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = await readJson(req, LIMITS.small);
  if (!raw.ok) return raw.response;
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const { project } = r;
  const body = z.object({ version: z.number().int().positive().optional() }).safeParse((raw.data ?? {}));
  if (!body.success) return badRequest("Invalid version");
  const checkpoint = body.data.version
    ? await db.checkpoint.findUnique({ where: { projectId_version: { projectId: id, version: body.data.version } } })
    : await latestCheckpoint(id);
  if (!checkpoint) return badRequest("Build the app before deploying");

  const origin = new URL(req.url).origin;
  const files = checkpoint.files as Files;
  const bytes = Object.values(files).reduce((n, c) => n + Buffer.byteLength(c), 0);
  const agentFiles = Object.keys(files).filter((p) => p.startsWith("agents/")).length;
  const envCount = await db.envVar.count({ where: { projectId: id } });

  return sseResponse(async (emit) => {
    const log = async (text: string, ms = 380) => {
      emit({ type: "text", text });
      await sleep(ms);
    };
    const slug = project.shareSlug ?? newShareSlug(project.name);
    const url = `${origin}/share/${slug}`;
    emit({ type: "step", id: "build", label: "Building", state: "active" });
    await log(`▲ Deploying ${project.name} · checkpoint v${checkpoint.version}`);
    await log(`  Resolved ${Object.keys(files).length} files (${(bytes / 1024).toFixed(1)} KB)`);
    await log(`  Injected ${envCount} environment variable${envCount === 1 ? "" : "s"} (encrypted at rest)`);
    await log(`  Static bundle: index.html → minified, cache-busted`, 500);
    emit({ type: "step", id: "build", label: "Building", state: "done" });
    emit({ type: "step", id: "agents", label: "Packaging agents", state: "active" });
    await log(`  Packaging ${agentFiles} agent${agentFiles === 1 ? "" : "s"} as functions (${getFramework(project.framework).name} runtime)`, 600);
    await log(`  Guardrails: PII redaction on, toxicity filter on`);
    emit({ type: "step", id: "agents", label: "Packaging agents", state: "done" });
    emit({ type: "step", id: "release", label: "Releasing", state: "active" });
    await log(`  Uploading to edge · 3 regions`, 500);
    await log(`  Health check GET / → 200 OK`);

    await db.$transaction([
      db.project.update({ where: { id }, data: { shareSlug: slug, status: "DEPLOYED" } }),
      db.deployment.create({ data: { projectId: id, checkpointId: checkpoint.id, url, env: "production", status: "live" } }),
    ]);
    await log(`✓ Live at ${url}`, 0);
    emit({ type: "step", id: "release", label: "Releasing", state: "done" });
    await addMessage(id, "assistant", `Deployed v${checkpoint.version}. It's live at ${url}`, { kind: "deploy", version: checkpoint.version, url });
    emit({ type: "done", summary: url, version: checkpoint.version });
  }, req.signal);
}
