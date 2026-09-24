import { db } from "@/lib/db";
import { escapeHtml } from "@/lib/engine/render-app";
import { sharedAppHeaders } from "@/lib/share";
import type { Files } from "@/lib/schemas";

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font:15px/1.6 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f7f6f2;color:#16181d}main{max-width:520px;padding:24px}code{background:#efede6;padding:2px 6px;border-radius:4px}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: sharedAppHeaders() },
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return page("Not found", "<h1>Not found</h1>", 404);
  const project = await db.project.findUnique({ where: { shareSlug: slug }, select: { id: true, name: true } });
  if (!project) return page("Not found", "<h1>This app isn't deployed</h1><p>Check the link, or ask the owner to deploy it again.</p>", 404);
  const deployment = await db.deployment.findFirst({
    where: { projectId: project.id, status: "live" },
    orderBy: { createdAt: "desc" },
    include: { checkpoint: { select: { files: true } } },
  });
  const files = (deployment?.checkpoint.files as Files | undefined) ?? {};
  const html = files["index.html"];
  if (!html) {
    const list = Object.keys(files)
      .slice(0, 30)
      .map((f) => `<li><code>${escapeHtml(f)}</code></li>`)
      .join("");
    return page(project.name, `<h1>${escapeHtml(project.name)}</h1><p>This project has no web entry point (<code>index.html</code>) yet. Its files:</p><ul>${list}</ul>`);
  }
  return new Response(html, { headers: sharedAppHeaders() });
}
