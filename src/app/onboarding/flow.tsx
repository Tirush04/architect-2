"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Code2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button, Textarea } from "@/components/ui";
import { FRAMEWORKS } from "@/lib/frameworks";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "../(app)/actions";
import { createProject } from "@/lib/client-api";

type Lens = "GUIDED" | "PRO";

const STARTERS: Record<Lens, string[]> = {
  GUIDED: [
    "An inbox where an agent answers customer questions from our help docs",
    "A tool that reads expense receipts and routes them for approval",
    "A dashboard that tracks credit-card disputes and drafts resolutions",
  ],
  PRO: [
    "A LangGraph agent that triages GitHub issues and labels them, with a review UI",
    "A RAG support bot over our docs with an admin page for evals",
    "An internal tool to review and approve AI-drafted sales emails",
  ],
};

export function OnboardingFlow({
  firstName,
  initialPrompt,
  alreadyOnboarded,
}: {
  firstName: string;
  initialPrompt: string;
  alreadyOnboarded: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [lens, setLens] = useState<Lens | null>(null);
  const [framework, setFramework] = useState("lyzr");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [pending, start] = useTransition();

  const steps = lens === "PRO" ? ["How you build", "Agent framework", "First project"] : ["How you build", "First project"];
  const last = steps.length - 1;
  const isPrompt = step === last;

  const finish = (withProject: boolean) =>
    start(async () => {
      try {
        await completeOnboarding({ lens: lens ?? "GUIDED", framework });
        if (withProject && prompt.trim().length >= 3) {
          const id = await createProject({ prompt: prompt.trim(), framework });
          router.push(`/p/${id}?start=1`);
        } else {
          router.push("/home");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  return (
    <div>
      <ol className="mb-10 flex items-center gap-3" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full border text-[11px] font-semibold",
                i < step ? "border-accent bg-accent text-accent-ink" : i === step ? "border-accent text-accent" : "border-line text-ink-3",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("text-[13px]", i === step ? "text-ink" : "text-ink-3")}>{s}</span>
            {i < steps.length - 1 && <span className="h-px w-8 bg-line" aria-hidden />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            {firstName ? `Hi ${firstName}. ` : ""}How do you like to build?
          </h1>
          <p className="mt-3 text-ink-2">This sets your default lens. Every project can switch at any time, and nothing is hidden either way.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Default lens">
            {(
              [
                {
                  id: "GUIDED" as const,
                  icon: <MessageSquareText className="h-5 w-5" />,
                  title: "I describe outcomes",
                  body: "Plain-English plans you approve, a visual agent canvas, one-click deploy. No code required.",
                  tag: "Guided lens",
                },
                {
                  id: "PRO" as const,
                  icon: <Code2 className="h-5 w-5" />,
                  title: "I write code",
                  body: "File tree, editor and diffs, agents in your framework, GitHub, env vars, API and CLI.",
                  tag: "Pro lens",
                },
              ]
            ).map((o) => (
              <button
                key={o.id}
                role="radio"
                aria-checked={lens === o.id}
                onClick={() => setLens(o.id)}
                className={cn(
                  "group rounded-xl border bg-elev p-5 text-left transition hover:border-line-strong hover:shadow-card",
                  lens === o.id ? "border-accent ring-4 ring-accent/15" : "border-line",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent">{o.icon}</span>
                  <span className="annotation">{o.tag}</span>
                </div>
                <p className="mt-4 text-lg font-semibold">{o.title}</p>
                <p className="mt-1 text-sm text-ink-2">{o.body}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {lens === "PRO" && step === 1 && (
        <section>
          <h1 className="font-display text-4xl tracking-tight">Pick a default agent framework</h1>
          <p className="mt-3 text-ink-2">Architect scaffolds agents as real code in this framework. You can change it per project, or per agent.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Agent framework">
            {FRAMEWORKS.map((f) => (
              <button
                key={f.id}
                role="radio"
                aria-checked={framework === f.id}
                onClick={() => setFramework(f.id)}
                className={cn(
                  "rounded-xl border bg-elev p-4 text-left transition hover:border-line-strong",
                  framework === f.id ? "border-accent ring-4 ring-accent/15" : "border-line",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{f.name}</p>
                  <span className="annotation">{f.language}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink-2">{f.blurb}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {isPrompt && step > 0 && (
        <section>
          <h1 className="font-display text-4xl tracking-tight">What should we build first?</h1>
          <p className="mt-3 text-ink-2">Describe the job to be done. Architect drafts a Blueprint for you to approve before anything is built.</p>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            autoFocus
            aria-label="Describe your first app"
            placeholder="e.g. An app where an agent reads dispute emails and drafts resolutions for my team to approve"
            className="mt-6 text-[15px]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {STARTERS[lens ?? "GUIDED"].map((s) => (
              <button key={s} onClick={() => setPrompt(s)} className="rounded-full border border-line bg-elev px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-accent hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between">
        <div>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : alreadyOnboarded ? (
            <Link href="/home" className="text-sm text-ink-3 hover:text-ink">
              Skip
            </Link>
          ) : (
            <span />
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPrompt && step > 0 && (
            <Button variant="ghost" onClick={() => finish(false)} disabled={pending}>
              I&apos;ll explore first
            </Button>
          )}
          {isPrompt && step > 0 ? (
            <Button size="lg" onClick={() => finish(true)} loading={pending} disabled={prompt.trim().length < 3}>
              Draft my Blueprint <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !lens}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
