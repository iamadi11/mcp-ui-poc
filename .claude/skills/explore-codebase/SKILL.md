---
name: explore-codebase
description: Map repository structure, entry points, and dependencies before editing code.
---

# Explore codebase

Use before medium or large changes. Full policy: **`docs/AI_WORKFLOW.md`** (code exploration).

## Steps

1. Read **`README.md`**, **`docs/AI_WORKFLOW.md`**, and **`CLAUDE.md`** for stack and boundaries.
2. Identify entry points: **`server/index.js`**, **`client/src/main.jsx`**, **`client/src/App.jsx`**.
3. List modules that will be touched; note **`server/`** vs **`client/`** split.
4. Search **within** `server/` or `client/` first (scoped `rg` or editor search); avoid whole-repo grep until needed.
5. If using MCP (e.g. **cursor-ide-browser**), read tool schemas, then use structured navigation — not blind full-tree scans.

## Checklist

- [ ] Entry points and data flow for the feature are understood.
- [ ] No plan to violate architecture boundaries in **`docs/AI_WORKFLOW.md`**.
