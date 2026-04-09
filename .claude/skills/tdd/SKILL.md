---
name: tdd
description: Write or extend tests before or alongside implementation per project testing policy.
---

# TDD (test-driven)

Testing policy: **`docs/AI_WORKFLOW.md`** → Testing expectations.

## Steps

1. Confirm whether automated tests exist for the area (this repo: client **ESLint**; no root test runner yet).
2. If adding a test framework: add dependency, script, and one minimal test in the same effort — then implement to green.
3. Until automated tests exist: maintain a **manual test checklist** (steps + expected result) before merging behavior changes.
4. After implementation, re-run **lint** (`client/`) and manual validation.

## Checklist

- [ ] Failing case or checklist exists before “done.”
- [ ] No secrets in test fixtures or logs.
