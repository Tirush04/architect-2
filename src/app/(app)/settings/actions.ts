"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { generateApiKey } from "@/lib/api-keys";

export async function updateProfile(name: string) {
  const user = await requireUser();
  const clean = z.string().trim().min(1).max(80).parse(name);
  await db.user.update({ where: { id: user.id }, data: { name: clean } });
  revalidatePath("/settings");
}

export async function createApiKey(name: string): Promise<{ key?: string; error?: string }> {
  const user = await requireUser();
  const parsed = z.string().trim().min(1).max(40).safeParse(name);
  if (!parsed.success) return { error: "Give the key a name" };
  if ((await db.apiKey.count({ where: { userId: user.id } })) >= 10) return { error: "Limit of 10 keys" };
  const { key, prefix, hash } = generateApiKey();
  await db.apiKey.create({ data: { userId: user.id, name: parsed.data, prefix, hash } });
  revalidatePath("/settings");
  return { key };
}

export async function revokeApiKey(id: string) {
  const user = await requireUser();
  await db.apiKey.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/settings");
}
