"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { FRAMEWORKS } from "@/lib/frameworks";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

const OnboardingSchema = z.object({
  lens: z.enum(["GUIDED", "PRO"]),
  framework: z.string().refine((f) => FRAMEWORKS.some((x) => x.id === f)),
});

export async function completeOnboarding(input: { lens: "GUIDED" | "PRO"; framework: string }) {
  const user = await requireUser();
  const data = OnboardingSchema.parse(input);
  await db.user.update({ where: { id: user.id }, data: { lens: data.lens, onboarded: true } });
  return { ok: true };
}

export async function setDefaultLens(lens: "GUIDED" | "PRO") {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { lens: z.enum(["GUIDED", "PRO"]).parse(lens) } });
  revalidatePath("/settings");
}

export async function toggleStar(projectId: string) {
  const user = await requireUser();
  const p = await db.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!p) return;
  await db.project.update({ where: { id: p.id }, data: { starred: !p.starred } });
  revalidatePath("/home");
}

export async function deleteProject(projectId: string) {
  const user = await requireUser();
  await db.project.deleteMany({ where: { id: projectId, userId: user.id } });
  revalidatePath("/home");
}

export async function renameProject(projectId: string, name: string) {
  const user = await requireUser();
  const clean = z.string().trim().min(1).max(80).parse(name);
  await db.project.updateMany({ where: { id: projectId, userId: user.id }, data: { name: clean } });
  revalidatePath(`/p/${projectId}`);
}

export async function deleteAccount(confirmEmail: string) {
  const user = await requireUser();
  if (!user.email || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { error: "Type your email exactly to confirm." };
  }
  await db.user.delete({ where: { id: user.id } });
  await signOut({ redirect: false });
  redirect("/");
}
