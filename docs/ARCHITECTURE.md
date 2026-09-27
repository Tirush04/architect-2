# Architect 2.0 — architecture

Diagram: [`architecture.png`](architecture.png) (source: [`architecture.svg`](architecture.svg)).
Live prototype: https://architect-2-tirush.vercel.app · Code: https://github.com/Tirush04/architect-2

This document covers two things, kept separate on purpose:
- **Built** — what the prototype in this repo actually does today.
- **Production design** — the tech I'd use to take each part to real users at scale, and why.

---

## 1. Shape of the system

```
Browser (Guided lens | Pro lens)
   │  SSE: step · file_start · file_delta · file · blueprint · done
   ▼
Web app (Next.js on Vercel) ── Auth.js ── Postgres (Neon)
   │
   ├─► Builder agent harness ──► LLM gateway ──► Anthropic · OpenAI · Gemini · open models
   │        │  tools
   │        ▼
   │     Sandbox fleet (microVM per project) ◄── Preview proxy ◄── browser iframe
   │
   ├─► GitHub App (commits, PRs, webhooks, import)
   └─► Deploy pipeline ──► CDN (UI) + functions / agent runtime (Lyzr) ◄── runtime proxy (secrets at egress)
```

**Core decision: one project model, two lenses.** A project is a Blueprint (structured spec) plus
versioned files, agents, deployments and secrets. Guided and Pro are views over that same record, so a
business user and an engineer can hand work back and forth without an export.

**Core decision: plan-gated, event-streamed generation.** Every engine emits the same typed event
stream, so the UI never knows or cares which engine or model ran.

---

## 2. Sandboxing

**Built.** Generated apps are single-file HTML. The in-app preview is an `<iframe srcdoc>` with
`sandbox="allow-scripts allow-forms allow-modals"` and **no `allow-same-origin`**, so generated code runs
in an opaque origin and can't read Architect's cookies or call its API. Public apps (`/share/<slug>`) are
served with `Content-Security-Policy: sandbox …` for the same effect, plus `no-store` caching so a
rollback is visible immediately. User-supplied paths go through `isSafePath` (no `..`, no absolute paths).

**Production design.**
| Need | Choice | Why |
|---|---|---|
| Run full-stack apps + agent code | **Firecracker microVMs** per project (E2B / Vercel Sandbox / Modal, or self-hosted Firecracker) | Kernel-level isolation; containers alone are not enough for untrusted LLM-written code |
| Fast start | Warm pool + **filesystem snapshots** per checkpoint (restore in < 1 s) | "Preview in seconds" is the core UX promise |
| Blast radius | Default-deny egress with an allow-list (package registries, the LLM gateway); CPU/RAM/disk quotas; TTL and idle suspend | Stops crypto-mining, SSRF and data exfiltration from generated code |
| Persistence | Sandbox is disposable; source of truth is the checkpoint in object storage + git | A dead VM loses nothing |

## 3. Agent harness (the builder)

**Built.** `src/lib/engine` runs three async generators, `runPlan`, `runBuild` and `runEdit`:
- **Plan:** Claude returns a Blueprint through structured output, validated with zod.
- **Build:** Claude streams files in `<<<FILE path>>>` blocks. An incremental parser handles markers split
  across chunks, and each file streams to the "UI being built" view as it's written.
- **Edit:** chat changes and click-to-edit selections go back through the same streaming path.

Each turn becomes an **append-only checkpoint**: restoring never deletes, it copies forward. Agent code is
generated deterministically from the Blueprint for six frameworks, so it's correct by construction and
switching frameworks is instant.

A scripted demo engine speaks the same event protocol, so the product works with no API key, E2E tests
are deterministic, and the UI degrades gracefully when the model errors, refuses or the daily limit hits.

**Production design.**
- **Loop:** plan → act → **verify**. Tools: read/write file, shell in sandbox, install package, run tests,
  start dev server, screenshot + visual check. Verification (type check, tests, a headless screenshot) gates
  each checkpoint, so users see working states, not just generated text.
- **Context:** repo map (tree-sitter symbols) + Blueprint as the always-in-context spec; server-side
  compaction for long sessions; prompt caching on the stable prefix.
- **Guardrails:** per-turn step, token and dollar budgets; human approval for irreversible actions
  (deploy, push, deleting data); every tool call traced.
- **Durability:** turns run as **durable workflows** (Temporal / Inngest), and SSE events carry IDs so a
  dropped browser tab reconnects and resumes instead of losing the build.
- **Quality:** an eval suite of golden prompts scored on "does it build, do tests pass, does the screenshot
  match the Blueprint", run on every harness or model change.

