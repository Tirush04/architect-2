import { NextResponse } from "next/server";
import { LIMITS, readJson } from "@/lib/body";
import { z } from "zod";
import { isSafePath } from "@/lib/engine/file-stream-parser";
import { diffFiles } from "@/lib/diff";
import { addMessage, createCheckpoint, latestCheckpoint, MAX_FILE_BYTES, MAX_FILES } from "@/lib/projects";
import { badRequest, projectForRequest } from "@/lib/route-helpers";
import type { Files } from "@/lib/schemas";

const SaveSchema = z.object({
  path: z.string().refine(isSafePath, "Invalid file path"),
  content: z.string().max(MAX_FILE_BYTES, "File is too large"),
  remove: z.boolean().optional(),
});

/** Save a manual edit (Pro lens) as a new checkpoint. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = await readJson(req, LIMITS.medium);
  if (!raw.ok) return raw.response;
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const parsed = SaveSchema.safeParse(raw.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  const { path, content, remove } = parsed.data;
  const latest = await latestCheckpoint(id);
  const before = (latest?.files as Files | undefined) ?? {};
  const next: Files = { ...before };
  if (remove) delete next[path];
  else next[path] = content;
  if (Object.keys(next).length > MAX_FILES) return badRequest("Too many files");
  if (JSON.stringify(next) === JSON.stringify(before)) return NextResponse.json({ version: latest?.version ?? 0, unchanged: true });
  const summary = remove ? `Deleted ${path}` : before[path] === undefined ? `Created ${path}` : `Edited ${path}`;
  const cp = await createCheckpoint(id, next, summary, "manual");
  await addMessage(id, "assistant", summary, { kind: "build", version: cp.version, engine: "manual", changes: diffFiles(before, next) });
  return NextResponse.json({ version: cp.version });
}
