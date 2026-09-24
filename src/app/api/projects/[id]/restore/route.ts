import { NextResponse } from "next/server";
import { LIMITS, readJson } from "@/lib/body";
import { z } from "zod";
import { db } from "@/lib/db";
import { addMessage, createCheckpoint } from "@/lib/projects";
import { badRequest, notFound, projectForRequest } from "@/lib/route-helpers";
import type { Files } from "@/lib/schemas";

/** Non-destructive rollback: copies an old checkpoint forward as a new version. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = await readJson(req, LIMITS.small);
  if (!raw.ok) return raw.response;
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const parsed = z.object({ version: z.number().int().positive() }).safeParse(raw.data);
  if (!parsed.success) return badRequest("version is required");
  const source = await db.checkpoint.findUnique({ where: { projectId_version: { projectId: id, version: parsed.data.version } } });
  if (!source) return notFound();
  const cp = await createCheckpoint(id, source.files as Files, `Restored v${source.version}`, source.engine);
  await addMessage(id, "assistant", `Restored v${source.version} as v${cp.version}. Nothing was deleted, so you can always go forward again.`, {
    kind: "build",
    version: cp.version,
    engine: source.engine,
  });
  return NextResponse.json({ version: cp.version, files: source.files });
}
