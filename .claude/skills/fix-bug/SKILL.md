---
name: fix-bug
description: Reproduce a failure, fix minimally, and prevent regression per project policy.
---

# Fix bug

Aligns with **`docs/AI_WORKFLOW.md`** (test definition, implement, validate).

## Steps

1. **Reproduce** — Minimal steps; note server vs client. Capture error messages without pasting secrets.
2. **Locate** — Scoped search in **`server/`** or **`client/`**; trace from route or component.
3. **Fix** — Smallest change that resolves the root cause; avoid unrelated refactors.
4. **Verify** — Re-run the failing path; run **`npm run lint`** in **`client/`** if JSX/JS changed.
5. **Regression** — Add a checklist item, lint rule, or future test note in PR description.

## Checklist

- [ ] Fix addresses cause, not only symptoms.
- [ ] No new secret handling or logging of sensitive data.
