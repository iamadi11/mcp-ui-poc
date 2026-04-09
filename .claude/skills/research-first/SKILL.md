---
name: research-first
description: Validate feasibility, constraints, and alternatives before writing implementation code.
---

# Research first

Aligns with **Research** in **`docs/AI_WORKFLOW.md`**.

## Steps

1. State the goal and acceptance criteria in one short paragraph.
2. Find existing patterns in **`server/`** or **`client/`** for similar behavior (scoped search).
3. Check **`README.md`** for APIs, ports, and scripts that affect the approach.
4. List risks (security, breaking API, UX); confirm secrets stay in env only.
5. Decide “build vs extend” and record alternatives considered.

## Checklist

- [ ] Feasibility confirmed against current stack (Node, Express, React, Vite).
- [ ] Alternatives noted; no secrets in notes or code plans.
