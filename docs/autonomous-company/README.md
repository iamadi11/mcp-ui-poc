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

Selected product/engineering work comes from **`docs/engineering-roadmap.md`**. If the company idles while Selected rows remain, use **`.cursor/skills/autonomous-company-product-gap/`**.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — OS design  
- [AUDIT.md](./AUDIT.md) — validation and limitations  
- [../engineering-roadmap.md](../engineering-roadmap.md) — Selected / Deferred backlog  

## Tests

```bash
npm run company:test
```
