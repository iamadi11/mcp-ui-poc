---
name: debug-issue
description: Systematically investigate unexpected behavior using evidence and scoped exploration.
---

# Debug issue

Exploration order: **`docs/AI_WORKFLOW.md`** (code exploration policy).

## Steps

1. State **expected vs actual**; list reproduction steps.
2. Check **configuration** — `.env` locally (not committed); **`README.md`** for ports and scripts.
3. **Scope** — Decide if bug is server (API, MCP paths) or client (React); search only that tree first.
4. Add **temporary** logging if needed — no PII or secrets; remove or reduce before finish.
5. If UI verification needs a browser, use **cursor-ide-browser** (or equivalent): snapshot before interactions.

## Checklist

- [ ] Hypothesis updated with each new fact; no whole-repo grep before scoped search.
- [ ] Logs do not contain secrets.
