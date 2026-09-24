export type Framework = {
  id: string;
  name: string;
  language: "python" | "typescript";
  blurb: string;
  bestFor: string;
  file: (agentSlug: string) => string;
};

export const FRAMEWORKS: Framework[] = [
  {
    id: "lyzr",
    name: "Lyzr ADK",
    language: "python",
    blurb: "Managed agents with built-in memory, RAG and responsible-AI guardrails.",
    bestFor: "Enterprise agents that need guardrails out of the box",
    file: (s) => `agents/${s}.py`,
  },
  {
    id: "langgraph",
    name: "LangGraph",
    language: "python",
    blurb: "Stateful graphs of LLM calls with explicit control flow.",
    bestFor: "Multi-step workflows with branching and retries",
    file: (s) => `agents/${s}.py`,
  },
  {
    id: "crewai",
    name: "CrewAI",
    language: "python",
    blurb: "Role-playing crews of agents that delegate tasks.",
    bestFor: "Teams of specialists collaborating on a goal",
    file: (s) => `agents/${s}.py`,
  },
  {
    id: "openai-agents",
    name: "OpenAI Agents SDK",
    language: "python",
    blurb: "Lightweight agents with handoffs and guardrails.",
    bestFor: "Simple tool-using agents with handoffs",
    file: (s) => `agents/${s}.py`,
  },
  {
    id: "claude-agent-sdk",
    name: "Claude Agent SDK",
    language: "typescript",
    blurb: "The Claude Code harness as a library: tools, subagents, MCP.",
    bestFor: "Coding and file-system agents",
    file: (s) => `agents/${s}.ts`,
  },
  {
    id: "autogen",
    name: "AutoGen",
    language: "python",
    blurb: "Conversational multi-agent programming from Microsoft.",
    bestFor: "Agents that reason by talking to each other",
    file: (s) => `agents/${s}.py`,
  },
];

export const DEFAULT_FRAMEWORK = "lyzr";

export function getFramework(id: string | null | undefined): Framework {
  return FRAMEWORKS.find((f) => f.id === id) ?? FRAMEWORKS[0];
}
