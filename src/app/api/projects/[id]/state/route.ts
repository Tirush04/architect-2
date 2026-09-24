import { NextResponse } from "next/server";
import { sessionUserId } from "@/lib/session";
import { loadWorkspace } from "@/lib/workspace-data";
import { notFound, unauthorized } from "@/lib/route-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const data = await loadWorkspace(id, userId);
  if (!data) return notFound();
  return NextResponse.json(data);
}
