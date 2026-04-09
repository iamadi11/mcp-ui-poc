# AI agent workflow (canonical)

This document is the single source of truth for how AI assistants and human contributors should change this repository. Tool-specific files (`CLAUDE.md`, Cursor rules) point here; they must not redefine a conflicting workflow.

## Mandatory implementation sequence

Follow these steps in order for non-trivial work (features, refactors, non-trivial bug fixes):

1. **Research** — Understand the existing code, APIs, and constraints. Confirm feasibility and dependencies before writing code.
2. **Plan** — Break work into small, testable units. Note files and modules that will change and any API or UX impact.
3. **Test definition** — Decide what will prove correctness (manual checklist, new automated test, or extension of an existing test). For regressions, capture the failing case first when possible.
4. **Implement** — Make focused changes that match project patterns. Keep server and client responsibilities separated.
5. **Tests & checks** — Run the relevant automated checks (see [Testing expectations](#testing-expectations)). Add or update tests when the project’s policy applies.
6. **Validate** — Run the app paths affected (API + UI as needed). Confirm no regressions in related flows.
7. **Document** — Update `README.md` or inline docs when behavior, APIs, or setup changes.
8. **Instrument** — Add logging or diagnostics only when needed for operational clarity; never log secrets.

Skips require a one-line rationale (e.g. “docs-only: no code change”).

## Testing expectations

| Area | Policy |
|------|--------|
| **Client (`client/`)** | Run `npm run lint` in `client/` after JSX/JS changes. Fix new lint issues. |
| **Server (`server/`)** | Manually exercise changed API routes or flows; add automated tests when a test runner is introduced. |
| **End-to-end** | No E2E suite in-repo yet; use structured manual validation (see Validate step). |
| **Coverage** | No global coverage target until a test framework is adopted; prefer small, focused tests once added. |

When adding a test framework, update this section and `package.json` scripts in one change.

## Architecture boundaries

- **Layout**: Root holds orchestration `package.json`; **`server/`** — Express API, MCP-related Node code; **`client/`** — React (Vite) UI only. Do not put React app code under `server/` or Express routes inside `client/src/`.
- **Imports**: ES modules (`"type": "module"`). Prefer explicit relative imports within each app; avoid circular dependencies between server modules.
- **Stack constraints**: JavaScript (not TypeScript) in this repo. Avoid `eval`, dynamic `Function`, and unnecessary `any`-style looseness; use clear shapes and validation on the server for user input.
- **Forbidden**: Hardcoding API keys or tokens; duplicating secret material in prompts, logs, or generated HTML/JS served to clients.

## Security

- **Secrets**: Only in environment variables or a secret manager. Use `.env` locally (gitignored); never commit `.env` or paste secrets into source, tests, README examples, or agent chat logs.
- **Agent output**: Do not echo or generate files containing real API keys, passwords, or session tokens.
- **APIs**: Validate and sanitize request bodies on the server; avoid leaking stack traces or internal paths in production error responses when hardening.

## Code exploration policy

Prefer **structured, scoped navigation** before scanning the entire repository.

1. **Read** `README.md`, this file, and `CLAUDE.md` for context.
2. **Locate** entry points: `server/index.js`, `client/src/main.jsx`, `client/src/App.jsx`.
3. **Search** within `server/` or `client/` for the feature or symbol you need (editor search or `rg` scoped to one directory).
4. **MCP / IDE tools** (when enabled in your environment): use **Cursor’s MCP** (e.g. **cursor-ide-browser** for UI verification, **user-ai-agent-committee** if configured) — read tool schemas before calling; use **browser snapshot** before interactions for web flows.
5. **Whole-repo grep** — Use only after scoped search is insufficient or for global renames.

---

*Exceptions to this workflow belong in a PR description or a single line in the tool-specific file with rationale.*
