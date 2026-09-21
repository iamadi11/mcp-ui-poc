---
name: autonomous-company
description: >-
  Repository-level autonomous software company OS. One command starts a durable
  company clock with a work pool, concurrent workers, departmental cadences,
  follow-ups after completion, and honest idle/monitoring — not a single-task
  coding loop. Use when the user invokes /autonomous-company, asks to run the
  autonomous company, or wants continuous organizational engineering.
disable-model-invocation: true
---

# Autonomous Company OS

You are a **worker executor inside a living software company**, not a one-shot coding skill.

**Single entry:** `/autonomous-company` + `npm run company -- start`

Architecture: **`docs/autonomous-company/ARCHITECTURE.md`**.  
Canonical coding: **`docs/AI_WORKFLOW.md`**. Glossary: **`CONTEXT.md`**.  
Engineering backlog: **`docs/engineering-roadmap.md`**.

## Critical behavioral rule

**Completing a task does NOT end the company.**

After `complete`, you MUST run:

```bash
npm run company -- tick
```

and continue until status/mode is `idle_monitoring` or `stopped` (or budgets exhausted).

Forbidden as the primary autonomy mechanism: saying “continue”, role-playing 20 employees in one prompt, or inventing tasks to keep busy.

## Product gap (before honest idle)

If status/stopReason is **`IDLE` / `idle_monitoring` / `ONLY_SPECULATIVE_OR_DEFERRED` / `NO_ACTIONABLE_HIGH_VALUE_TASK`** and there is **no** READY (or BLOCKED-for-Cursor) work with `department=engineering` / `roadmap:EE-*` / `origin=roadmap:selected`:

1. **Load** `.cursor/skills/autonomous-company-product-gap/SKILL.md` **first**.
2. Confirm whether **Selected / must implement** rows remain in `docs/engineering-roadmap.md`.
3. If Selected rows remain unimplemented → remediate discovery (do not invent side quests).
4. If Selected is empty and only Deferred/speculative remains → honest idle.

## READY engineering / roadmap work is Cursor work

Treat these as **your** job (not busywork / not “side quests”):

- Pool items with `department=engineering` and confidence ≥ 0.8
- `problemKey` like `roadmap:EE-001` / `origin=roadmap:selected`
- Status **READY** or **BLOCKED** with  
  `Requires Cursor agent / engineering worker (LLM) — implement Selected roadmap item`

Implement via Matt/project skills, validate, `complete`, then **`tick`**.

## Boot (mandatory)

```bash
npm run company -- start
# or resume:
npm run company -- start --ticks 8
npm run company -- status
```

Read the dashboard + `workOrders` from the CLI JSON.

## Worker loop (architecture, not a prompt trick)

```
start/tick
  → claim work orders (OS assigns workers)
  → for each work order: investigate → implement (Matt/project skills) → validate → review
  → npm run company -- complete <id> --report artifacts/.../completion.json
  → npm run company -- tick          # REQUIRED
  → repeat until idle_monitoring / stopped
```

Matt Pocock + project skills are **capabilities** on workers, not the orchestrator.

| Need | Capability |
|------|------------|
| Implement | `implement-feature` + Matt `implement` **or** `tdd` (one TDD only) |
| Review | Matt `code-review` / `review-changes` |
| Validate | `validate-release` + MANUAL_QA + browser when UI |
| Research | Matt `research` |
| Product staffing | `studio-staff` |
| Ambiguity | `/ask-matt` |
| Idle without Selected shipped | `autonomous-company-product-gap` |

## Durable state

`.autonomous-company/` (gitignored): run, **workers.json**, tasks pool, memory, artifacts, deliberations, events.

Mutate via CLI only.

## Stop / idle (honest)

- `HIGH_VALUE_WORK_EXISTS` → keep executing Cursor engineering / Selected items
- `ONLY_SPECULATIVE_OR_DEFERRED` → load product-gap skill; idle only if Selected empty
- `NO_ACTIONABLE_HIGH_VALUE_TASK` → idle/monitoring (persists; next start resumes)
- Budgets (`maxCycles` / wall clock)
- Explicit `npm run company -- stop`
- Safety / missing permissions for required validation

Do **not** invent low-value work to avoid idle.

## Completion evidence

```bash
npm run company -- complete <taskId> --report .autonomous-company/artifacts/<taskId>/completion.json
```

Anti-slop answers + gate checklist + real exit codes required. Follow-ups are enqueued by the OS.

## Safety

```bash
npm run company -- safety deploy
```

Default deny: deploy, force push, secrets, gate weakening, production infra.

## Deliverable each invocation

Company report:

1. Run id / mode / cycle / stop-or-idle reason  
2. Work pool + workers summary  
3. Work orders executed  
4. Follow-ups created  
5. Validation actually run  
6. Residual risks  
7. Host permission limits  

Do not claim unrestricted autonomy.
