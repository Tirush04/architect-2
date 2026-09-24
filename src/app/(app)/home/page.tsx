import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { Blueprint, Files } from "@/lib/schemas";
import { HomeView, type ProjectCard } from "./view";

export const metadata: Metadata = { title: "Projects" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ prompt?: string }> }) {
  const user = await requireUser();
  const { prompt } = await searchParams;
  if (!user.onboarded) redirect(prompt ? `/onboarding?prompt=${encodeURIComponent(prompt)}` : "/onboarding");

  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: [{ starred: "desc" }, { updatedAt: "desc" }],
    take: 60,
    select: {
      id: true,
      name: true,
      status: true,
      framework: true,
      source: true,
      starred: true,
      updatedAt: true,
      blueprint: true,
      shareSlug: true,
      _count: { select: { checkpoints: true, agents: true } },
    },
  });
  const latest = await db.checkpoint.findMany({
    where: { projectId: { in: projects.slice(0, 12).map((p) => p.id) } },
    orderBy: { version: "desc" },
    distinct: ["projectId"],
    select: { projectId: true, files: true },
  });
  const previewById = new Map(latest.map((c) => [c.projectId, ((c.files as Files) ?? {})["index.html"] ?? null]));

  const cards: ProjectCard[] = projects.map((p) => {
    const bp = p.blueprint as Blueprint | null;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      framework: p.framework,
      source: p.source,
      starred: p.starred,
      updatedAt: p.updatedAt.toISOString(),
      accent: bp?.theme?.accent ?? "#2346d8",
      agents: bp?.agents?.length ?? 0,
      versions: p._count.checkpoints,
      live: !!p.shareSlug && p.status === "DEPLOYED",
      preview: previewById.get(p.id) ?? null,
    };
  });

  return <HomeView firstName={(user.name ?? "").split(" ")[0]} projects={cards} initialPrompt={prompt?.slice(0, 2000) ?? ""} lens={user.lens} />;
}
