import type { Blueprint, BuildEvent, Files } from "@/lib/schemas";
import { generateAgentFiles, generateReadme } from "@/lib/codegen/agents";
import { getFramework } from "@/lib/frameworks";
import { FileStreamParser } from "./file-stream-parser";
import { renderAppHtml } from "./render-app";
import { pickScenario } from "./scenarios";
import { applyDemoEdit } from "./demo-edits";
import { buildWithClaude, editWithClaude, planWithClaude } from "./claude";

export type EngineMode = { claude: boolean; reason?: string };

export function selectEngine(opts: { overLimit?: boolean } = {}): EngineMode {
  if (process.env.ARCHITECT_FAKE_LLM === "1") return { claude: false, reason: "Demo engine (forced)" };
  if (!process.env.ANTHROPIC_API_KEY) return { claude: false, reason: "No AI key configured, so this runs on the demo engine" };
  if (opts.overLimit) return { claude: false, reason: "Daily AI limit reached, so this runs on the demo engine" };
  return { claude: true };
}

function speed(): number {
  const v = Number(process.env.ARCHITECT_DEMO_SPEED ?? "1");
  return Number.isFinite(v) && v >= 0 ? v : 1;
}
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * speed()));

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 160);
  return "unknown error";
}

/** Minimal async queue so callback-based streams can be consumed by a generator. */
export function channel<T>() {
  const queue: T[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  return {
    push(v: T) {
      queue.push(v);
      wake?.();
      wake = null;
    },
    close() {
      closed = true;
      wake?.();
      wake = null;
    },
    async *drain(): AsyncGenerator<T> {
      for (;;) {
        if (queue.length) {
          yield queue.shift() as T;
          continue;
        }
        if (closed) return;
        await new Promise<void>((r) => (wake = r));
      }
    },
  };
}

export const PLAN_STEPS = [
  { id: "read", label: "Reading your idea" },
  { id: "users", label: "Mapping users and their jobs" },
  { id: "pages", label: "Designing pages and flows" },
  { id: "data", label: "Modelling the data" },
  { id: "agents", label: "Planning the agents" },
];

export function revisionPrompt(current: Blueprint, revision: string): string {
  return `Here is the current Blueprint:\n${JSON.stringify(current, null, 2)}\n\nRevise it to address this request, keeping everything else unchanged: ${revision}`;
}

export async function* runPlan(
  prompt: string,
  mode: EngineMode,
  signal?: AbortSignal,
  opts: { current?: Blueprint | null; revision?: string } = {},
): AsyncGenerator<BuildEvent, Blueprint> {
  yield { type: "engine", engine: mode.claude ? "claude" : "demo", reason: mode.reason };
  let blueprint: Blueprint | null = null;
  const revising = !!(opts.current && opts.revision);

  if (revising && !mode.claude) {
    yield { type: "step", id: "revise", label: "Revising the Blueprint", state: "active" };
    await sleep(300);
    const { blueprint: next, changes } = applyDemoEdit(opts.current!, opts.revision!);
    yield { type: "step", id: "revise", label: "Revising the Blueprint", state: "done" };
    yield { type: "status", text: changes.length ? `${changes.join(". ")}.` : `I kept the Blueprint as is. ${DEMO_HELP}` };
    yield { type: "blueprint", blueprint: next };
    return next;
  }

  if (mode.claude) {
    const pending = planWithClaude(revising ? revisionPrompt(opts.current!, opts.revision!) : prompt, signal).then(
      (bp) => ({ ok: true as const, bp }),
      (err: unknown) => ({ ok: false as const, err }),
    );
    let settled: Awaited<typeof pending> | null = null;
    for (const step of PLAN_STEPS) {
      yield { type: "step", id: step.id, label: step.label, state: "active" };
      if (!settled) settled = await Promise.race([pending, sleep(1100).then(() => null)]);
      yield { type: "step", id: step.id, label: step.label, state: "done" };
    }
    settled ??= await pending;
    if (settled.ok) blueprint = settled.bp;
    else yield { type: "engine", engine: "demo", reason: `AI engine unavailable (${describeError(settled.err)}). Switched to the demo engine.` };
  } else {
    for (const step of PLAN_STEPS) {
      yield { type: "step", id: step.id, label: step.label, state: "active" };
      await sleep(350);
      yield { type: "step", id: step.id, label: step.label, state: "done" };
    }
  }

  blueprint ??= revising ? applyDemoEdit(opts.current!, opts.revision!).blueprint : pickScenario(prompt);
  if (revising) yield { type: "status", text: "Revised the Blueprint. Review it, then approve to build." };
  yield { type: "blueprint", blueprint };
  return blueprint;
}

function buildSteps(frameworkName: string) {
  return {
    scaffold: { id: "scaffold", label: "Scaffolding the project" },
    ui: { id: "ui", label: "Building the interface" },
    agents: { id: "agents", label: `Generating agents in ${frameworkName}` },
    checks: { id: "checks", label: "Running final checks" },
  };
}

function isUsableHtml(html: string | undefined): html is string {
  return !!html && html.length > 200 && /<html|<!doctype/i.test(html) && /<\/html>/i.test(html);
}

async function* streamClaudeHtml(
  run: (onText: (t: string) => void) => Promise<void>,
): AsyncGenerator<BuildEvent, { html?: string; summary: string; error?: unknown }> {
  const ch = channel<BuildEvent>();
  const parser = new FileStreamParser();
  let html: string | undefined;
  let summary = "";
  let error: unknown;
  const handle = (events: ReturnType<FileStreamParser["push"]>) => {
    for (const ev of events) {
      if (ev.type === "start") ch.push({ type: "file_start", path: ev.path });
      else if (ev.type === "delta") ch.push({ type: "file_delta", path: ev.path, chunk: ev.chunk });
      else if (ev.type === "end") {
        if (ev.path === "index.html") html = ev.content;
        ch.push({ type: "file", path: ev.path, content: ev.content });
      } else summary += ev.text;
    }
  };
  run((t) => handle(parser.push(t)))
    .catch((err: unknown) => (error = err))
    .finally(() => {
      handle(parser.end());
      ch.close();
    });
  for await (const ev of ch.drain()) yield ev;
  return { html, summary: summary.trim(), error };
}

async function* streamDemoFile(path: string, content: string): AsyncGenerator<BuildEvent> {
  yield { type: "file_start", path };
  const size = 900;
  for (let i = 0; i < content.length; i += size) {
    yield { type: "file_delta", path, chunk: content.slice(i, i + size) };
    await sleep(45);
  }
  yield { type: "file", path, content };
}

function supportFiles(blueprint: Blueprint, frameworkId: string): Files {
  return { ...generateAgentFiles(blueprint, frameworkId), "README.md": generateReadme(blueprint, frameworkId) };
}

/** Replace generated agent/readme files, keeping everything else (e.g. index.html, imported code). */
export function regenerateSupportFiles(files: Files, blueprint: Blueprint, frameworkId: string): Files {
  const kept = Object.fromEntries(
    Object.entries(files).filter(([p]) => !p.startsWith("agents/") && p !== "architect.json" && p !== "README.md"),
  );
  return { ...kept, ...supportFiles(blueprint, frameworkId) };
}

export async function* runBuild(
  blueprint: Blueprint,
  frameworkId: string,
  mode: EngineMode,
  signal?: AbortSignal,
): AsyncGenerator<BuildEvent, { files: Files; summary: string; engine: "claude" | "demo" }> {
  const fw = getFramework(frameworkId);
  const s = buildSteps(fw.name);
  const files: Files = {};
  let engine: "claude" | "demo" = mode.claude ? "claude" : "demo";
  let summary = "";

  yield { type: "step", ...s.scaffold, state: "active" };
  await sleep(300);
  yield { type: "step", ...s.scaffold, state: "done" };

  yield { type: "step", ...s.ui, state: "active" };
  if (mode.claude) {
    const gen = streamClaudeHtml((onText) => buildWithClaude(blueprint, onText, signal));
    let r = await gen.next();
    while (!r.done) {
      yield r.value;
      r = await gen.next();
    }
    if (isUsableHtml(r.value.html)) {
      files["index.html"] = r.value.html;
      summary = r.value.summary;
    } else {
      engine = "demo";
      const why = r.value.error ? describeError(r.value.error) : "output was incomplete";
      yield { type: "engine", engine: "demo", reason: `AI build failed (${why}). Rendered the Blueprint with the demo engine instead.` };
    }
  }
  if (!files["index.html"]) {
    const html = renderAppHtml(blueprint);
    yield* streamDemoFile("index.html", html);
    files["index.html"] = html;
  }
  yield { type: "step", ...s.ui, state: "done" };

  yield { type: "step", ...s.agents, state: "active" };
  for (const [path, content] of Object.entries(supportFiles(blueprint, fw.id))) {
    yield { type: "file_start", path };
    await sleep(120);
    yield { type: "file", path, content };
    files[path] = content;
  }
  yield { type: "step", ...s.agents, state: "done" };

  yield { type: "step", ...s.checks, state: "active" };
  await sleep(250);
  yield { type: "step", ...s.checks, state: "done" };

  summary ||= `Built ${blueprint.appName}: ${blueprint.pages.length} pages, ${blueprint.agents.length} agent${blueprint.agents.length === 1 ? "" : "s"} in ${fw.name}, and sample ${blueprint.dataModel[0]?.entity.toLowerCase() ?? "data"} records.`;
  return { files, summary, engine };
}

export const DEMO_HELP =
  "The demo engine understands changes like “make it dark”, “use a green accent”, “add a page called Reports”, “rename it to Atlas” or “add an agent that sends weekly summaries”. Connect an AI key for any other change.";

export async function* runEdit(args: {
  blueprint: Blueprint;
  files: Files;
  frameworkId: string;
  instruction: string;
  selection?: { selector: string; text: string };
  mode: EngineMode;
  signal?: AbortSignal;
}): AsyncGenerator<BuildEvent, { files: Files; blueprint: Blueprint; summary: string; changed: boolean; engine: "claude" | "demo" }> {
  const { blueprint, files, frameworkId, instruction, selection, mode, signal } = args;
  const step = { id: "edit", label: "Applying your change" };
  yield { type: "engine", engine: mode.claude ? "claude" : "demo", reason: mode.reason };
  yield { type: "step", ...step, state: "active" };

  if (mode.claude && files["index.html"]) {
    const gen = streamClaudeHtml((onText) =>
      editWithClaude(files["index.html"], blueprint, instruction, selection, onText, signal),
    );
    let r = await gen.next();
    while (!r.done) {
      yield r.value;
      r = await gen.next();
    }
    if (isUsableHtml(r.value.html)) {
      yield { type: "step", ...step, state: "done" };
      return {
        files: { ...files, "index.html": r.value.html },
        blueprint,
        summary: r.value.summary || "Applied your change.",
        changed: true,
        engine: "claude",
      };
    }
    yield { type: "engine", engine: "demo", reason: "AI edit failed, so I tried the demo engine instead." };
  }

  const { blueprint: next, changes } = applyDemoEdit(blueprint, instruction);
  if (changes.length === 0) {
    await sleep(300);
    yield { type: "step", ...step, state: "done" };
    return { files, blueprint, summary: `I couldn't map that to a change yet. ${DEMO_HELP}`, changed: false, engine: "demo" };
  }
  const html = renderAppHtml(next);
  yield* streamDemoFile("index.html", html);
  const updated: Files = regenerateSupportFiles({ ...files, "index.html": html }, next, frameworkId);
  yield { type: "step", ...step, state: "done" };
  return { files: updated, blueprint: next, summary: changes.join(". ") + ".", changed: true, engine: "demo" };
}
