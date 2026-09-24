import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { BlueprintSchema, type Blueprint } from "@/lib/schemas";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function claudeModel(): string {
  return process.env.ARCHITECT_MODEL || "claude-opus-5";
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ maxRetries: 1, timeout: 5 * 60 * 1000 });
  return client;
}

export class EngineRefusal extends Error {}

const PLAN_SYSTEM = `You are Architect, a senior product architect. Turn the user's idea into a Blueprint for a web app whose repetitive work is done by AI agents.
- Use the user's own domain vocabulary. Be concrete and specific; no filler.
- 3-5 pages, 1-3 data entities with 4-7 fields each, 1-3 agents.
- Each agent gets a clear trigger, 2-4 tools named in snake_case, and instructions that include a human-in-the-loop rule for irreversible actions.
- The summary must be understandable by a non-technical business user.
- Pick an accent colour (hex) that suits the domain.`;

export async function planWithClaude(prompt: string, signal?: AbortSignal): Promise<Blueprint> {
  const response = await getClient().beta.messages.parse(
    {
      model: claudeModel(),
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(BlueprintSchema) },
      system: PLAN_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    },
    { signal },
  );
  if (response.stop_reason === "refusal") throw new EngineRefusal("The model declined this request.");
  if (!response.parsed_output) throw new Error("Blueprint could not be parsed");
  return BlueprintSchema.parse(response.parsed_output);
}

const BUILD_SYSTEM = `You are Architect's UI engineer. You write ONE self-contained file, index.html, that implements the Blueprint as a polished, working web app.
Rules:
- Plain HTML, CSS and vanilla JS in one file. You may load Tailwind with <script src="https://cdn.tailwindcss.com"></script>. No other external dependencies.
- Realistic sample data in the user's domain (never lorem ipsum). Working navigation between every page in the Blueprint.
- An "Agents" panel that shows each agent, its trigger and tools, and a small console where the user can message an agent and get a simulated, domain-specific reply.
- Use the Blueprint accent colour and light/dark mode. Responsive down to 375px. Accessible: labels, focus states, semantic landmarks.
- Add data-arch-id attributes to major sections so users can reference them.
Output format, exactly:
<<<FILE index.html>>>
...the complete file...
<<<END FILE>>>
Then ONE or TWO plain-English sentences summarising what you built or changed. Output nothing else.`;

export type StreamChunkHandler = (text: string) => void;

async function streamText(
  system: string,
  userContent: string,
  onText: StreamChunkHandler,
  signal?: AbortSignal,
): Promise<void> {
  const stream = getClient().beta.messages.stream(
    {
      model: claudeModel(),
      max_tokens: 64000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system,
      messages: [{ role: "user", content: userContent }],
    },
    { signal },
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      onText(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new EngineRefusal("The model declined this request.");
}

export function buildWithClaude(blueprint: Blueprint, onText: StreamChunkHandler, signal?: AbortSignal) {
  return streamText(
    BUILD_SYSTEM,
    `Build this Blueprint:\n\n${JSON.stringify(blueprint, null, 2)}`,
    onText,
    signal,
  );
}

export function editWithClaude(
  currentHtml: string,
  blueprint: Blueprint,
  instruction: string,
  selection: { selector: string; text: string } | undefined,
  onText: StreamChunkHandler,
  signal?: AbortSignal,
) {
  const sel = selection
    ? `\n\nThe user selected this element in the preview: selector \`${selection.selector}\`, text "${selection.text}". Apply the change to it.`
    : "";
  return streamText(
    BUILD_SYSTEM +
      "\nYou are editing an existing app: keep everything the user did not ask to change, and return the complete updated file.",
    `Blueprint (for context):\n${JSON.stringify(blueprint)}\n\nCurrent index.html:\n<<<FILE index.html>>>\n${currentHtml}\n<<<END FILE>>>\n\nChange requested: ${instruction}${sel}`,
    onText,
    signal,
  );
}

const AGENT_SYSTEM = (name: string, instructions: string, tools: string[]) =>
  `You are "${name}", an AI agent inside an app built with Architect.\n${instructions}\nYou have these tools available (simulated in this playground): ${tools.join(", ") || "none"}. When a tool would help, say which one you would call and with what input, then give your answer. Keep replies under 120 words.`;

export async function runAgentWithClaude(
  agent: { name: string; instructions: string; tools: string[] },
  input: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await getClient().beta.messages.create(
    {
      model: claudeModel(),
      max_tokens: 2000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: AGENT_SYSTEM(agent.name, agent.instructions, agent.tools),
      messages: [{ role: "user", content: input }],
    },
    { signal },
  );
  if (response.stop_reason === "refusal") throw new EngineRefusal("The model declined this request.");
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
