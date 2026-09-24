import { z } from "zod";

export const FIELD_TYPES = ["string", "number", "boolean", "date", "email", "currency", "status"] as const;

export const BlueprintSchema = z.object({
  appName: z.string().describe("Short product name, 1-4 words"),
  tagline: z.string().describe("One-line value proposition"),
  summary: z.string().describe("2-3 sentence plain-English description a non-technical user can approve"),
  audience: z.string().describe("Who uses the app"),
  pages: z
    .array(
      z.object({
        name: z.string(),
        purpose: z.string(),
        components: z.array(z.string()),
      }),
    )
    .describe("3-5 pages"),
  dataModel: z
    .array(
      z.object({
        entity: z.string(),
        fields: z.array(z.object({ name: z.string(), type: z.enum(FIELD_TYPES) })),
      }),
    )
    .describe("1-3 core entities, 4-7 fields each"),
  agents: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().describe("What the agent is responsible for, one sentence"),
        instructions: z.string().describe("System instructions for the agent, 2-4 sentences"),
        tools: z.array(z.string()).describe("Tool names like search_knowledge_base, send_email"),
        trigger: z.string().describe("What starts the agent, e.g. 'New ticket created'"),
      }),
    )
    .describe("1-3 agents"),
  integrations: z.array(z.string()),
  theme: z.object({
    accent: z.string().describe("Hex color like #2346d8"),
    mode: z.enum(["light", "dark"]),
  }),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;
export type BlueprintAgent = Blueprint["agents"][number];

export const FilesSchema = z.record(z.string(), z.string());
export type Files = z.infer<typeof FilesSchema>;

export type BuildStep = { id: string; label: string };

export type BuildEvent =
  | { type: "engine"; engine: "claude" | "demo"; reason?: string }
  | { type: "status"; text: string }
  | { type: "blueprint"; blueprint: Blueprint }
  | { type: "step"; id: string; label: string; state: "active" | "done" }
  | { type: "file_start"; path: string }
  | { type: "file_delta"; path: string; chunk: string }
  | { type: "file"; path: string; content: string }
  | { type: "text"; text: string }
  | { type: "done"; summary: string; checkpointId?: string; version?: number }
  | { type: "error"; message: string };

export const CreateProjectSchema = z.object({
  prompt: z.string().trim().min(3, "Describe what you want to build").max(4000),
  framework: z.string().max(40).optional(),
  templateId: z.string().max(60).optional(),
});

export const ChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  selection: z
    .object({ selector: z.string().max(300), text: z.string().max(300) })
    .optional(),
});

export const SignupSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200)
    .regex(/[A-Za-z]/, "Include a letter")
    .regex(/[0-9]/, "Include a number"),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});
