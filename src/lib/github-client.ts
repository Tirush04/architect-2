import "server-only";
import { Octokit } from "octokit";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { GitHubRest } from "@/lib/github";

export async function githubAccount(userId: string) {
  return db.account.findFirst({ where: { userId, provider: "github" }, select: { access_token: true, scope: true, providerAccountId: true } });
}

/** Octokit REST client for the user's linked GitHub account, or null if not connected. */
export async function githubFor(userId: string): Promise<GitHubRest | null> {
  const acct = await githubAccount(userId);
  if (!acct?.access_token) return null;
  let token: string;
  try {
    token = decryptSecret(acct.access_token);
  } catch {
    // Unreadable (e.g. AUTH_SECRET rotated): treat as disconnected so the user reconnects.
    return null;
  }
  const octokit = new Octokit({ auth: token, userAgent: "architect-2" });
  return octokit.rest as unknown as GitHubRest;
}

export function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403;
}
