Run the autonomous software company Director for **Mac Agent** (`mac-agent/` in this monorepo).

Invoke `.claude/skills/autonomous/SKILL.md` (same as `/autonomous`).

From the **mcp-ui-poc** repository root:

```bash
npm run autonomous -- start --goal "$ARGUMENTS" --ticks 12
```

If `$ARGUMENTS` is empty, use `.agent/state/current-objective.md` under `mac-agent/` or default to building the local-first Mac AI control application.

Do not stop after one specialist task. Continue until idle, blocked, or tick budget exhausted. Report phases, skills, gates, and evidence paths.

Distinct from `/autonomous-company` (studio Company OS).
