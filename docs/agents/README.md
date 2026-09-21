# Agent knowledge

After clone, a human runs **`npm run skills:install`**, then once in chat **`/setup-matt-pocock-skills`**.

## Routing

| Work | Do this |
|------|---------|
| Non-trivial feature, refactor, or design choice | `/ask-matt` then `docs/AI_WORKFLOW.md` |
| Long-running autonomous SDLC / company loop | `/autonomous-company` (skill + `npm run company`) — see `docs/autonomous-company/` |
| UI / visual | `design-system/MCP-UI/MASTER.md` + UI UX Pro Max `SKILL.md` |
| Staff the studio / make product better / AI runtime·URL UI / spin up Dev+QA+AI | Project `studio-staff` (audit + PM/EM first; do **not** jump to coding) |
| Implementation | Project `implement-feature` + Matt `implement` / `tdd` (do **not** run two TDD skills) |
| Bugs | Project `debug-issue` or Matt `diagnosing-bugs` |

Project skills under `.claude/skills/` stay. Matt `tdd` and `code-review` replace duplicate playbooks.

Read `CONTEXT.md` for product glossary. ADRs live in `docs/adr/`.
