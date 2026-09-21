# Autonomous Company

A durable **Company Operating System** for this repository: work pool, workers, clock, follow-ups, idle honesty.

## Single command

```text
/autonomous-company
```

```bash
npm run company -- start
npm run company -- status
npm run company -- tick
```

Completing a task does **not** stop the company — always `tick` again until idle/stopped.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — OS design  
- [AUDIT.md](./AUDIT.md) — validation and limitations  

## Tests

```bash
npm run company:test
```
