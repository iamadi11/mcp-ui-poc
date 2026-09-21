# Autonomous Company OS — Architecture

**Status:** Company Operating System (v2)  
**Date:** 2026-09-21  
**Product:** mcp-ui-poc

## 0. Why v1 was not enough

v1 (`runCycle` → one task → stop) was a **durable single-task runner**. It prevented true autonomy because:

| Limitation | Effect |
|------------|--------|
| One `activeTaskId` + `maxConcurrentTasks: 1` | No organization of workers |
| Cycle ends when a task is selected or completed | Completing work ends the company |
| Discovery only at cycle start | No continuous departmental discovery |
| No follow-up generation | Outcomes do not create new work |
| Sequential phase CLI for one task | Skill behaves like a coding playbook |
| Prompt “continue” required | Fake autonomy |

**v2 redesign:** a **Company Operating System** with a durable work pool, concurrent workers with leases, a company clock that ticks after completions, departmental cadences, deliberation, follow-ups, and honest idle/monitoring.

## 1. Mental model

```
ONE COMMAND: npm run company -- start
        ↓
COMPANY CLOCK (ticks)
        ↓
┌─ recover stale claims
│  departmental discovery (cadence-gated)
│  triage / reject low value
│  claim READY work for idle workers (concurrent)
│  emit work orders / advance simulated departments
│  collect completions → follow-ups → unblock deps
│  periodic: strategy / research / debt / retro / improve
│  reassess value → AUTONOMOUS | IDLE_MONITORING | STOP
└─ persist state (never wipe on task complete)
```

Coding agents are **worker executors**, not the orchestrator. Matt Pocock / project skills are **capabilities** invoked by workers.

## 2. Durable state

```
.autonomous-company/
  config.json
  run.json              # mode, cycle#, clock, budgets
  workers.json          # worker pool + leases
  tasks/pool.json       # work universe summaries
  tasks/<id>.json       # full work items
  memory/project.json
  artifacts/<id>/
  research/index.json
  improvements/index.json
  deliberations/
  events/<runId>.jsonl
```

## 3. Work item lifecycle

```
discovered → proposed → triaged → ready
  → claimed → in_progress → blocked?
  → review → validation → ready_to_merge → completed
  → rejected | deferred | abandoned
claimed → (lease expired) → stale → ready
```

Fields include: department origin, evidence, outcome, type, priority rationale, confidence, dependencies, risk, effort, owner/reviewer, acceptance criteria, validation requirements, decision history, execution evidence.

## 4. Workers

Departments: product, customer, engineering, qa, security, architecture, research, debt, devex, improve, founder.

Each worker: role, skills/capabilities, status (`idle|busy|blocked`), current claim, lease expiry, specialization.

Workers **return to idle** after completion and pull again. They do not exit the company.

## 5. Company clock

`start` / `tick` drive the OS. Completing a task is an **event**, not a stop reason.

Stop / idle only when:

- No high-value READY work and discovery yields nothing meaningful  
- Budgets exhausted  
- Explicit `stop` / pause  
- Risk threshold / safety block  

`IDLE_MONITORING` persists state and waits for new evidence (next start/tick).

## 6. Follow-ups & feedback

On completion the OS asks: what changed → consequences → new work → obsolete work → unblocks → product value → next. Follow-ups enter the pool through the same triage as discoveries.

## 7. Deliberation

Significant proposals (`product`, `security`, `self_improvement`, architecture-affecting) require multi-perspective records (product + engineering + security + architecture + customer when relevant) before READY. Disagreement is stored; founder/em records the decision with confidence.

## 8. Safety & anti-slop (preserved)

Default-deny deploy/force-push/secrets/gate-weakening. Completion still requires anti-slop answers + gate evidence. Self-improvement cannot weaken safety.

## 9. Single command UX

```bash
npm run company -- start          # boot + run clock until idle/budget
npm run company -- start --ticks 5
npm run company -- tick           # one clock tick (agent loop)
npm run company -- status         # dashboard
npm run company -- stop
```

`/autonomous-company` skill: start → execute work orders → complete/block → **tick again** until status is idle/stopped. Never treat “task done” as “company done.”

## 10. Compatibility

Legacy `cycle` / `phase` remain as thin wrappers for one-shot debugging. Primary autonomy path is `start`/`tick`.
