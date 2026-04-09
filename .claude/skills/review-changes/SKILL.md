---
name: review-changes
description: Pre-merge review for correctness, boundaries, security, and release risk.
---

# Review changes

Cross-check with **`docs/AI_WORKFLOW.md`** (security, architecture, testing).

## Steps

1. **Scope** — Diff matches stated goal; no unrelated files.
2. **Boundaries** — **`server/`** vs **`client/`**; no cross-leakage of concerns.
3. **Secrets** — No `.env`, keys, or tokens in source or logs.
4. **Quality** — Client: **`npm run lint`** clean for touched files; server: sensible error handling.
5. **Docs** — **`README.md`** updated if APIs or setup changed.
6. **Risk** — Note breaking changes and rollback for reviewers.

## Checklist

- [ ] Testing/validation steps from the author are credible.
- [ ] MCP/browser flows still work if MCP UI paths changed.
