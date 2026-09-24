import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushFiles } from "@/lib/github";
import { githubFor, isAuthError } from "@/lib/github-client";
import { addMessage, latestCheckpoint } from "@/lib/projects";
import { badRequest, projectForRequest } from "@/lib/route-helpers";
import type { Blueprint, Files } from "@/lib/schemas";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await projectForRequest(id);
  if ("error" in r) return r.error;
  const { project, userId } = r;
  const gh = await githubFor(userId);
  if (!gh) return NextResponse.json({ error: "Connect GitHub first", needsConnect: true }, { status: 409 });
  const cp = await latestCheckpoint(id);
  if (!cp) return badRequest("Build the app before pushing");
  const bp = project.blueprint as Blueprint | null;
  try {
    const res = await pushFiles(gh, {
      existing: project.githubRepo,
      appName: project.name,
      description: bp?.tagline ?? project.prompt,
      files: cp.files as Files,
      message: `Architect v${cp.version}: ${cp.summary}`.slice(0, 200),
    });
    await db.project.update({ where: { id }, data: { githubRepo: res.fullName } });
    await addMessage(id, "assistant", `Pushed v${cp.version} to ${res.fullName}.`, { kind: "github", url: res.url, version: cp.version });
    return NextResponse.json(res);
  } catch (err) {
    if (isAuthError(err)) {
      return NextResponse.json({ error: "GitHub rejected the token. Reconnect GitHub to grant repo access.", needsConnect: true }, { status: 409 });
    }
    const message = (err as { message?: string })?.message ?? "Push failed";
    return NextResponse.json({ error: `GitHub push failed: ${message}` }, { status: 502 });
  }
}
