import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { loadWorkspace } from "@/lib/workspace-data";
import { Workspace } from "./workspace";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await params;
  return { title: "Workspace" };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const [{ id }, { start }, user] = await Promise.all([params, searchParams, requireUser()]);
  const data = await loadWorkspace(id, user.id);
  if (!data) notFound();
  return <Workspace initial={data} autoStart={start === "1" && !data.blueprint} />;
}
