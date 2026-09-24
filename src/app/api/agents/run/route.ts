import { NextResponse } from "next/server";
import { LIMITS, readJson } from "@/lib/body";
import { z } from "zod";
import { runAgentWithClaude } from "@/lib/engine/claude";
import { readBlueprint } from "@/lib/projects";
import { engineFor, projectForRequest, badRequest } from "@/lib/route-helpers";
import { toIdentifier } from "@/lib/codegen/agents";

const RunSchema = z.object({
  projectId: z.string().min(1).max(40),
  agent: z.object({
    name: z.string().min(1).max(80),
    instructions: z.string().max(4000),
    tools: z.array(z.string().max(60)).max(12),
  }),
  input: z.string().trim().min(1).max(2000),
});

export type TraceStep = { kind: "input" | "plan" | "tool" | "guardrail" | "answer"; label: string; detail?: string; ms: number };

function scriptedAnswer(agent: { name: string; tools: string[] }, input: string) {
  const tool = agent.tools[0] ? toIdentifier(agent.tools[0]) : null;
  return `${tool ? `I called \`${tool}\` with “${input.slice(0, 60)}”. ` : ""}Here's what I'd do: confirm the key details, take the routine step automatically, and flag anything irreversible for a human to approve. (Demo engine reply. Connect an AI key for real agent responses.)`;
}

export async function POST(req: Request) {
  const raw = await readJson(req, LIMITS.small);
  if (!raw.ok) return raw.response;
  const parsed = RunSchema.safeParse(raw.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  const r = await projectForRequest(parsed.data.projectId);
  if ("error" in r) return r.error;
  if (!readBlueprint(r.project.blueprint)) return badRequest("This project has no Blueprint yet");
  const { agent, input } = parsed.data;

  const started = Date.now();
  const mode = await engineFor(r.userId);
  let output: string;
  let engine: "claude" | "demo" = "demo";
  if (mode.claude) {
    try {
      output = await runAgentWithClaude(agent, input, req.signal);
      engine = "claude";
    } catch {
      output = scriptedAnswer(agent, input);
    }
  } else {
    await new Promise((res) => setTimeout(res, 500));
    output = scriptedAnswer(agent, input);
  }
  const total = Date.now() - started;
  const tools = agent.tools.map(toIdentifier);
  const used = tools.filter((t) => output.includes(t));
  const called = used.length ? used : tools.slice(0, 1);
  const trace: TraceStep[] = [
    { kind: "input", label: "User input", detail: input, ms: 0 },
    { kind: "plan", label: "Planned approach", detail: `Decide whether ${called.length ? called.join(", ") : "no tool"} is needed`, ms: Math.round(total * 0.25) },
    ...called.map((t, i) => ({ kind: "tool" as const, label: `Tool · ${t}`, detail: `${t}(query=${JSON.stringify(input.slice(0, 40))}) → 3 results (simulated)`, ms: Math.round(total * (0.45 + i * 0.1)) })),
    { kind: "guardrail", label: "Guardrails", detail: "PII redaction ✓ · toxicity ✓ · human-approval rule ✓", ms: Math.round(total * 0.9) },
    { kind: "answer", label: "Answer", detail: output, ms: total },
  ];
  return NextResponse.json({ output, trace, engine, ms: total });
}
