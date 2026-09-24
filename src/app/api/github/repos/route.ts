import { NextResponse } from "next/server";
import { sessionUserId } from "@/lib/session";
import { githubFor, isAuthError } from "@/lib/github-client";
import { unauthorized } from "@/lib/route-helpers";

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const gh = await githubFor(userId);
  if (!gh) return NextResponse.json({ connected: false, repos: [] });
  try {
    const { data } = await gh.repos.listForAuthenticatedUser({ sort: "updated", per_page: 50, affiliation: "owner,collaborator" });
    return NextResponse.json({
      connected: true,
      repos: data.map((r) => ({
        fullName: r.full_name,
        description: r.description,
        private: r.private,
        language: r.language,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    if (isAuthError(err)) return NextResponse.json({ connected: false, repos: [], error: "Reconnect GitHub" });
    return NextResponse.json({ connected: true, repos: [], error: "Couldn't load repositories" }, { status: 502 });
  }
}
