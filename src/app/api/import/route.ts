import { NextResponse } from "next/server";
import { LIMITS, readJson } from "@/lib/body";
import { z } from "zod";
import { sessionUserId } from "@/lib/session";
import { githubFor, isAuthError } from "@/lib/github-client";
import { detectStack, guessAgentFramework, importRepo, parseRepo, type CodebaseMap } from "@/lib/github";
import { isSafePath } from "@/lib/engine/file-stream-parser";
import { createImportedProject } from "@/lib/import-project";
import { MAX_FILE_BYTES } from "@/lib/projects";
import { badRequest, unauthorized } from "@/lib/route-helpers";
import { usageStatus } from "@/lib/rate-limit";
import { prismaUsageStore } from "@/lib/usage";
import type { Files } from "@/lib/schemas";

export const maxDuration = 120;

const RepoSchema = z.object({ kind: z.literal("github"), repo: z.string().max(200) });
const UploadSchema = z.object({
  kind: z.literal("upload"),
  name: z.string().trim().min(1).max(80),
  files: z.record(z.string(), z.string().max(MAX_FILE_BYTES)),
});

export async function POST(req: Request) {
  const raw = await readJson(req, LIMITS.upload);
  if (!raw.ok) return raw.response;
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const quota = await usageStatus(prismaUsageStore, userId, "import", new Date(), 30);
  if (quota.overLimit) return NextResponse.json({ error: "Daily import limit reached. Try again tomorrow." }, { status: 429 });
  await prismaUsageStore.record(userId, "import");
  const body = raw.data;

  const repo = RepoSchema.safeParse(body);
  if (repo.success) {
    const parsed = parseRepo(repo.data.repo);
    if (!parsed) return badRequest("Use the owner/repo format");
    const gh = await githubFor(userId);
    if (!gh) return NextResponse.json({ error: "Connect GitHub first", needsConnect: true }, { status: 409 });
    try {
      const { files, map } = await importRepo(gh, repo.data.repo);
      const project = await createImportedProject({
        userId,
        name: parsed.repo,
        files,
        map,
        githubRepo: `${parsed.owner}/${parsed.repo}`,
        sourceLabel: `${parsed.owner}/${parsed.repo}`,
      });
      return NextResponse.json({ id: project.id }, { status: 201 });
    } catch (err) {
      if (isAuthError(err)) return NextResponse.json({ error: "GitHub denied access to that repository.", needsConnect: true }, { status: 409 });
      const status = (err as { status?: number })?.status;
      if (status === 404) return badRequest("Repository not found, or you don't have access to it");
      return NextResponse.json({ error: "Import failed" }, { status: 502 });
    }
  }

  const upload = UploadSchema.safeParse(body);
  if (upload.success) {
    const files: Files = {};
    for (const [path, content] of Object.entries(upload.data.files)) {
      if (isSafePath(path)) files[path] = content;
    }
    const paths = Object.keys(files);
    if (paths.length === 0) return badRequest("No readable text files found");
    if (paths.length > 120) return badRequest("Upload at most 120 files");
    let pkg: Record<string, unknown> | null = null;
    try {
      pkg = files["package.json"] ? JSON.parse(files["package.json"]) : null;
    } catch {
      pkg = null;
    }
    const stack = detectStack(pkg, paths, files["requirements.txt"]);
    const dirs = new Map<string, number>();
    for (const p of paths) {
      const d = p.includes("/") ? p.split("/")[0] : "(root)";
      dirs.set(d, (dirs.get(d) ?? 0) + 1);
    }
    const map: CodebaseMap = {
      stack,
      frameworkGuess: guessAgentFramework(stack),
      totalFiles: paths.length,
      importedFiles: paths.length,
      truncated: false,
      entryPoints: paths.filter((p) => /(^|\/)(index\.html|main\.(py|ts|tsx|js)|app\.(py|ts|tsx|js)|page\.tsx)$/.test(p)).slice(0, 8),
      topDirs: [...dirs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([dir, n]) => ({ dir, files: n })),
    };
    const project = await createImportedProject({ userId, name: upload.data.name, files, map, sourceLabel: "an uploaded folder" });
    return NextResponse.json({ id: project.id }, { status: 201 });
  }

  return badRequest("Invalid import request");
}
