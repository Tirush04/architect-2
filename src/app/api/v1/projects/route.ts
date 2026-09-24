import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashApiKey, parseBearer } from "@/lib/api-keys";

/** Public REST API: list projects for the API key's owner. */
export async function GET(req: Request) {
  const key = parseBearer(req.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Missing or malformed API key" }, { status: 401 });
  const record = await db.apiKey.findUnique({ where: { hash: hashApiKey(key) } });
  if (!record) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  await db.apiKey.update({ where: { id: record.id }, data: { lastUsed: new Date() } });
  const projects = await db.project.findMany({
    where: { userId: record.userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      framework: true,
      githubRepo: true,
      shareSlug: true,
      updatedAt: true,
      _count: { select: { checkpoints: true, agents: true } },
    },
  });
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    data: projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status.toLowerCase(),
      framework: p.framework,
      versions: p._count.checkpoints,
      agents: p._count.agents,
      github: p.githubRepo,
      url: p.shareSlug ? `${origin}/share/${p.shareSlug}` : null,
      updatedAt: p.updatedAt,
    })),
  });
}
