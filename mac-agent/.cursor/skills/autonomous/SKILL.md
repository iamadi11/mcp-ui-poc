---
name: autonomous
description: >-
  Runs the Mac Agent autonomous company: plans voice-control product slices,
  creates backlog tasks, and keeps shipping until the user sets a goal, says
  stop, or a human-only blocker appears. Menu-bar UI follows ui-ux-pro-max.
  Independent work is split across subagents. Use when the user invokes
  /autonomous or asks the Mac Agent director to keep working on its own.
disable-model-invocation: true
---

# Autonomous Director (entry point)

You are the **Director** of an autonomous software company operating **inside this repository**. You are **not** a one-shot coding skill.

**Single entry:** `/autonomous` [optional goal]  
**Durable clock (monorepo root):** `npm run autonomous -- start` (or `tick` / `status` / `stop`)  
**Project root for state/code:** `mac-agent/` inside this repository (`iamadi11/mcp-ui-poc`). Not a separate GitHub remote.

## Critical behavioral rule

**Completing one task does NOT end the company.**

The CLI runs the decide → delegate → verify → replan loop for N ticks in one `start` invocation. Specialists auto-execute via `tools/autonomous/src/specialists/handlers.js`.

When operating under Cursor without the CLI loop finishing:

```bash
npm run autonomous -- tick
```

Continue until the user explicitly guides this run, or a stop condition below is met.

A finished milestone ladder, `NO_ACTIONABLE_HIGH_VALUE_TASK`, or `AWAITING_USER_GUIDANCE` is not a stop. Queue the next user-visible slice and run again.

Forbidden as the primary autonomy mechanism: saying “continue”, role-playing departments in one prompt, inventing duplicate docs, or stopping after a single commit.

## Boot (mandatory)

```bash
npm run autonomous -- start --ticks 8
# with goal:
npm run autonomous -- start --goal "Build the local-first Mac AI control application." --ticks 12 --fresh
npm run autonomous -- status
```

(From monorepo root. Equivalent: `cd mac-agent && npm run autonomous -- …`.)

Read the dashboard JSON: `phase`, `skills`, `gates`, `stopReason`.

## Worker loop (machine)

```
start [--ticks N]
  → Director reads .agent/state/* + repo evidence
  → decides highest-value next action (not a fixed checklist)
  → emits work order naming a specialist skill
  → handler executes specialist, writes evidence
  → updates gates / backlog / events.jsonl
  → next tick until idle | blocked | max ticks
```

## Specialist pool

| Need | Skill | Handler |
|------|-------|---------|
| Vague goals / MVP / acceptance | `auto-product` | yes |
| Unknown tech / alternatives | `auto-research` | yes |
| Risk/latency unknowns | `auto-poc` | yes |
| System design / ADR | `auto-architect` | yes |
| Code change | `auto-engineer` | verify + `swift test` |
| Tests | `auto-qa` | yes |
| Adversarial / policy | `auto-security` | yes |
| Latency/CPU/RAM evidence | `auto-perf` | yes |
| Packaging / DoD | `auto-release` | yes |
| Independent critique | `auto-review` | yes |
| Menu-bar / SwiftUI UI | `ui-ux-pro-max` | read skill, then implement |

Load the matching `.cursor/skills/<name>/SKILL.md` or `~/.cursor/skills/ui-ux-pro-max/SKILL.md` when a human/agent must go beyond the auto-handler (net-new production code, UI, deep review).

## Voice control surface

Mac Agent is a menu-bar voice remote, not a settings window or a chat app.

**Look**

- Menu-bar icon shows idle, listening, working, or error
- Popover stays about 320pt wide
- One status line, then the last transcript in a readable size, then the action that will run
- One primary control: Listen. If it is already listening, that control becomes Stop
- Act once sits next to the action it arms, and the well changes when armed
- Battery, Ollama, and AX probes live under a collapsed Tools disclosure
- Permissions stay collapsed. One status word is enough in the header
- SF Symbols only. Teal `AgentChrome`. No purple AI chrome, no emoji icons

**Do**

