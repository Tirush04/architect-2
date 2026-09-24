import Link from "next/link";
import { ArrowRight, Bot, FileCode2, Rocket, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { ComparisonTable, HeroPrompt, LensDemo } from "@/components/marketing";
import { FRAMEWORKS } from "@/lib/frameworks";

const STEPS = [
  { icon: Sparkles, title: "Blueprint", body: "Your idea becomes pages, data, agents and integrations, in plain English. You approve it before any code exists." },
  { icon: FileCode2, title: "Build", body: "Watch the app assemble live. Every turn is a checkpoint you can diff or roll back." },
  { icon: Bot, title: "Agents", body: "Tune agents on a canvas or in code: Lyzr, LangGraph, CrewAI, OpenAI Agents, Claude Agent SDK, AutoGen." },
  { icon: Rocket, title: "Ship", body: "Push to GitHub, deploy with a checklist, share a live URL. Roll back any deploy in one click." },
];

export default async function LandingPage() {
  const session = await auth();
  const signedIn = !!session?.user;
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="blueprint-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_40%,transparent_75%)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center sm:pt-28">
          <p className="annotation">Architect 2.0 · for business teams and developers</p>
          <h1 className="mx-auto mt-5 max-w-4xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
            Describe it. <span className="italic text-accent">Or</span> code it.
            <br />
            Ship the agents either way.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-2">
            Architect turns an idea into a planned, working agentic app: a Blueprint you approve, agents in the framework you
            choose, and one project your ops lead and your engineers can both work in.
          </p>
          <HeroPrompt signedIn={signedIn} />
        </div>
      </section>

      <section className="border-y border-line bg-sunken/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="annotation">One project, two lenses</p>
            <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">Switch the lens, not the tool</h2>
            <p className="mt-4 text-ink-2">
              Business users see plain-English plans, a visual agent flow and a deploy checklist. Developers see files, diffs and
              agent code. It&apos;s the same project, so the handoff is a toggle instead of a rewrite.
            </p>
          </div>
          <LensDemo />
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <p className="annotation">How it works</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">From idea to live agents in four sheets</h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-line bg-elev p-5">
              <span className="annotation">Sheet 0{i + 1}</span>
              <s.icon className="mt-4 h-6 w-6 text-accent" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8 max-w-2xl">
          <p className="annotation">Where it fits</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight">Why not just use an app builder or a coding agent?</h2>
          <p className="mt-3 text-ink-2">App builders own the visual loop. Coding agents own the repo loop. Neither treats agents as the product.</p>
        </div>
        <ComparisonTable />
      </section>

      <section className="border-t border-line py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="annotation text-center">Agents in the framework you already use</p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {FRAMEWORKS.map((f) => (
              <li key={f.id} className="rounded-full border border-line bg-elev px-4 py-2 text-sm text-ink-2">
                {f.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center text-bg">
          <div className="blueprint-grid absolute inset-0 opacity-40" aria-hidden />
          <h2 className="relative font-display text-4xl tracking-tight sm:text-5xl">Your first agent is one sentence away.</h2>
          <Link
            href={signedIn ? "/home" : "/signup"}
            className="relative mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-6 font-medium text-accent-ink hover:brightness-110"
          >
            {signedIn ? "Open Architect" : "Start building free"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
