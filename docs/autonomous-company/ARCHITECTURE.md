# Autonomous Company — Architecture & Research

**Status:** Accepted for foundation implementation  
**Date:** 2026-09-21  
**Product:** mcp-ui-poc (chat-first UI studio)

## 0. Investigation findings

### Repository intent

This repo is a **chat-first UI studio**: prompt → versioned Widget via Jev decisions + ThemeAdapter construction, with optional Haiku copy/HTML. Canonical workflow: `docs/AI_WORKFLOW.md`. Product glossary: `CONTEXT.md`.

### Existing agent infrastructure (reuse, do not replace)

| Asset | Role | Decision |
|-------|------|----------|
| `docs/AI_WORKFLOW.md` | Canonical SDLC for humans/agents | **Keep** — company phases map onto it |
| `.claude/skills/*` | Project playbooks (implement, review, TDD, …) | **Keep** — implementers invoke these |
| `studio-staff` | PM/EM staffing cycle for product improvement | **Reuse** for product audit / PM+EM briefs |
| `/start` | Single-feature autonomous cycle (no durable state) | **Supersede for long runs**; keep for one-shot |
| Matt Pocock skills (`skills:install`) | ask-matt, implement, tdd, code-review, research, … | **Integrate**; do not fork or duplicate TDD |
| `.claude/commands/` | Thin slash wrappers | **Add** `/autonomous-company` |
| GitHub Issues + `gh` | Issue tracker (per `docs/agents/`) | **Optional signal source**; not required |
| Vitest in `packages/core` | Test pattern | **Mirror** for company runtime package |
| CI (`.github/workflows/ci.yml`) | test + lint + build | **Extend** to run company package tests |

### Host environment

- Coding agents: Cursor / Claude Code (skill + slash command).
- Runtime: Node 22 ESM (repo engines).
- No Durable Functions / Temporal / Azure hosted skills available in this repo.
- MCP: browser verification when configured; not assumed always present.
- Secrets: `.env.local` only; never in company state or prompts.

### Matt Pocock conventions (official, researched 2026-09-21)

