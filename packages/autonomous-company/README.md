# autonomous-company

Company Operating System: durable work pool, worker roster, company clock.

## CLI

```bash
npm run company -- start          # boot clock; continues after completions
npm run company -- tick           # one OS tick
npm run company -- status         # dashboard
npm run company -- complete <id> --report <file>
npm run company -- stop
```

Legacy: `cycle`, `phase` (single-task debug).

See `docs/autonomous-company/ARCHITECTURE.md` and `.claude/skills/autonomous-company/`.
