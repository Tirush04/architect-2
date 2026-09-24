import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";
import { badRequest, projectForRequest } from "@/lib/route-helpers";

const KeySchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/, "Use UPPER_SNAKE_CASE (A-Z, 0-9, _)");

async function list(projectId: string) {
  const vars = await db.envVar.findMany({ where: { projectId }, orderBy: { key: "asc" } });
  return vars.map((v) => {
    let masked = "••••";
    try {
      masked = maskSecret(decryptSecret(v.value));
    } catch {
      // key rotated; value unreadable
    }
    return { key: v.key, masked };
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  return NextResponse.json({ vars: await list(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const parsed = z.object({ key: KeySchema, value: z.string().min(1).max(4000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid variable");
  const { key, value } = parsed.data;
  if ((await db.envVar.count({ where: { projectId: id } })) >= 50) return badRequest("Limit of 50 variables");
  await db.envVar.upsert({
    where: { projectId_key: { projectId: id, key } },
    create: { projectId: id, key, value: encryptSecret(value) },
    update: { value: encryptSecret(value) },
  });
  return NextResponse.json({ vars: await list(id) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!KeySchema.safeParse(key).success) return badRequest("Invalid key");
  await db.envVar.deleteMany({ where: { projectId: id, key } });
  return NextResponse.json({ vars: await list(id) });
}