Source: [mattpocock/skills](https://github.com/mattpocock/skills)

- Install via `npx skills@latest add mattpocock/skills` (already wrapped by `npm run skills:install`).
- Run `/setup-matt-pocock-skills` once per clone.
- Skills are `SKILL.md` directories with YAML frontmatter (`name`, `description`; optional `disable-model-invocation`).
- Engineering router: `/ask-matt`. Domain docs: `CONTEXT.md` + `docs/adr/`.
- **Do not** install plugin + editable copies together; this repo uses editable install.
- **Do not** run two TDD skills (project `tdd` vs Matt `tdd`) in one cycle.

### Claude Code / Cursor skill model (official docs)

- Skills live under `.claude/skills/<name>/SKILL.md`; slash command = directory name.
- Progressive disclosure: keep SKILL.md lean; put depth in referenced files.
- User-triggered workflows should set `disable-model-invocation: true`.
- Durable multi-step state does **not** belong only in conversation context — persist externally.

## 1. Problem statement

`/start` and `studio-staff` are strong **single-cycle** playbooks. They lack:

1. Durable resumable state across interruptions  
2. A maintained task pool with deduplication  
3. Explicit multi-role coordination via artifacts  
4. Budget / stop conditions / honest “no valuable work” exits  
5. Controlled self-improvement with rollback  
6. A single long-running company loop with observability  

We need a **repository-level autonomous company** that values evidence and product outcomes over task volume.

## 2. Orchestration alternatives compared

### Approach A — Prompt-only mega-skill

One large SKILL.md that tells the agent to role-play all phases.

- **Pros:** Fast to write; fits slash-command UX.  
- **Cons:** No durable resume; non-testable prioritization; easy runaway loops; weak anti-slop enforcement.  
- **Verdict:** Insufficient for the stated requirements.

### Approach B — External workflow engine (Temporal / Durable Functions / custom queue)

- **Pros:** Industrial durability.  
- **Cons:** Not available in this host; adds ops burden; overkill for a single-repo coding-agent product; still needs an LLM agent for code changes.  
- **Verdict:** Reject for this repository.

### Approach C — Hybrid: durable Node controller + skill entry + existing skills (CHOSEN)

- **Controller package** (`packages/autonomous-company`): deterministic state machine, discovery heuristics, prioritization, gates, conflict detection, memory, research registry, improvement proposals — all unit-tested.  
- **Single command** `/autonomous-company` (skill) **and** `npm run company` (CLI): same policies; skill drives agent execution; CLI owns durable mutations.  
- **Role playbooks**: lean set of agent definitions invoked by phase; reuse Matt + project skills for implementation/review.  
- **Artifacts**: machine-readable JSON under `.autonomous-company/` (gitignored runtime) + committed schemas/templates.

**Why C wins:** Integrates with proven repo conventions, is testable without network/LLM, supports resume, and keeps the coding agent as the executor rather than inventing a second agent runtime.

## 3. Organization design (justified roles)

Agents exist only when they change decisions or evidence quality. Coordination cost rises with headcount.

| Role ID | When active | Reuses |
|---------|-------------|--------|
| `controller` | Always (deterministic CLI) | — |
| `founder` | Cycle start + major pivots | CONTEXT, ADRs |
| `product` | Discovery / definition | `studio-staff` PM brief |
| `customer` | UI / journey validation | MANUAL_QA, browser MCP |
| `ux` | UI changes | MASTER.md, ui-ux-pro-max |
| `architect` | Non-trivial design | ADRs, research-first |
| `em` | Task breakdown / sequencing | `studio-staff` EM plan |
| `engineer` | Implementation | `implement-feature`, Matt `implement`/`tdd` |
| `reviewer` | Independent review | Matt `code-review`, `review-changes` |
| `qa` | Validation strategy | `validate-release` |
| `security` | Auth, secrets, sanitize, URLs | ADR-005, safety policy |
| `research` | Scheduled / tech proposals | Matt `research` |
| `debt` | Health scans | discovery engine |
| `improve` | Post-cycle process review | improvement registry |

Specialized engineering subtypes (frontend/backend/AI) are **routing labels** on `engineer`, not separate always-on agents.

## 4. Durable state model

Root (gitignored): `.autonomous-company/`

```
.autonomous-company/
  config.json          # local overrides
  run.json             # active run (phase, budgets, locks)
  tasks/
    pool.json          # prioritized task pool
    <taskId>.json      # task detail + evidence
  memory/
    project.json       # consolidated project memory
  artifacts/
    <taskId>/...       # proposals, plans, reviews, validation
  research/
    index.json
  improvements/
    index.json
  events/
    <runId>.jsonl      # append-only observability
```

Committed defaults: `packages/autonomous-company/defaults/config.json`  
Committed seed memory template: `packages/autonomous-company/defaults/memory.seed.json`

### Resume rules

1. If `run.json` exists with `status: "running"` or `"interrupted"`, resume from `phase` + `activeTaskId`.  
2. Task IDs are content-addressed fingerprints of `(category, problemKey)` to prevent duplicates.  
3. File ownership locks recorded per task; conflicting file claims block parallel assign.  
4. Never invent completed validation — gates require recorded command evidence.

## 5. Execution policy (defaults)

| Control | Default | Purpose |
|---------|---------|---------|
| `maxIterations` | 3 | Cycles per invocation |
| `maxWallTimeMs` | 45 min | Hard stop |
| `maxConcurrentTasks` | 1 | Avoid conflicting edits |
| `maxRetriesPerTask` | 2 | Failure threshold |
| `allowDeploy` | false | High-impact gate |
| `allowForcePush` | false | Safety |
| `allowSecretMutation` | false | Safety |
| `requireReviewForCode` | true | Quality |
| `stopWhenNoHighValueWork` | true | Anti-busywork |

High-impact actions (deploy, production env, irreversible data, dependency major bumps, weakening gates) require `policies.highImpact` allow-list + explicit artifact approval. Default: **block and record**.

## 6. SDLC mapping

| Company phase | Maps to | Primary roles | Gate |
|---------------|---------|---------------|------|
| discover | AI_WORKFLOW Research | founder, product, debt, research | evidence required |
| define | Plan (product) | product, customer | proposal or reject |
| design | Plan (tech) | architect, em | design record |
| breakdown | Plan (tasks) | em | task specs |
| implement | Implement | engineer | diff exists |
| validate | Tests & checks | qa | commands run |
| review | review-changes / code-review | reviewer | approve/reject |
| integrate | Document | em, engineer | docs + re-validate |
| release_ready | validate-release | qa, security | readiness verdict |
| postmortem | Instrument / learn | improve, founder | memory update |

Honest exit: **`NO_ACTIONABLE_HIGH_VALUE_TASK`**.

## 7. Anti-slop protocol

Before accepting work, every executor answers the seven questions in `anti-slop/protocol.js`. Reviewer rejects placeholder code, tautological tests, unrelated refactors, and claims without command evidence. Self-improvement **cannot** disable safety gates or lower validation requirements without a versioned proposal that is independently rejected by default if it weakens gates.

## 8. Integration plan

1. Add workspace package `autonomous-company`.  
2. Root scripts: `company`, `company:test`.  
3. Skill + command + docs.  
4. CI: include `npm run company:test`.  
5. Update `docs/agents/README.md` routing table.  
6. Do **not** remove `/start` or `studio-staff`.

## 9. Non-goals (foundation)

- Fully unsupervised production deploys  
- Replacing Matt Pocock skills  
- Multi-repo swarm  
- Claiming unrestricted autonomy when host permissions block actions  

## 10. Success criteria for this delivery

- Single command documented and wired (`/autonomous-company` + `npm run company`)  
- Durable init/resume/status  
- Discovery can emit zero tasks  
- Prioritization produces rationale + can reject low value  
- Quality gates + adversarial unit tests pass  
- Architecture + audit report committed with honest limitations  
