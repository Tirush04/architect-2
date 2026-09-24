import { describe, expect, it } from "vitest";
import { agentSlug, generateAgentCode, generateAgentFiles, generateReadme, toIdentifier } from "@/lib/codegen/agents";
import { FRAMEWORKS, getFramework } from "@/lib/frameworks";
import { pickScenario } from "@/lib/engine/scenarios";

const bp = pickScenario("dispute");
const agent = bp.agents[0];

describe("identifiers", () => {
  it.each([
    ["Intake Agent", "intake_agent"],
    ["lookup-transaction", "lookup_transaction"],
    ["3D render", "t_3d_render"],
    ["!!!", "tool"],
  ])("%s -> %s", (input, out) => {
    expect(toIdentifier(input)).toBe(out);
  });
  it("slugs agents", () => expect(agentSlug(agent)).toBe("intake_agent"));
});

describe("generateAgentCode", () => {
  it.each(FRAMEWORKS.map((f) => f.id))("%s includes name, instructions and tools", (id) => {
    const code = generateAgentCode(agent, id);
    expect(code).toContain(agent.name);
    expect(code).toContain(JSON.stringify(agent.instructions));
    for (const t of agent.tools) expect(code).toContain(toIdentifier(t));
  });

  it("escapes quotes in instructions safely", () => {
    const tricky = { ...agent, instructions: 'Say "hi" \\ then """ end' };
    const code = generateAgentCode(tricky, "langgraph");
    expect(code).toContain(JSON.stringify(tricky.instructions));
  });

  it("uses framework-specific imports", () => {
    expect(generateAgentCode(agent, "langgraph")).toContain("from langgraph.prebuilt import create_react_agent");
    expect(generateAgentCode(agent, "crewai")).toContain("from crewai import Agent");
    expect(generateAgentCode(agent, "claude-agent-sdk")).toContain('from "@anthropic-ai/claude-agent-sdk"');
    expect(generateAgentCode(agent, "unknown")).toContain("from lyzr import Studio");
  });
});

describe("files", () => {
  it("produces one file per agent plus manifest", () => {
    const files = generateAgentFiles(bp, "claude-agent-sdk");
    expect(Object.keys(files).sort()).toEqual(["agents/intake_agent.ts", "agents/resolution_agent.ts", "architect.json"]);
    const manifest = JSON.parse(files["architect.json"]);
    expect(manifest.framework).toBe("claude-agent-sdk");
    expect(manifest.agents).toHaveLength(2);
  });

  it("README describes pages, agents and run command", () => {
    const md = generateReadme(bp, "lyzr");
    expect(md).toContain("# DisputeDesk");
    expect(md).toContain("**Queue**");
    expect(md).toContain("python agents/intake_agent.py");
  });

  it("getFramework falls back to Lyzr", () => {
    expect(getFramework("nope").id).toBe("lyzr");
    expect(getFramework(undefined).id).toBe("lyzr");
  });
});
