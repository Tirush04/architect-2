"use client";

import "@xyflow/react/dist/style.css";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { Bot, CircleUserRound, Code2, FlaskConical, Play, Plus, Settings2, ShieldCheck, Trash2, Wrench, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Input, Label, Spinner, Textarea } from "@/components/ui";
import { useTheme } from "@/components/theme";
import { FRAMEWORKS, getFramework } from "@/lib/frameworks";
import { generateAgentCode, toIdentifier } from "@/lib/codegen/agents";
import type { Blueprint, BlueprintAgent } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { WorkspaceApi } from "./types";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false, loading: () => <div className="p-4"><Spinner /></div> });

type NodeData = { label: string; sub?: string; selected?: boolean };

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-elev px-3 py-2 shadow-sm", className)}>{children}</div>;
}

function TriggerNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <Shell className="w-48 border-warn/40">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-warn">
        <Zap className="h-3 w-3" /> Trigger
      </p>
      <p className="mt-0.5 text-[12.5px] leading-snug">{data.label}</p>
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
}

function AgentNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <Shell className={cn("w-56 border-accent/50", data.selected && "ring-4 ring-accent/25")}>
      <Handle type="target" position={Position.Left} />
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-accent">
        <Bot className="h-3 w-3" /> Agent
      </p>
      <p className="mt-0.5 text-[13px] font-semibold">{data.label}</p>
      {data.sub && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-3">{data.sub}</p>}
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
}

function ToolNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <Shell className="w-44 border-line">
      <Handle type="target" position={Position.Left} />
      <p className="flex items-center gap-1.5 font-mono text-[11.5px] text-ink-2">
        <Wrench className="h-3 w-3 text-ink-3" /> {data.label}
      </p>
    </Shell>
  );
}

function HumanNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <Shell className="w-44 border-ok/40">
      <Handle type="target" position={Position.Left} />
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-ok">
        <CircleUserRound className="h-3 w-3" /> Human
      </p>
      <p className="mt-0.5 text-[12px]">{data.label}</p>
    </Shell>
  );
}

const nodeTypes = { trigger: TriggerNode, agent: AgentNode, tool: ToolNode, human: HumanNode };

function graphFor(agents: BlueprintAgent[], selected: number): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];
  let y = 0;
  agents.forEach((a, i) => {
    const rows = Math.max(1, a.tools.length + 1);
    const height = rows * 58;
    const mid = y + height / 2 - 30;
    nodes.push({ id: `t${i}`, type: "trigger", position: { x: 0, y: mid }, data: { label: a.trigger } });
    nodes.push({ id: `a${i}`, type: "agent", position: { x: 260, y: mid - 10 }, data: { label: a.name, sub: a.role, selected: i === selected } });
    edges.push({ id: `e-t${i}`, source: `t${i}`, target: `a${i}`, animated: true });
    a.tools.forEach((t, j) => {
      nodes.push({ id: `a${i}t${j}`, type: "tool", position: { x: 580, y: y + j * 58 }, data: { label: toIdentifier(t) } });
      edges.push({ id: `e-a${i}t${j}`, source: `a${i}`, target: `a${i}t${j}` });
    });
    nodes.push({ id: `h${i}`, type: "human", position: { x: 580, y: y + a.tools.length * 58 }, data: { label: "Approves irreversible steps" } });
    edges.push({ id: `e-h${i}`, source: `a${i}`, target: `h${i}`, style: { strokeDasharray: "4 4" } });
    y += height + 50;
  });
  return { nodes, edges };
}

type TraceStep = { kind: string; label: string; detail?: string; ms: number };

