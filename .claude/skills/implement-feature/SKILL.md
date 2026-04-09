---
name: implement-feature
description: Implement a feature end-to-end following the canonical workflow through validate and document.
---

# Implement feature

Follow **`docs/AI_WORKFLOW.md`** in full: Research → Plan → Test definition → Implement → Tests → Validate → Document → Instrument.

## Steps

1. Complete **research** and **plan** (use **`research-first`** and **`plan-task`** skills if helpful).
2. Define how you will **prove** correctness (lint, manual steps, or tests if present).
3. Implement in **`server/`** and/or **`client/`** only; keep separation of concerns.
4. Run **`npm run lint`** from **`client/`** after client JS/JSX changes.
5. Run backend and frontend as in **`README.md`**; validate affected flows.
6. Update **`README.md`** if APIs, ports, or setup change.

## Checklist

- [ ] No secrets in code, logs, or generated content.
- [ ] Client lint run when `client/` changed.
- [ ] Docs updated if behavior or setup changed.
