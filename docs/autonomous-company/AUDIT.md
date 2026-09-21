# Autonomous Company — Audit Report

**Date:** 2026-09-21  
**Branch:** `cursor/autonomous-company-05c4`  
**Auditor role:** implementing agent (self-audit with executed tests)

## What was implemented

1. **Architecture & research** — `docs/autonomous-company/ARCHITECTURE.md` (investigation findings, alternatives A/B/C, chosen hybrid design).
2. **Durable controller package** — `packages/autonomous-company` (Node ESM): config, state store, discovery, prioritization, orchestration, gates, anti-slop, agents registry, memory, research, self-improvement, observability, CLI, repo-root resolution.
3. **Single command** — `/autonomous-company` skill + `.claude/commands/autonomous-company.md` + `npm run company`.
4. **Integration** — root scripts, CI `company:test`, gitignore for `.autonomous-company/`, routing updates in `docs/agents/README.md`, `CONTEXT.md`, `CLAUDE.md`, `README.md`, `.claude/README.md`.
5. **Tests** — 23 Vitest cases including adversarial scenarios.

## Architecture overview

Hybrid model:

- **Deterministic CLI/controller** owns durable state, discovery heuristics, prioritization, locks, budgets, safety, completion gates.
- **Coding agent (this skill)** executes SDLC phases using existing `studio-staff`, Matt Pocock, and project skills.
- **Artifacts + memory** under `.autonomous-company/` enable resume without conversational amnesia.

Approach A (prompt-only) and B (external workflow engine) were rejected — see ARCHITECTURE.md.

## Single-command usage

```bash
/autonomous-company
# or
npm run company -- init
npm run company -- cycle
npm run company -- cycle --resume
npm run company -- cycle --dry-run
npm run company -- status
```

## Supported capabilities (verified)

| Capability | Evidence |
|------------|----------|
| Init durable state | `npm run company -- init` → `/workspace/.autonomous-company` |
| Status / observability | `status` renders phase, pool, locks, stop reason |
| Discovery + prioritization | Dry-run on real repo |
| Reject low-value / hypothesis-only work | Stop reason `NO_ACTIONABLE_HIGH_VALUE_TASK` on live dry-run |
| Deduplicate tasks | Unit test fingerprint upsert |
| Resume after interrupt | Unit test same `runId` |
| File lock conflicts | Unit tests |
| Safety default-deny deploy | Live `safety deploy` → allowed false |
| Anti-slop + gates block false completion | Unit tests |
| Self-improvement cannot weaken safety | Unit tests + rollback test |
| Research claim labels | Unit test |
| Repo root from nested cwd | Fixed + tested (`findRepoRoot`) |

## Agent responsibilities

Lean registry in `src/agents/registry.js` and skill `agents/README.md`: founder, product, customer, ux, architect, em, engineer (+subtypes), reviewer, qa, security, research, debt, improve, controller.

Not theater: subtypes are routing labels; phases activate subsets.

## State management

Gitignored `.autonomous-company/`: `run.json`, `tasks/`, `memory/`, `artifacts/`, `research/`, `improvements/`, `events/*.jsonl`. Atomic JSON writes. Task ids content-addressed.

## Validation performed

```text
npm run company:test   → 23 passed
npm run company -- init
npm run company -- cycle --dry-run
  → NO ACTIONABLE HIGH-VALUE TASK IDENTIFIED
npm run company -- safety deploy → blocked
```

Adversarial unit coverage: ambiguous/no-value reject, falsified validation, file conflicts, safety blocks, review rejection loopback, self-improvement weakening reject, resume-after-interrupt.

## Test results

- `autonomous-company`: **23/23 passed** (2026-09-21).
- Full app `npm test` / client lint: not required for this docs+package change set beyond company tests; CI will run the expanded workflow.

## Known limitations

1. **Not a fully unsupervised coding runtime.** Implementation still requires a coding agent session following the skill; the CLI does not call LLMs or edit product code by itself.
2. **Discovery is heuristic**, not omniscient product research. It can miss real user pain and may propose false-positive test gaps (correctly rejected when hypothesis-only + modest score).
3. **No E2E browser loop in the controller.** UI journey validation remains skill/MCP/`MANUAL_QA.md` responsibility.
4. **Deploy/production autonomy is intentionally blocked** until humans change safety config.
5. **GitHub Issues ingestion** is config-gated off by default (`includeOpenIssues: false`) — not implemented as a live fetcher in v0.1.
6. **Self-improvement apply** updates version registry; it does not auto-rewrite skill markdown without agent action.
7. **Host permission limits** (no secrets, no Vercel token in this audit) mean unrestricted autonomy is **not** claimed.

## Unverified assumptions

- Agents will follow the skill when `/autonomous-company` is invoked (process compliance).
- Matt Pocock skills remain installed via `npm run skills:install` in contributor environments.
- Future discovery sources (issues, telemetry) will be added only with evidence adapters.

## Security risks

- State directory could theoretically hold sensitive excerpts if an agent pastes secrets into artifacts — policy forbids this; no automatic secret scanning yet.
- Controllers cannot prevent a malicious agent from editing `defaults/config.json` in a PR — review still required.
- Residual: dependency on developer discipline for `.env.local`.

## Operational risks

- Runaway loops mitigated by `maxIterations`, wall clock, stop-on-no-work, retry limits.
- Mis-set `COMPANY_REPO_ROOT` could point state elsewhere — document and prefer auto `findRepoRoot`.

## Remaining work (recommended next)

1. Optional GitHub Issues discovery adapter behind `includeOpenIssues`.
2. Richer product-signal discovery (MANUAL_QA failures, acceptance-p0 red tests).
3. Artifact schema validators (JSON Schema) for proposals/reviews.
4. Metrics dashboard reading `events/*.jsonl`.
5. Controlled experiment: one supervised full implement→validate→review cycle on a real queued task.
6. Hook `studio-staff` audit output as an explicit discovery source file.

## Verdict

**Foundation is real and testable, not a toy prompt.** It meets the single-command + durable resume + anti-busywork + safety-gate requirements for v0.1.

**Not production-autonomous** for unsupervised shipping. Suitable for supervised long-running engineering loops in Cursor/Claude Code with honest stop conditions.

Do not inflate: the valuable part is the **controller + policies + integration**; coding quality still depends on the executing agent and existing skills.
