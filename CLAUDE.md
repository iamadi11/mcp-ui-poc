# Claude Code — project context

## Stack & layout

- **Stack**: Node.js (ES modules), Express (`server/`), React 18 + Vite (`client/`), Tailwind CSS v4 + shadcn/ui in the shell (`client/src/components/ui/`), `@mcp-ui` usage in server MCP code paths.
- **Client UI**: Glassmorphism-style layout (blur, mesh backdrop); light/dark follows system preference. Real-time glass tuning lives in `client/src/glassAppearance.js` and the **Glass** control in `App.jsx` (persisted in `localStorage`).
- **Monorepo**: Two packages — root (server + scripts) and `client/` (frontend). Install: `npm install` at root, `npm run install-all` for both.

## Mandatory workflow

Follow **`docs/AI_WORKFLOW.md`** for the full sequence (research → plan → test definition → implement → tests → validate → document → instrument). Do not contradict that document; one-line exceptions with rationale only.

## Navigation & review tools

Use these **first** (see `docs/AI_WORKFLOW.md` for order):

- Project docs: `README.md`, `docs/AI_WORKFLOW.md`, this file.
- Scoped search: ripgrep/editor search within `server/` or `client/` before whole-repo sweeps.
- **MCP** (when available in Claude Code / Cursor): **cursor-ide-browser** for web UI verification; **user-ai-agent-committee** if enabled — always read tool schemas before calling.

## Do / don’t (project-specific)

- **Do** keep API and static generation logic in `server/`; UI in `client/src/`.
- **Do** use `process.env` for configuration; rely on `.env` locally (never commit secrets).
- **Do** run `npm run lint` from `client/` after changing JSX/JS once **`client/` has an ESLint config**; until then use editor checks and `npm run build` (see `README.md` — Testing / quality).
- **Don’t** commit `.env`, API keys, or machine-specific absolute paths in project config meant for everyone.
- **Don’t** add secrets to prompts, logs, or generated MCP UI payloads.

## Skills

Playbooks live under **`.claude/skills/`** (see **`.claude/README.md`**). Use them for procedure; keep long reference material in `docs/` and here.
