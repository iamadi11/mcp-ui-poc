# Autonomous Company OS — Audit

**Date:** 2026-09-21 (v2 OS upgrade)

## What changed vs v1

| v1 | v2 |
|----|----|
| `cycle` → one task → stop | `start`/`tick` company clock; completion ≠ stop |
| `maxConcurrentTasks: 1` | Default 3 concurrent worker claims |
| Statuses: queued/active/... | Full work lifecycle + stale lease recovery |
| No workers file | `workers.json` roster with leases |
| No follow-ups | Post-completion follow-up proposals + triage |
| No deliberation | Multi-perspective deliberation for significant work |
| Discovery once per cycle | Continuous + cadence-gated departmental discovery |
| Prompt “continue” | Architecture requires `tick` after `complete` |

## Honest limitations

- Coding agents still **execute** engineering work orders; the OS does not compile/ship code by itself.
- GitHub Issues are optional discovery signals (`includeOpenIssues` default false) — agents may intake verified issues.
- Research cadence creates **monitor-class** work; it does not fabricate papers or benchmarks.
- Host cloud agents may lack merge-to-main permission unless explicitly granted.
- `IDLE_MONITORING` is not a long-lived daemon in all hosts — durable state + re-`start`/`tick` is the portable persistence model.

## Multi-cycle acceptance (automated)

`packages/autonomous-company/test/company-os.test.js` proves:

1. Start → claim → complete → company still running → tick continues  
2. Stale lease recovery  
3. Deliberation can reject  
4. Follow-ups generated from completion  
5. Idle when no high-value work  
6. Concurrent claims capped by config  
7. Workers return to idle after completion  

## Self-critique

Compared to a small software company: v2 has a **shared backlog, workers, clock, follow-ups, and idle honesty**. It is still coupled to an external coding agent for implementation — that is intentional for this repository host.
