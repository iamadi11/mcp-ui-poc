---
name: refactor-safely
description: Refactor with clear impact analysis and without changing external behavior unintentionally.
---

# Refactor safely

Boundaries: **`docs/AI_WORKFLOW.md`** → Architecture boundaries.

## Steps

1. Document **current behavior** (APIs, UI contracts) that must stay the same.
2. Map **callers** and **imports**; avoid new circular dependencies in **`server/`**.
3. Refactor in **small commits or steps**; run **`npm run lint`** in **`client/`** after client edits.
4. Validate manually: same API responses and UI flows as before refactor.
5. Update comments or **`README.md`** only if structure or public API changed.

## Checklist

- [ ] No behavior change unless explicitly in scope.
- [ ] Server/client separation preserved.
