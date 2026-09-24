"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { SignupSchema } from "@/lib/schemas";
import { authErrorMessage, safeRedirect } from "@/lib/redirects";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

function withPrompt(path: string, prompt: string | null) {
  if (!prompt) return path;
  return `${path}${path.includes("?") ? "&" : "?"}prompt=${encodeURIComponent(prompt.slice(0, 2000))}`;
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const parsed = SignupSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      fieldErrors[k] ??= issue.message;
    }
    return { fieldErrors, values };
  }
  const { name, email, password } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { fieldErrors: { email: "An account with this email already exists. Sign in instead." }, values };
  }
  await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });

  const prompt = (formData.get("prompt") as string | null) || null;
  try {
    await signIn("credentials", { email, password, redirectTo: withPrompt("/onboarding", prompt) });
  } catch (err) {
    if (err instanceof AuthError) return { error: authErrorMessage("Default") ?? undefined, values };
    throw err;
  }
  return {};
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const redirectTo = safeRedirect(formData.get("callbackUrl") as string | null);
  try {
    await signIn("credentials", { email, password: String(formData.get("password") ?? ""), redirectTo });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code ?? err.type;
      return { error: authErrorMessage(code) ?? undefined, values: { email } };
    }
    throw err;
  }
  return {};
}

export async function oauthAction(formData: FormData) {
  const provider = String(formData.get("provider"));
  if (provider !== "github" && provider !== "google") return;
  const prompt = (formData.get("prompt") as string | null) || null;
  const redirectTo = prompt ? withPrompt("/onboarding", prompt) : safeRedirect(formData.get("callbackUrl") as string | null);
  await signIn(provider, { redirectTo });
}
