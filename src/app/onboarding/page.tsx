import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { OnboardingFlow } from "./flow";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ prompt?: string }> }) {
  const user = await requireUser();
  const { prompt } = await searchParams;
  if (user.onboarded && !prompt) redirect("/home");
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-5xl items-center px-6">
        <Logo href="/home" />
      </header>
      <main id="main" className="mx-auto max-w-3xl px-6 pb-20 pt-6">
        <OnboardingFlow firstName={(user.name ?? "").split(" ")[0]} initialPrompt={prompt?.slice(0, 2000) ?? ""} alreadyOnboarded={user.onboarded} />
      </main>
    </div>
  );
}
