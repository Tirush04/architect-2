import type { Metadata } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { oauthConfigured } from "@/auth";
import { usageStatus } from "@/lib/rate-limit";
import { prismaUsageStore } from "@/lib/usage";
import { selectEngine } from "@/lib/engine";
import { SettingsView } from "./view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [accounts, keys, usage, projects, deployments] = await Promise.all([
    db.account.findMany({ where: { userId: user.id }, select: { provider: true } }),
    db.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, prefix: true, createdAt: true, lastUsed: true } }),
    usageStatus(prismaUsageStore, user.id),
    db.project.count({ where: { userId: user.id } }),
    db.deployment.count({ where: { project: { userId: user.id } } }),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  return (
    <SettingsView
      origin={origin}
      user={{ name: user.name ?? "", email: user.email ?? "", lens: user.lens, hasPassword: !!user.passwordHash }}
      linked={{ github: accounts.some((a) => a.provider === "github"), google: accounts.some((a) => a.provider === "google") }}
      configured={oauthConfigured}
      keys={keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsed: k.lastUsed?.toISOString() ?? null }))}
      usage={{ ...usage, engine: selectEngine({ overLimit: usage.overLimit }).claude ? "claude" : "demo", projects, deployments }}
    />
  );
}
