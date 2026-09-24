import type { Metadata } from "next";
import { oauthConfigured } from "@/auth";
import { SignupForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ prompt?: string }> }) {
  const { prompt } = await searchParams;
  const p = prompt?.slice(0, 2000);
  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight">Start building</h1>
      <p className="mb-7 mt-2 text-sm text-ink-2">
        {p ? (
          <>
            We&apos;ll plan <span className="font-medium text-ink">“{p.length > 70 ? p.slice(0, 70) + "…" : p}”</span> as soon as you&apos;re in.
          </>
        ) : (
          "Free to start. No credit card."
        )}
      </p>
      <SignupForm configured={oauthConfigured} prompt={p} />
    </div>
  );
}