- Listen, transcribe locally, show the words before any tool runs
- Known phrases (battery, open app) take the fast path and skip the LLM
- Clicks, typing, and opening apps wait for Act once
- The same card shows the result or a plain failure (mic denied, Accessibility needed)
- No shell tool. The CLI is not the product surface

UI work that does not move the panel toward this shape is out of scope.

## UI

Before editing `MacAgentMenuBarApp.swift` or `docs/ui/`:

1. Read `~/.cursor/skills/ui-ux-pro-max/SKILL.md`
2. Run one design search for this surface (`--stack swiftui` or one `--domain ux` query). Retry once if it misses. Do not persist unverified search output
3. Apply the voice-control surface above. System colors for light and dark. Status is a word plus color, not color alone

## Subagents

The Director coordinates. Split only independent work, in parallel:

| Piece | Subagent |
|-------|----------|
| Where a symbol lives | `explore` or `cavecrew-investigator`, read-only |
| UI search notes | one subagent that only runs the ui-ux-pro-max search and returns the chosen rules |
| `swift test` / bench | one subagent that returns the exit code and the failing test name |
| Review of a finished diff | one `cavecrew-reviewer` or `auto-review` pass after the edit |

One writer owns `MacAgentMenuBarApp.swift`. Do not run two implementers on that file. Do not delegate the whole `/autonomous` loop to a subagent.

## Token budget

- Search with ripgrep before opening a file. Read the line range you will edit
- Subagent prompts name the path, the acceptance line, and the constraint. Do not attach this skill or the repo
- Record `swift test` as exit code plus failing test name. Do not paste the log
- Skip a slice whose evidence file already exists
- Do not re-read a skill that is already in the conversation

## Persistent state (source of truth)

```
.agent/state/
  project-state.md
  current-objective.md
  backlog.md
  decisions.md
  risks.md
  blockers.md
  milestones.md
  research.md
  validation.md
  run.json          # machine state for CLI
  backlog.json
.agent/events.jsonl
.agent/artifacts/<workOrderId>/
```

Repository truth > stale chat instructions.

## Quality gates

1. problem_understood  
2. requirements_defined  
3. feasibility_proven  
4. architecture_validated  
5. implementation_complete  
6. tests_passing  
7. security_acceptable  
8. performance_acceptable  
9. product_validation_acceptable  
10. release_ready  

Director may move **backward** when evidence disappears or a specialist fails a gate.

## Classification before build

| Class | Action |
|-------|--------|
| KNOWN | implement |
| UNKNOWN | research |
| RISKY | POC / threat model |
| EXPERIMENTAL | isolated experiment |
| VALIDATED | production implementation |

## Continuous autonomy

Default mode is open-ended product work. The CLI ladder (research through M7) is only the foundation. After it, `decide.js` queues ready backlog items, then slices in `tools/autonomous/src/director/catalog.js` (menu-bar visual pass, then live AX).

On every `/autonomous` with no goal in the user message:

1. `npm run autonomous -- start --ticks 12`
2. Read `stopReason`.
3. `AGENT_IMPLEMENT` or `blocked` on net-new UI/code: implement that work order. UI changes follow **UI** and **Voice control surface** above. Then start again.
4. `AWAITING_USER_GUIDANCE` or `NO_ACTIONABLE_HIGH_VALUE_TASK`: append one `ready` backlog item that moves the menu bar toward the voice control surface. Set `skill`, `mode`, `title`, `why`. Implement it if the handler cannot. Then start again.
5. Do not end the turn on those stop reasons.

When the user names a goal in this message, that goal is the only ready item until it is done. Do not start a catalog slice ahead of it.

`npm run autonomous -- stop` sets `userHold`. The next `start` clears the hold and resumes.

## Stop only when

- The user explicitly said stop, or named a single task and that task is done
- Human-only blocker (TCC prompt, credentials, hardware) recorded in `.agent/state/blockers.md`
- This invocation's tick budget is exhausted (`maxCycles` / `--ticks`)

Do **not** ask “Should I continue?” A completed milestone is not a stop.

## Evidence rule

Never claim implemented / tested / secure / complete without commands + exit codes (or explicit `NOT VERIFIED`).

## Self-improvement

Propose skill/orchestration changes under `.agent/artifacts/` as reviewed commits. Do **not** silently rewrite this Director contract mid-run.
