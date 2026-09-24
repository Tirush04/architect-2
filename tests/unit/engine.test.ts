import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildEvent } from "@/lib/schemas";

vi.mock("@/lib/engine/claude", () => ({
  planWithClaude: vi.fn(),
  buildWithClaude: vi.fn(),
  editWithClaude: vi.fn(),
}));

import * as claude from "@/lib/engine/claude";
import { channel, regenerateSupportFiles, runBuild, runEdit, runPlan, selectEngine } from "@/lib/engine";
import { pickScenario, genericBlueprint } from "@/lib/engine/scenarios";

async function collect<T, R>(gen: AsyncGenerator<T, R>): Promise<{ events: T[]; result: R }> {
  const events: T[] = [];
  let r = await gen.next();
  while (!r.done) {
    events.push(r.value);
    r = await gen.next();
  }
  return { events, result: r.value };
}

const demo = { claude: false, reason: "test" };
const live = { claude: true };

beforeEach(() => {
  process.env.ARCHITECT_DEMO_SPEED = "0";
});
afterEach(() => {
  vi.resetAllMocks();
  delete process.env.ARCHITECT_FAKE_LLM;
  delete process.env.ANTHROPIC_API_KEY;
});

describe("selectEngine", () => {
  it("uses demo without a key", () => {
    expect(selectEngine().claude).toBe(false);
  });
  it("uses Claude with a key", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect(selectEngine()).toEqual({ claude: true });
  });
  it("forces demo when FAKE_LLM=1 or over limit", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect(selectEngine({ overLimit: true }).claude).toBe(false);
    process.env.ARCHITECT_FAKE_LLM = "1";
    expect(selectEngine().claude).toBe(false);
  });
});

describe("runPlan", () => {
  it("demo: emits steps and a scenario blueprint", async () => {
    const { events, result } = await collect(runPlan("credit card dispute triage", demo));
    expect(events[0]).toMatchObject({ type: "engine", engine: "demo" });
    expect(events.filter((e) => e.type === "step")).toHaveLength(10);
    expect(result.appName).toBe("DisputeDesk");
    expect(events.at(-1)).toEqual({ type: "blueprint", blueprint: result });
  });

  it("claude: returns the model's blueprint", async () => {
    const bp = genericBlueprint("from claude");
    vi.mocked(claude.planWithClaude).mockResolvedValue(bp);
    const { result } = await collect(runPlan("anything", live));
    expect(result).toBe(bp);
  });

  it("claude failure: falls back to demo with a reason", async () => {
    vi.mocked(claude.planWithClaude).mockRejectedValue(new Error("overloaded"));
    const { events, result } = await collect(runPlan("support helpdesk", live));
    const switched = events.find((e) => e.type === "engine" && e.engine === "demo") as Extract<BuildEvent, { type: "engine" }>;
    expect(switched.reason).toContain("overloaded");
    expect(result.appName).toBe("Helpline");
  });
});

describe("runPlan revisions", () => {
  it("demo: applies the revision to the current blueprint", async () => {
    const current = pickScenario("dispute");
    const { events, result } = await collect(runPlan("ignored", demo, undefined, { current, revision: "add a page called Chargebacks" }));
    expect(result.pages.map((p) => p.name)).toContain("Chargebacks");
    expect(result.appName).toBe("DisputeDesk");
    expect(events.find((e) => e.type === "status")).toMatchObject({ text: expect.stringContaining("Chargebacks") });
  });

  it("demo: unknown revision keeps the blueprint and explains", async () => {
    const current = pickScenario("dispute");
    const { events, result } = await collect(runPlan("x", demo, undefined, { current, revision: "make it more enterprise" }));
    expect(result).toEqual(current);
    expect(events.find((e) => e.type === "status")).toMatchObject({ text: expect.stringMatching(/kept the Blueprint/) });
  });

  it("claude: sends the current blueprint with the revision", async () => {
    const current = pickScenario("support");
    vi.mocked(claude.planWithClaude).mockResolvedValue({ ...current, appName: "Helpline Pro" });
    const { result } = await collect(runPlan("x", live, undefined, { current, revision: "rename to Helpline Pro" }));
    expect(result.appName).toBe("Helpline Pro");
    const sent = vi.mocked(claude.planWithClaude).mock.calls[0][0];
    expect(sent).toContain('"appName": "Helpline"');
    expect(sent).toContain("rename to Helpline Pro");
  });
});