export function AgentsPanel({ api }: { api: WorkspaceApi }) {
  const source = api.data.blueprint;
  const [draft, setDraft] = useState<Blueprint | null>(source);
  const [sel, setSel] = useState(0);
  const [pane, setPane] = useState<"config" | "code" | "test">("config");
  const [newTool, setNewTool] = useState("");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState<{ steps: TraceStep[]; engine: string; ms: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const theme = useTheme();

  useEffect(() => setDraft(source), [source]);
  const agents = useMemo(() => draft?.agents ?? [], [draft]);
  const { nodes, edges } = useMemo(() => graphFor(agents, sel), [agents, sel]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);
  const agent = agents[sel];
  const fw = getFramework(api.data.project.framework);

  useEffect(() => {
    if (sel >= agents.length) setSel(Math.max(0, agents.length - 1));
  }, [agents.length, sel]);
  useEffect(() => setTrace(null), [sel]);

  if (!draft) {
    return (
      <div className="blueprint-grid flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="font-display text-3xl">Agents live here</p>
          <p className="mt-2 text-sm text-ink-2">Once your Blueprint is drafted, its agents appear on this canvas.</p>
        </div>
      </div>
    );
  }

  const update = (fn: (a: BlueprintAgent) => void) =>
    setDraft((d) => {
      if (!d) return d;
      const n = structuredClone(d);
      fn(n.agents[sel]);
      return n;
    });

  const addAgent = () => {
    setDraft((d) => {
      if (!d) return d;
      const n = structuredClone(d);
      n.agents.push({ name: `Agent ${n.agents.length + 1}`, role: "Describe what this agent is responsible for.", instructions: "You help the team. Ask a human before any irreversible action.", tools: ["search_records"], trigger: "On demand" });
      return n;
    });
    setSel(agents.length);
    setPane("config");
  };

  const save = async () => {
    const names = new Set(draft.agents.map((a) => a.name.trim().toLowerCase()));
    if (names.size !== draft.agents.length) return toast.error("Agent names must be unique");
    setSaving(true);
    await api.saveBlueprint(draft);
    setSaving(false);
  };

  const run = async () => {
    if (!agent || !input.trim()) return;
    setRunning(true);
    setTrace(null);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: api.data.project.id, agent: { name: agent.name, instructions: agent.instructions, tools: agent.tools }, input }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Run failed");
      setTrace({ steps: j.trace, engine: j.engine, ms: j.ms });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[1fr_400px]">
      <div className="relative min-h-[320px] border-b border-line lg:border-b-0 lg:border-r">
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <Badge tone="neutral" className="bg-elev">{agents.length} agent{agents.length === 1 ? "" : "s"} · {fw.name}</Badge>
          <Button size="sm" variant="secondary" onClick={addAgent}>
            <Plus className="h-3.5 w-3.5" /> Agent
          </Button>
        </div>
        {dirty && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-line bg-elev p-1.5 pl-3 shadow-card">
            <span className="text-[12px] text-ink-2">Unsaved agent changes</span>
            <Button size="sm" variant="ghost" onClick={() => setDraft(source)}>
              Discard
            </Button>
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </div>
        )}
        {agents.length === 0 ? (
          <div className="blueprint-grid flex h-full items-center justify-center text-sm text-ink-3">No agents yet. Add one to get started.</div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
            colorMode={theme}
            onNodeClick={(_, n) => {
              const m = n.id.match(/^[tah](\d+)/);
              if (m) setSel(Number(m[1]));
            }}
          >
            <Background gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>

      <div className="flex min-h-0 flex-col bg-elev">
        {agent ? (
          <>
            <div className="flex-none border-b border-line p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{agent.name}</p>
                  <p className="truncate text-[12px] text-ink-3">When: {agent.trigger}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${agent.name}`}
                  onClick={() =>
                    setDraft((d) => {
                      if (!d) return d;
                      const n = structuredClone(d);
                      n.agents.splice(sel, 1);
                      return n;
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-3 flex rounded-lg border border-line bg-sunken p-0.5" role="tablist" aria-label="Agent inspector">
                {(
                  [
                    ["config", "Configure", Settings2],
                    ["code", "Code", Code2],
                    ["test", "Test", FlaskConical],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={pane === id}
                    onClick={() => setPane(id)}
                    className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12.5px]", pane === id ? "bg-elev font-medium shadow-sm" : "text-ink-3 hover:text-ink")}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {pane === "config" && (
                <div className="space-y-4 p-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ag-name">Name</Label>
                    <Input id="ag-name" value={agent.name} maxLength={60} onChange={(e) => update((a) => void (a.name = e.target.value))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ag-trigger">Runs when</Label>
                    <Input id="ag-trigger" value={agent.trigger} maxLength={100} onChange={(e) => update((a) => void (a.trigger = e.target.value))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ag-role">Responsibility</Label>
                    <Input id="ag-role" value={agent.role} maxLength={200} onChange={(e) => update((a) => void (a.role = e.target.value))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ag-instr">Instructions</Label>
                    <Textarea id="ag-instr" rows={6} value={agent.instructions} maxLength={3000} onChange={(e) => update((a) => void (a.instructions = e.target.value))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Tools</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.tools.map((t, i) => (
                        <span key={t + i} className="inline-flex items-center gap-1 rounded-md border border-line bg-bg px-2 py-1 font-mono text-[11.5px]">
                          {toIdentifier(t)}
                          <button aria-label={`Remove tool ${t}`} onClick={() => update((a) => void a.tools.splice(i, 1))} className="text-ink-3 hover:text-ink">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = toIdentifier(newTool);
                        if (newTool.trim() && !agent.tools.map(toIdentifier).includes(t) && agent.tools.length < 12) update((a) => void a.tools.push(t));
                        setNewTool("");
                      }}
                    >
                      <Input value={newTool} onChange={(e) => setNewTool(e.target.value)} placeholder="send_slack_message" aria-label="Add tool" className="h-8 font-mono text-[12.5px]" />
                      <Button size="sm" variant="secondary" type="submit">
                        Add
                      </Button>
                    </form>
                  </div>
                  <div className="rounded-lg border border-line bg-bg p-3">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-medium">
                      <ShieldCheck className="h-3.5 w-3.5 text-ok" /> Guardrails (Lyzr responsible-AI defaults)
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-[12px] text-ink-2">
                      <li>• PII redaction on inputs and outputs</li>
                      <li>• Toxicity and prompt-injection filter</li>
                      <li>• Human approval before irreversible actions</li>
                    </ul>
                  </div>
                </div>
              )}

              {pane === "code" && (
                <div className="flex h-full min-h-[420px] flex-col">
                  <div className="flex flex-none items-center gap-2 border-b border-line px-4 py-2">
                    <Label htmlFor="ag-fw" className="text-[12px]">
                      Framework
                    </Label>
                    <select
                      id="ag-fw"
                      value={fw.id}
                      onChange={(e) => void api.patchProject({ framework: e.target.value }).then(() => toast.success(`Agents now use ${getFramework(e.target.value).name}`))}
                      className="h-8 flex-1 rounded-lg border border-line bg-elev px-2 text-[13px]"
                      disabled={api.busy}
                    >
                      {FRAMEWORKS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.language})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="flex-none px-4 py-2 text-[12px] text-ink-3">
                    {fw.blurb} {dirty && "Save to regenerate files."}
                  </p>
                  <div className="min-h-0 flex-1">
                    <Editor
                      value={generateAgentCode(agent, fw.id)}
                      language={fw.language}
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12.5, wordWrap: "on", scrollBeyondLastLine: false }}
                    />
                  </div>
                </div>
              )}

              {pane === "test" && (
                <div className="space-y-4 p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run();
                    }}
                    className="grid gap-2"
                  >
                    <Label htmlFor="ag-input">Try a message</Label>
                    <Textarea id="ag-input" rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Simulate: ${agent.trigger}`} maxLength={2000} />
                    <Button type="submit" loading={running} disabled={!input.trim()}>
                      <Play className="h-3.5 w-3.5" /> Run agent
                    </Button>
                  </form>
                  {dirty && <p className="text-[12px] text-warn">Testing uses your unsaved instructions.</p>}
                  {trace && (
                    <div>
                      <p className="annotation mb-2">
                        Trace · {trace.ms} ms · {trace.engine === "claude" ? "AI engine" : "demo engine"}
                      </p>
                      <ol className="relative space-y-3 border-l border-line pl-4">
                        {trace.steps.map((s, i) => (
                          <li key={i} className="relative">
                            <span
                              className={cn(
                                "absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-elev",
                                s.kind === "answer" ? "bg-ok" : s.kind === "tool" ? "bg-accent" : s.kind === "guardrail" ? "bg-warn" : "bg-line-strong",
                              )}
                              aria-hidden
                            />
                            <p className="flex items-center justify-between text-[12.5px] font-medium">
                              {s.label} <span className="font-mono text-[11px] font-normal text-ink-3">{s.ms} ms</span>
                            </p>
                            {s.detail && (
                              <p className={cn("mt-0.5 whitespace-pre-wrap text-[12.5px]", s.kind === "answer" ? "rounded-lg bg-sunken p-2.5 text-ink" : "text-ink-2", s.kind === "tool" && "font-mono text-[11.5px]")}>
                                {s.detail}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-ink-3">Select an agent on the canvas.</div>
        )}
      </div>
    </div>
  );
}
