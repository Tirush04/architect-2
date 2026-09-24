import type { Blueprint, Files } from "@/lib/schemas";
import type { WorkspaceData } from "@/lib/workspace-data";

export type RunKind = "plan" | "build" | "edit" | "deploy";

export type LiveStep = { id: string; label: string; state: "active" | "done" };

export type LiveRun = {
  kind: RunKind;
  steps: LiveStep[];
  current: { path: string; content: string } | null;
  written: string[];
  logs: string[];
  engineNote: string | null;
  error: string | null;
};

export type Tab = "preview" | "blueprint" | "agents" | "code" | "data" | "deploy" | "settings";

export type Selection = { selector: string; text: string };

export type WorkspaceApi = {
  data: WorkspaceData;
  live: LiveRun | null;
  lastDeploy: LiveRun | null;
  lens: "GUIDED" | "PRO";
  busy: boolean;
  setTab: (t: Tab) => void;
  switchLens: (l: "GUIDED" | "PRO") => void;
  refresh: () => Promise<void>;
  startPlan: (prompt?: string) => Promise<void>;
  startBuild: () => Promise<void>;
  sendChat: (message: string, selection?: Selection) => Promise<void>;
  startDeploy: (version?: number) => Promise<void>;
  stop: () => void;
  saveBlueprint: (bp: Blueprint) => Promise<boolean>;
  patchProject: (patch: { name?: string; framework?: string; lens?: "GUIDED" | "PRO" }) => Promise<void>;
  restore: (version: number) => Promise<void>;
  saveFile: (path: string, content: string, remove?: boolean) => Promise<boolean>;
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  files: Files;
};