## 4. The proxies

**Built.** None needed yet: calls go straight from API routes to the Anthropic SDK, and per-user limits
live in Postgres (`UsageEvent`).

**Production design: three proxies, each with one job.**
1. **LLM gateway** (in front of every model call, from both the builder and deployed agents). It handles
   routing, bring-your-own-key, per-tenant rate limits and credits, response caching, retries/fallback
   across providers, and cost + trace logging (OpenTelemetry). Implementation: LiteLLM or Portkey to
   start, owned in-house once routing becomes a differentiator.
2. **Preview proxy.** Maps `https://<project>.preview.architect.app` to the sandbox port, carrying
   websockets for hot reload. It runs on a **separate registrable domain**, so previews can never share
   cookies with the app, and it's gated by a short-lived signed token.
3. **Runtime egress proxy for deployed apps.** Injects project secrets at egress, so API keys **never
   appear in generated code** or the browser, and enforces the same guardrails as the Lyzr agent runtime
   (PII redaction, allow-listed hosts).

## 5. Model-agnosticism

**Built.** The model is an env var (`ARCHITECT_MODEL`). Engines emit provider-neutral events, and agent
code targets six frameworks from one Blueprint (Lyzr ADK, LangGraph, CrewAI, OpenAI Agents SDK, Claude
Agent SDK, AutoGen).

**Production design.**
- One internal interface: messages, tools, structured output, streaming events. Adapters per provider sit
  behind the gateway.
- **Route by task, not by vendor.** Use the strongest model for planning and architecture, a cheaper,
  faster one for small edits, a small model for classification and summaries, and the user's own key or
  model when they bring one.
- A capability registry per model (context size, tool use, structured output, vision) drives routing and
  fallbacks.
- Every routing change is gated by the eval suite, so "switch model" is a measured decision.

## 6. GitHub integration

**Built.**
- **Sign-in and linking:** Auth.js GitHub OAuth, with tokens **encrypted at rest** (AES-256-GCM).
- **Push:** creates the repo, then commits the checkpoint as one real commit through the Git Data API
  (blobs → tree → commit → ref).
- **Import:** reads the repo tree, pulls text files, detects the stack, and builds a codebase map.
  Folder upload works too, with no GitHub account needed.

**Production design.**
- A **GitHub App**, not an OAuth app: fine-grained per-repo permissions, short-lived installation tokens,
  and org-installable, which matters to enterprise buyers.
- **Two-way sync:** each checkpoint is a commit on an `architect/*` branch; the Pro lens opens PRs; a
  webhook re-indexes when someone pushes from their IDE, so Architect and Cursor/Claude Code can work on
  the same repo.
- Import clones into a sandbox and builds the repo map there, so large repos aren't limited by API calls.

## 7. Deployment and scaling

**Built.** The platform is Next.js on Vercel with Postgres on Neon (Prisma). The deploy flow streams a
build log, pins a deployment to a checkpoint, and serves it at a public `/share/<slug>`. Rollback means
redeploying an older checkpoint. CI runs lint, typecheck, 121 unit tests and 35 Playwright E2E tests
against a real Postgres on every push.

**Production design.**
| Part | Choice |
|---|---|
| Generated UI | Static build to the CDN; full-stack apps deploy through the Vercel (or Cloud Run) API into a per-customer project |
| Generated agents | Serverless functions for simple agents; the **Lyzr agent runtime** for long-running, stateful ones, so they inherit Agent Studio guardrails, traces and org policy |
| Checkpoints | Object storage (S3/R2) keyed by content hash; Postgres keeps only metadata. Today they're JSON in Postgres, fine for single-file apps, not for real repos |
| Long jobs | Durable workflow engine + a queue; the web tier stays stateless and scales horizontally |
| Database | Neon with pooled connections for the app; branch-per-preview for generated apps that need a DB |
| Multi-tenancy | Tenant ID on every row; per-tenant quotas at the gateway; per-tenant encryption keys for secrets |
| Observability | OpenTelemetry traces per build turn (prompt → tool calls → checkpoint), cost per turn, and funnel metrics (prompt → approved plan → first preview → deploy) |

---

## 8. Honest gaps in the prototype
- Generated apps are single-file HTML. There's no container runtime yet, so full-stack previews are the
  first production investment.
- The agent runtime in Agent Studio is simulated. With an API key the playground calls the real model, but
  tools are mocked.
- GitHub sign-in needs its OAuth secret configured on the deployment. Billing, custom domains, integrations
  and the CLI/MCP package are designed flows, and are labelled as such in the UI.
