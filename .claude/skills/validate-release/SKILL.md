---
name: validate-release
description: Run lint, build, and manual checks before merge or release.
---

# Validate release

Commands and policy: **`docs/AI_WORKFLOW.md`**, **`README.md`**.

## Steps

1. **Install** — `npm install` at root; `npm run install-all` if `client/` deps may be stale.
2. **Client lint** — `cd client && npm run lint`
3. **Client build** — `npm run build` from root (or `cd client && npm run build`) for production sanity.
4. **Server** — Start with `npm run dev`; hit **`/api/health`** and any changed routes.
5. **UI** — `npm run client` in another terminal; verify main flows (see **`README.md`**).
6. Optional: MCP/browser smoke using **cursor-ide-browser** if UI changed.

## Checklist

- [ ] Lint and build succeed.
- [ ] Manual smoke of changed areas completed.
- [ ] No secrets in build artifacts or config.
