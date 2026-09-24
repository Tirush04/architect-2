# Architect 2.0 — product thinking

> One project, two lenses. Describe the outcome or write the code; either way you ship an agentic app.

## 1. The problem, from first principles

Every vibe-coding platform sells the same promise: *idea → working software*. In practice, users hit three walls:

| Wall | What it feels like | Who hits it |
|---|---|---|
| **The black box** | "It built *something*, but I don't know what it decided or why. When I ask for a change it breaks something else." | Non-technical users |
| **The toy ceiling** | "Great for a demo, but I can't get my real repo in, pick my agent framework, review a diff, or wire it into my CI." | Developers |
| **The agent gap** | "Building a UI is easy now. Building the *agents* behind it (tools, memory, guardrails, evals) is still hand-coded." | Both |

Today's architect.new solves the third wall well for business users (Plan Mode → Agentic Layer → Production App).
But it stops at the first audience. Architect 2.0 keeps that spine and removes the other two walls.

## 2. Reference teardown

| Platform | Core bet | Why people use it | Borrow | Avoid |
|---|---|---|---|---|
| **architect.new** (Lyzr) | Agentic apps for business execs; plan first | PRD + wireframes before build; agents as first-class | Plan-gated build, the agent layer | Non-technical only; no code/repo/diff surface |
| **Lovable** | Prompt → polished full-stack app | Best-looking output fast; Supabase + GitHub sync | Visual edit on the preview, 2-way GitHub sync | Opaque changes; credit burn on fix loops |
| **Replit** (Agent) | Cloud IDE + agent + hosting in one | Zero setup; deploy, DB, and secrets built in | Checkpoints/rollback, integrated deploy + DB | Heavy IDE chrome intimidates non-coders |
| **Emergent** | Multi-agent "full team" builds | Complex apps with testing agents | Visible agent roles (planner, builder, tester) | Long, opaque runs |
| **Vercel v0** | Generative UI on a real stack (Next/shadcn) | Production-grade React, one-click Vercel deploy | Code quality you can own; design-system aware | UI-first; agents/back-end are secondary |
| **Rocket.new** | Prompt → web + mobile apps, templates | Breadth of templates; Figma import | Figma/template on-ramps | Template sameness |
| **Cursor** | AI-native IDE | Codebase-aware edits, diffs, tab-complete | Diff review, @-context, rules files | Assumes you're a developer |
| **Codex** (OpenAI) | Async cloud agent over your repo | Delegate tasks, get PRs back | Task → PR workflow, parallel tasks | No live product surface |
| **Claude Code** | Terminal agent with tools/MCP | Deep repo work, scriptable, hooks, MCP | CLI/MCP access, plan mode, permission model | No visual surface for non-coders |

**Pattern:** the "app builders" (Lovable, Replit, Emergent, v0, Rocket) own the *visual* loop. The "coding agents"
(Cursor, Codex, Claude Code) own the *repo* loop. **Nobody owns the *agent* loop for both audiences.** That's
Architect's opening, and Lyzr's core competency.

## 3. Personas & jobs-to-be-done

**Priya, operations lead (non-technical).** "When my team drowns in credit-card dispute emails, I want to
describe the workflow and get an app with an agent that triages them, so I can stop hiring for it."
Needs: plain-English plan she can approve, confidence nothing breaks, a link she can share, no jargon.

**Dev, full-stack engineer (technical).** "When product asks for an AI feature, I want to scaffold the agent in
*our* framework (LangGraph), inside *our* repo, and review every change, so I ship without a black box."
Needs: import, file tree, diff, framework choice, env/secrets, GitHub PRs, CLI/API, no lock-in.

**The pair.** Priya drafts the Blueprint; Dev opens the same project in Pro lens and hardens it. *This handoff
is the feature no competitor has.*

## 4. Design principles

