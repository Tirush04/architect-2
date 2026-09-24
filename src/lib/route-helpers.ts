import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionUserId } from "@/lib/session";
import { usageStatus } from "@/lib/rate-limit";
import { prismaUsageStore } from "@/lib/usage";
import { selectEngine, type EngineMode } from "@/lib/engine";

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

/** Resolve the signed-in user's project, or an error response. */
export async function projectForRequest(id: string) {
  const userId = await sessionUserId();
  if (!userId) return { error: unauthorized() } as const;
  const project = await db.project.findFirst({ where: { id, userId } });
  if (!project) return { error: notFound() } as const;
  return { userId, project } as const;
}

/** Pick the engine for this user and record usage when the real model will be called. */
export async function engineFor(userId: string): Promise<EngineMode> {
  const usage = await usageStatus(prismaUsageStore, userId);
  const mode = selectEngine({ overLimit: usage.overLimit });
  if (mode.claude) await prismaUsageStore.record(userId, "ai");
  return mode;
}
