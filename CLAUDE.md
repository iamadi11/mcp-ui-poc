# Claude Code — project context

## Stack & layout

- **Stack**: Node.js (ES modules), Express (`server/`), React 18 + Vite (`client/`), Tailwind CSS v4 + shadcn/ui in the shell (`client/src/components/ui/`), `@mcp-ui` usage in server MCP code paths.
- **Client UI**: Chat-first studio (`client/src/studio/`). Visual rules: **`design-system/MCP-UI/MASTER.md`** (IBM Plex Sans + JetBrains Mono, teal accent, no decorative glass). Generated iframes go through a **ThemeAdapter** (`designSystem.render(spec, theme)`).
- **Monorepo**: Root `package.json` (server + scripts) and `client/`. Install: `npm install` at root, `npm run install-all` for both. After clone: `npm run skills:install`.

## Mandatory workflow

Follow **`docs/AI_WORKFLOW.md`**. Non-trivial work: `/ask-matt` first. UI work: MASTER.md + UI UX Pro Max skill. Product glossary: **`CONTEXT.md`**. ADRs: `docs/adr/`.

## Navigation & review tools

Use these **first** (see `docs/AI_WORKFLOW.md` for order):

- Project docs: `README.md`, `CONTEXT.md`, `docs/AI_WORKFLOW.md`, this file.
- Scoped search: ripgrep/editor search within `server/` or `client/` before whole-repo sweeps.
- **MCP** (when available): **cursor-ide-browser** for UI verification; **user-ai-agent-committee** if enabled — read tool schemas before calling.

## Do / don’t (project-specific)

- **Do** keep API and static generation logic in `server/`; UI in `client/src/`. Jev decides; catalog constructs; Haiku writes copy on catalog layouts and **generates HTML** when the catalog cannot express the prompt. Never send full API payloads to an LLM — `inferShape` only.
- **Do** use `process.env` for configuration; rely on `.env.local` locally (never commit secrets). Production omits TypeSafe/Anthropic keys (BYOK).
- **Do** run `npm run lint` from `client/` after changing JSX/JS; `npm test` for `packages/core`.
- **Don’t** leak shadcn into `layout-policy.js`. **Don’t** add secrets to prompts, logs, or generated MCP UI payloads.

## Skills

Playbooks: **`.claude/skills/`** plus Matt Pocock skills after `npm run skills:install`. Matt `tdd` / `code-review` replace duplicates — do not run two TDD skills. Staffing the studio (PM+EM, parallel Dev/QA/AI Engineer): **`studio-staff`**. Autonomous company loop: **`autonomous-company`** / `/autonomous-company`. See **`docs/agents/README.md`**.

## Agent skills

### Issue tracker

GitHub Issues on `iamadi11/mcp-ui-poc` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/` (including **005-surfaces.md** for records vs product UI). See `docs/agents/domain.md`.