1. **Plan before code, always visible.** The Blueprint (pages, data, agents, integrations) is approved before a
   line is written, and it stays editable. Changing the plan is cheaper than changing code.
2. **Same project, different lens.** Guided and Pro are views over one source of truth, not two products.
   Nothing is hidden from Guided users; it's just summarised.
3. **Every step is reversible.** Each build turn is a checkpoint with a human-readable summary. Rollback is one
   click, deploys point at checkpoints.
4. **Agents are first-class objects.** They get their own studio: graph ↔ config ↔ code, a playground, a trace.
5. **Show the work.** A streamed step list explains what's happening ("Designing data model… Writing
   Dashboard page…"), never just a spinner.
6. **Bring your own everything (Pro).** Framework, repo, model keys, CLI. Export anytime. No lock-in.
7. **Calm UI.** One primary action per screen. Progressive disclosure over dense chrome.

## 5. Core flows

```
Sign up ─► Onboarding: "How do you like to build?"
            ├─ "I describe outcomes"  → Guided lens
            └─ "I write code"          → Pro lens (+ framework default)
        ─► Home: one prompt box  (or Template · Import repo · Upload zip)
        ─► Workspace
            1. Blueprint streams in  →  user edits / approves   (the plan gate)
            2. Build streams: steps + file chips + agent cards → Preview updates live
            3. Iterate: chat, or click an element in Preview ("make this red")
            4. Agents tab: tune prompts/tools, test in playground, read trace
            5. GitHub: connect → push repo (Pro: branch/PR)
            6. Deploy: checklist → build log → live URL → rollback any checkpoint
```

**Guided vs Pro, per surface**

| Surface | Guided | Pro |
|---|---|---|
| Chat | Plain-English summaries, suggested next prompts | Same + file diffs inline, `/commands` |
| Blueprint | Cards: pages, "what your agents do" | Same + data schema, API routes |
| Code | Hidden behind "View code" | Default tab: tree, Monaco, diff per checkpoint |
| Agents | Canvas + natural-language instructions | Canvas ↔ framework code, tools, env |
| Deploy | Checklist + one button | Envs, env vars, logs, domains, CLI command |
| Extras | Templates, share link | ⌘K palette, API keys, CLI/MCP, import repo |

## 6. Feature map (built = ✅ working · ◐ partly working · ◻ designed flow with dummy data)

| Area | Feature | State |
|---|---|---|
| Auth | Email + password, Google, GitHub sign-in; sessions | ✅ |
| Onboarding | Lens choice, framework default, starter prompt | ✅ |
| Home | Prompt box, recent projects, templates, import entry | ✅ |
| Build | Streaming Blueprint → approve → streamed build (Claude; scripted fallback) | ✅ |
| Preview | Sandboxed live preview, device sizes, click-to-edit | ✅ / ◐ |
| Code | File tree, Monaco editor, per-checkpoint diff | ✅ |
| Checkpoints | Versioned snapshots, rollback | ✅ |
| Agents | Canvas, config, 6 frameworks' code, playground + trace | ◐ (runtime simulated) |
| GitHub | Connect account, create repo + push files | ✅ (with OAuth app) |
| Import | Repo picker, zip upload, codebase-map scan | ◐ |
| Deploy | Build log, live share URL, rollback, env vars | ◐ (hosted on `/share`) |
| Settings | Account, lens, API keys, CLI, usage/credits | ◐ |
| Extras | ⌘K palette, dark mode, templates gallery, pricing | ✅ |

## 7. What I'd do next (not built)
Real container runtime per project · multiplayer cursors · evals dashboard for agents · 2-way GitHub sync
with PR review in-app · Figma import · usage-based billing via Stripe · SOC2-grade audit log for enterprises.

## 8. Metrics I'd watch
Prompt → first preview time · plan-approval rate (plan quality) · % of turns rolled back (build quality) ·
Guided → Pro lens switches (the handoff is working) · day-7 return rate · deploys per project.
