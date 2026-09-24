import "server-only";
import { Octokit } from "octokit";
import { db } from "@/lib/db";
import type { GitHubRest } from "@/lib/github";

export async function githubAccount(userId: string) {
  return db.account.findFirst({ where: { userId, provider: "github" }, select: { access_token: true, scope: true, providerAccountId: true } });
}

/** Octokit REST client for the user's linked GitHub account, or null if not connected. */
export async function githubFor(userId: string): Promise<GitHubRest | null> {
  const acct = await githubAccount(userId);
  if (!acct?.access_token) return null;
  const octokit = new Octokit({ auth: acct.access_token, userAgent: "architect-2" });
  return octokit.rest as unknown as GitHubRest;
}

export function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403;
}
