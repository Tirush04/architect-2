import { NextResponse } from "next/server";
import { LIMITS, readJson } from "@/lib/body";
import { db } from "@/lib/db";
import { sessionUserId } from "@/lib/session";
import { CreateProjectSchema } from "@/lib/schemas";
import { getFramework } from "@/lib/frameworks";
import { getTemplate } from "@/lib/templates";
import { titleFromPrompt } from "@/lib/utils";
import { usageStatus } from "@/lib/rate-limit";
import { prismaUsageStore } from "@/lib/usage";

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projects = await db.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, framework: true, updatedAt: true, shareSlug: true },
  });
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const raw = await readJson(req, LIMITS.small);
  if (!raw.ok) return raw.response;
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = raw.data;
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const quota = await usageStatus(prismaUsageStore, userId, "project", new Date(), 100);
  if (quota.overLimit) return NextResponse.json({ error: "Daily project limit reached. Try again tomorrow." }, { status: 429 });
  await prismaUsageStore.record(userId, "project");
  const template = getTemplate(parsed.data.templateId);
  const prompt = parsed.data.prompt;
  const user = await db.user.findUnique({ where: { id: userId }, select: { lens: true } });
  const project = await db.project.create({
    data: {
      userId,
      name: template?.name ?? titleFromPrompt(prompt),
      prompt,
      framework: getFramework(parsed.data.framework).id,
      lens: user?.lens ?? "GUIDED",
      source: template ? "template" : "prompt",
      status: "PLANNING",
      messages: { create: { role: "user", content: prompt } },
    },
    select: { id: true },
  });
  return NextResponse.json({ id: project.id }, { status: 201 });
}
