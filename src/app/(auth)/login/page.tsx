import type { Metadata } from "next";
import { oauthConfigured } from "@/auth";
import { authErrorMessage, safeRedirect } from "@/lib/redirects";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; code?: string; prompt?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = sp.prompt
    ? `/onboarding?prompt=${encodeURIComponent(sp.prompt.slice(0, 2000))}`
    : safeRedirect(sp.callbackUrl);
  const initialError = authErrorMessage(sp.code ?? sp.error);
  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight">Welcome back</h1>
      <p className="mb-7 mt-2 text-sm text-ink-2">Pick up where you left off.</p>
      <LoginForm configured={oauthConfigured} callbackUrl={callbackUrl} initialError={initialError} />
    </div>
  );
}
