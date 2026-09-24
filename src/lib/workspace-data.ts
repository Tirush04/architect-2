import "server-only";
import { db } from "@/lib/db";
import { oauthConfigured } from "@/auth";
import type { Blueprint, Files } from "@/lib/schemas";
import { readBlueprint } from "@/lib/projects";
import { usageStatus } from "@/lib/rate-limit";
import { prismaUsageStore } from "@/lib/usage";
import { selectEngine } from "@/lib/engine";

export type WorkspaceMessage = {
  id: string;
  role: string;
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type WorkspaceData = {
  project: {
    id: string;
    name: string;
    prompt: string;
    lens: "GUIDED" | "PRO";
    framework: string;
    status: string;
    source: string;
    githubRepo: string | null;
    shareSlug: string | null;
  };
  blueprint: Blueprint | null;
  messages: WorkspaceMessage[];
  checkpoints: Array<{ version: number; summary: string; engine: string; createdAt: string }>;
  files: Files;
  version: number;
  deployments: Array<{ id: string; version: number; url: string; createdAt: string; env: string }>;
  github: { configured: boolean; connected: boolean };
  engine: { mode: "claude" | "demo"; reason?: string; used: number; limit: number };
};

export async function loadWorkspace(projectId: string, userId: string): Promise<WorkspaceData | null> {
  const project = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return null;
  const [messages, checkpoints, latest, deployments, gh, usage] = await Promise.all([
    db.message.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, take: 200 }),
    db.checkpoint.findMany({ where: { projectId }, orderBy: { version: "desc" }, select: { version: true, summary: true, engine: true, createdAt: true } }),
    db.checkpoint.findFirst({ where: { projectId }, orderBy: { version: "desc" }, select: { files: true, version: true } }),
    db.deployment.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 20, include: { checkpoint: { select: { version: true } } } }),
    db.account.findFirst({ where: { userId, provider: "github" }, select: { providerAccountId: true } }),
    usageStatus(prismaUsageStore, userId),
  ]);
  const mode = selectEngine({ overLimit: usage.overLimit });
  return {
    project: {
      id: project.id,
      name: project.name,
      prompt: project.prompt,
      lens: project.lens,
      framework: project.framework,
      status: project.status,
      source: project.source,
      githubRepo: project.githubRepo,
      shareSlug: project.shareSlug,
    },
    blueprint: readBlueprint(project.blueprint),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      meta: (m.meta as Record<string, unknown> | null) ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    checkpoints: checkpoints.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    files: (latest?.files as Files | undefined) ?? {},
    version: latest?.version ?? 0,
    deployments: deployments.map((d) => ({ id: d.id, version: d.checkpoint.version, url: d.url, createdAt: d.createdAt.toISOString(), env: d.env })),
    github: { configured: oauthConfigured.github, connected: !!gh },
    engine: { mode: mode.claude ? "claude" : "demo", reason: mode.reason, used: usage.used, limit: usage.limit },
  };
}
