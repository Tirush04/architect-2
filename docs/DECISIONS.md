# Decisions

**Lenses, not modes or products.** Serving both audiences with two apps doubles the surface and kills the handoff.
A per-project lens toggle keeps one source of truth. Guided *summarises*; it never hides.

**Plan gate.** Approving a Blueprint before code is written costs one click and saves the "it built the wrong
thing" loop. It keeps the best part of today's Architect (Plan Mode) and makes it editable.

**Checkpoints are append-only.** Restoring v2 creates v5 as a copy of v2. Nothing is ever destroyed, so rollback is
safe to click. Deployments point at checkpoints, so a deploy rollback is just redeploying an old version.

**Agents are generated as real framework code** (deterministic templates) rather than by the LLM. That makes the
code correct by construction, instantly switchable between six frameworks, and testable. The LLM's job is the
Blueprint (what agents exist and what they do) and the UI.

**Two engines, one protocol.** Claude and the scripted demo engine emit the same SSE events (`step`, `file_start`,
`file_delta`, `file`, `blueprint`, `done`). The UI doesn't know which one ran. The demo engine keeps the product
demoable with no key, makes E2E tests deterministic, and takes over when the model fails, refuses, or the daily
limit is hit.

**Generated apps are single-file HTML** for this prototype: instant sandboxed preview with no build container, and
real public hosting from the platform itself. The production path is a container per project (Pro lens already
shows the file tree it would run).

**Security over convenience.** No `allow-same-origin` in the preview, a CSP `sandbox` on public apps, and no
dangerous OAuth email linking (it enables account pre-hijacking). Secrets are encrypted, API keys hashed.

**What's deliberately a designed flow (not wired):** billing, custom-domain verification, third-party integrations,
the CLI/MCP package, collaborator invites. Each shows its UI and states that it's simulated.