describe("runBuild", () => {
  it("demo: produces index.html, agent files, manifest and README", async () => {
    const bp = pickScenario("recruiting pipeline");
    const { events, result } = await collect(runBuild(bp, "crewai", demo));
    expect(Object.keys(result.files).sort()).toEqual(
      ["README.md", "agents/scheduler_agent.py", "agents/screening_agent.py", "architect.json", "index.html"].sort(),
    );
    expect(result.engine).toBe("demo");
    expect(events.some((e) => e.type === "file_delta")).toBe(true);
    const steps = events.filter((e) => e.type === "step" && e.state === "done").map((e) => (e as { id: string }).id);
    expect(steps).toEqual(["scaffold", "ui", "agents", "checks"]);
  });

  it("claude: streams the model's html", async () => {
    const html = `<!doctype html><html><body>${"x".repeat(300)}</body></html>`;
    vi.mocked(claude.buildWithClaude).mockImplementation(async (_bp, onText) => {
      onText("<<<FILE index.html>>>\n");
      onText(html.slice(0, 50));
      onText(html.slice(50) + "\n<<<END FILE>>>\nMade it.");
    });
    const { result } = await collect(runBuild(genericBlueprint("x"), "lyzr", live));
    expect(result.files["index.html"]).toBe(html);
    expect(result.summary).toBe("Made it.");
    expect(result.engine).toBe("claude");
  });

  it("claude junk output: falls back to rendering the blueprint", async () => {
    vi.mocked(claude.buildWithClaude).mockImplementation(async (_bp, onText) => onText("sorry, no file"));
    const { events, result } = await collect(runBuild(genericBlueprint("x"), "lyzr", live));
    expect(result.engine).toBe("demo");
    expect(result.files["index.html"]).toContain("<!doctype html>");
    expect(events.some((e) => e.type === "engine" && e.engine === "demo")).toBe(true);
  });

  it("claude throws mid-stream: falls back", async () => {
    vi.mocked(claude.buildWithClaude).mockImplementation(async (_bp, onText) => {
      onText("<<<FILE index.html>>>\n<html>");
      throw new Error("socket hang up");
    });
    const { result } = await collect(runBuild(genericBlueprint("x"), "lyzr", live));
    expect(result.engine).toBe("demo");
  });
});

describe("runEdit (demo)", () => {
  it("applies a recognised change and regenerates", async () => {
    const bp = pickScenario("sales crm");
    const built = await collect(runBuild(bp, "lyzr", demo));
    const { result } = await collect(
      runEdit({ blueprint: bp, files: built.result.files, frameworkId: "lyzr", instruction: "make it dark and add a page called Reports", mode: demo }),
    );
    expect(result.changed).toBe(true);
    expect(result.blueprint.theme.mode).toBe("dark");
    expect(result.blueprint.pages.map((p) => p.name)).toContain("Reports");
    expect(result.files["index.html"]).toContain('class="dark"');
  });

  it("explains when nothing matched", async () => {
    const bp = pickScenario("x");
    const { result } = await collect(
      runEdit({ blueprint: bp, files: {}, frameworkId: "lyzr", instruction: "optimise the database indexes", mode: demo }),
    );
    expect(result.changed).toBe(false);
    expect(result.summary).toMatch(/demo engine/i);
  });
});

describe("regenerateSupportFiles", () => {
  it("replaces stale agent files but keeps others", () => {
    const bp = pickScenario("support");
    const files = { "index.html": "<html/>", "agents/old_agent.py": "old", "src/keep.ts": "k" };
    const out = regenerateSupportFiles(files, bp, "lyzr");
    expect(out["agents/old_agent.py"]).toBeUndefined();
    expect(out["agents/answer_agent.py"]).toContain("Answer Agent");
    expect(out["src/keep.ts"]).toBe("k");
    expect(out["index.html"]).toBe("<html/>");
  });
});

describe("channel", () => {
  it("delivers pushed values then ends on close", async () => {
    const ch = channel<number>();
    setTimeout(() => {
      ch.push(1);
      ch.push(2);
      ch.close();
    }, 0);
    const got: number[] = [];
    for await (const v of ch.drain()) got.push(v);
    expect(got).toEqual([1, 2]);
  });
});
