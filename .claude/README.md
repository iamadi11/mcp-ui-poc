# Claude Code — project folder

## Skills (`.claude/skills/`)

| Skill folder | Use when |
|--------------|----------|
| `explore-codebase` | Mapping structure and dependencies before editing |
| `research-first` | Feasibility and alternatives before coding |
| `plan-task` | Breaking work into atomic, testable tasks |
| `implement-feature` | Full lifecycle for a feature |
| `tdd` | Tests before or alongside implementation |
| `fix-bug` | Regression: failing case → fix → verify |
| `debug-issue` | Systematic investigation |
| `refactor-safely` | Dependency-aware refactors |
| `review-changes` | Pre-merge checks and risk |
| `validate-release` | Lint, build, manual gates |

Each skill’s `SKILL.md` references **`docs/AI_WORKFLOW.md`**; read that file for the canonical sequence and policies.

## MCP servers (recommended)

Align with Cursor where possible:

- **cursor-ide-browser** — Web UI verification (snapshots before interactions).
- **user-ai-agent-committee** — If your team enables it for review workflows.

Configure MCP in Claude Code / Cursor using your product’s UI or project config. **Do not** commit API keys or personal paths; use environment variables and local-only overrides.

## Hooks

No default hooks are committed. Add **PostToolUse**, **SessionStart**, or **PreCommit** hooks only if the repo gains automation that is portable (no machine-specific absolute paths). Prefer env vars; document required local overrides here if you add hooks.

## Slash commands

Thin wrappers in **`.claude/commands/`** — they point at skills and **`docs/AI_WORKFLOW.md`**.

## Cursor parity

Cursor loads **`.cursor/rules/project-ai.mdc`** (same workflow pointer and guardrails as **`CLAUDE.md`**). Configure MCP in Cursor’s UI or add **`/.cursor/mcp.json`** locally when you have non-secret `command`/`url` entries — do not commit API keys; use `${env:VAR}` patterns per Cursor docs.
