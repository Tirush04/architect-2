"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Triage credit-card disputes from email",
  "AI support inbox over our help docs",
  "Screen resumes and book interviews",
  "A CRM that follows up on quiet deals",
];

export function HeroPrompt({ signedIn }: { signedIn: boolean }) {
  const [prompt, setPrompt] = useState("");
  const router = useRouter();
  const go = (p: string) => {
    const q = encodeURIComponent(p.trim());
    router.push(signedIn ? `/home?prompt=${q}` : `/signup?prompt=${q}`);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (prompt.trim().length >= 3) go(prompt);
      }}
      className="mx-auto mt-10 w-full max-w-2xl"
    >
      <div className="rounded-2xl border border-line bg-elev p-2 shadow-card transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
        <label htmlFor="hero-prompt" className="sr-only">
          Describe what you want to build
        </label>
        <textarea
          id="hero-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (prompt.trim().length >= 3) go(prompt);
            }
          }}
          rows={3}
          placeholder="Describe the job to be done: “When a dispute email arrives, find the transaction and draft a resolution for my team…”"
          className="w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-ink-3"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <span className="annotation hidden sm:inline">Enter to plan · Shift+Enter for a new line</span>
          <Button type="submit" disabled={prompt.trim().length < 3}>
            Plan it <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPrompt(s)}
            className="rounded-full border border-line bg-elev/70 px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-accent hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </form>
  );
}

export function LensDemo() {
  const [lens, setLens] = useState<"guided" | "pro">("guided");
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mx-auto mb-6 flex w-fit rounded-full border border-line bg-elev p-1" role="tablist" aria-label="Lens">
        {(["guided", "pro"] as const).map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={lens === l}
            onClick={() => setLens(l)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition",
              lens === l ? "bg-ink text-bg" : "text-ink-2 hover:text-ink",
            )}
          >
            {l === "guided" ? "Guided lens" : "Pro lens"}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-elev shadow-card">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[12px] text-ink-3">DisputeDesk · same project, {lens === "guided" ? "Guided" : "Pro"} lens</span>
        </div>
        {lens === "guided" ? (
          <div className="grid gap-0 md:grid-cols-[1fr_1.3fr]">
            <div className="space-y-3 border-b border-line p-5 md:border-b-0 md:border-r">
              <p className="annotation">Chat</p>
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-[13px] text-accent-ink">
                Escalate anything over $5,000 to Priya
              </div>
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-sunken px-3 py-2 text-[13px]">
                Done. The <b>Resolution Agent</b> now routes disputes above $5,000 to Priya for approval. Nothing else changed.
              </div>
              <div className="rounded-lg border border-line p-3 text-[12.5px] text-ink-2">
                <p className="mb-1 font-medium text-ink">What changed</p>
                <p>• New rule on Resolution Agent</p>
                <p>• “Needs approval” badge on the Queue page</p>
              </div>
            </div>
            <div className="p-5">
              <p className="annotation mb-3">Agents</p>
              <div className="flex flex-wrap items-center gap-3 text-[13px]">
                {["New email", "Intake Agent", "Resolution Agent", "Priya (> $5k)"].map((n, i) => (
                  <div key={n} className="flex items-center gap-3">
                    <span className={cn("rounded-lg border px-3 py-2", i === 3 ? "border-warn/40 bg-warn-soft text-warn" : i === 0 ? "border-line bg-sunken" : "border-accent/40 bg-accent-soft text-accent")}>{n}</span>
                    {i < 3 && <ArrowRight className="h-4 w-4 text-ink-3" />}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[13px] text-ink-2">Plain-English instructions, a visual flow, and a Deploy button with a checklist.</p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-[200px_1fr]">
            <div className="border-b border-line p-4 font-mono text-[12px] text-ink-2 md:border-b-0 md:border-r">
              <p className="annotation mb-2">Files</p>
              <p>index.html</p>
              <p className="text-accent">agents/resolution_agent.py</p>
              <p>agents/intake_agent.py</p>
              <p>architect.json</p>
              <p>README.md</p>
            </div>
            <div className="bg-[#0e1015] p-4 font-mono text-[12.5px] leading-relaxed text-[#b1b6c1]">
              <p className="text-[#7d8391]"># agents/resolution_agent.py · LangGraph</p>
              <p className="text-[#ff7b6e]">- prompt=RESOLUTION_PROMPT,</p>
              <p className="text-[#4fc58c]">+ prompt=RESOLUTION_PROMPT + ESCALATION_RULE,</p>
              <p className="text-[#4fc58c]">+ interrupt_before=[&quot;approve_over_5k&quot;],</p>
              <p className="mt-3 text-[#7d8391]">$ architect push --branch escalation-rule</p>
              <p>✓ Opened PR #14 on acme/dispute-desk</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ComparisonTable() {
  const rows: Array<[string, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]> = [
    ["Plan you approve before code is written", 1, 1, 2],
    ["Agents as first-class objects", 0, 1, 2],
    ["Choose your agent framework", 0, 1, 2],
    ["Usable with zero coding", 2, 0, 2],
    ["File tree, editor and per-turn diffs", 1, 2, 2],
    ["Import an existing repo", 1, 2, 2],
    ["GitHub push + one-click deploy", 2, 1, 2],
    ["API, CLI and MCP access", 0, 2, 2],
  ];
  const mark = (v: 0 | 1 | 2) =>
    v === 2 ? (
      <Check className="mx-auto h-4 w-4 text-ok" aria-label="Yes" />
    ) : v === 1 ? (
      <span className="text-[12px] text-warn" aria-label="Partly">Partly</span>
    ) : (
      <span className="text-ink-3" aria-label="No">—</span>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-elev">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="px-4 py-3 font-medium text-ink-2">Capability</th>
            <th className="px-4 py-3 text-center font-medium text-ink-2">App builders<br /><span className="text-[11px] font-normal text-ink-3">Lovable · Replit · v0</span></th>
            <th className="px-4 py-3 text-center font-medium text-ink-2">Coding agents<br /><span className="text-[11px] font-normal text-ink-3">Cursor · Codex · Claude Code</span></th>
            <th className="bg-accent-soft px-4 py-3 text-center font-semibold text-accent">Architect 2.0</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, c]) => (
            <tr key={label} className="border-b border-line last:border-0">
              <td className="px-4 py-3">{label}</td>
              <td className="px-4 py-3 text-center">{mark(a)}</td>
              <td className="px-4 py-3 text-center">{mark(b)}</td>
              <td className="bg-accent-soft/50 px-4 py-3 text-center">{mark(c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketingNav({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <Link href="/#how" className="hidden rounded-md px-3 py-1.5 text-ink-2 hover:text-ink sm:block">How it works</Link>
      <Link href="/pricing" className="hidden rounded-md px-3 py-1.5 text-ink-2 hover:text-ink sm:block">Pricing</Link>
      {signedIn ? (
        <Link href="/home" className="ml-2 inline-flex h-9 items-center gap-1 rounded-lg bg-ink px-4 font-medium text-bg hover:opacity-90">
          Open Architect <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <>
          <Link href="/login" className="rounded-md px-3 py-1.5 text-ink-2 hover:text-ink">Sign in</Link>
          <Link href="/signup" className="ml-1 inline-flex h-9 items-center rounded-lg bg-ink px-4 font-medium text-bg hover:opacity-90">
            Start free
          </Link>
        </>
      )}
    </div>
  );
}

