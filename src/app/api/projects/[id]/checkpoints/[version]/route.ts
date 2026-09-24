import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { badRequest, notFound, projectForRequest } from "@/lib/route-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version } = await params;
  const v = Number(version);
  if (!Number.isInteger(v) || v < 1) return badRequest("Invalid version");
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const cp = await db.checkpoint.findUnique({ where: { projectId_version: { projectId: id, version: v } } });
  if (!cp) return notFound();
  return NextResponse.json({ version: cp.version, summary: cp.summary, files: cp.files });
}
