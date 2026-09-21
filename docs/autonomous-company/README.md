# Autonomous Company

Transform this repository into a durable, evidence-driven autonomous engineering loop.

## Single command

In Cursor / Claude Code:

```text
/autonomous-company
```

CLI (same controller):

```bash
npm run company -- init
npm run company -- cycle
npm run company -- status
npm run company -- cycle --resume
npm run company -- cycle --dry-run
```

## What it is

- **Skill** (`.claude/skills/autonomous-company/`) — agent operating manual  
- **Package** (`packages/autonomous-company/`) — testable durable controller  
- **State** (`.autonomous-company/`, gitignored) — resumable run/tasks/memory  

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — research, alternatives, design  
- [AUDIT.md](./AUDIT.md) — validation and limitations  

## Tests

```bash
npm run company:test
```
