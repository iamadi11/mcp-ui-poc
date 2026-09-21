# Studio staff — briefs and checklists

Read this after `SKILL.md`. Do not duplicate `CONTEXT.md` or `docs/AI_WORKFLOW.md`.

## File ownership (avoid collisions)

**AI Engineer:** `packages/core/src/planner.js`, `jev/planner.js`, `generate-ui.js`, `chat-context.js`, `surface.js`, `iterate.js`, `demo-payload.js`, `index.js` (exports only), matching tests (`planner`, `chat-context`, `generate-ui`, `iterate`, `surface`).

**Dev:** `client/src/studio/*`, `client/src/App.jsx` if health/Settings require it, `server/plan-turn.js`, `server/chat.js`, `server/index.js` (health flags only), `README.md` (docs vs `CONTEXT.md`).

**QA:** `packages/core/test/acceptance-p0.test.js` (create/extend; do not fight AI Engineer on `planner.test.js`), `docs/MANUAL_QA.md`.

**EM on integrate:** merge, `packages/core/README.md` if still drifted, reject new catalog `componentTypes`.

## Subagent briefs (pass almost verbatim)

Prefix each brief with repo path `/Users/adityaraj/Desktop/My Projects/mcp-ui-poc` (or the current workspace), hard constraints from `SKILL.md`, “do not commit”, and a **current-state delta** (already green vs still broken). Then paste the role block.

### AI Engineer

You own `packages/core` planner, Jev, `generate-ui.js`, `chat-context.js`, iterate vs create, catalogCannotExpress. Goal: Haiku + Jev generate any UI from prompt + follow-ups with session memory. Add failing tests first (Snitch checkout → “graffiti is not visible” still Snitch, not Graffiti Wall; create+animation is not iterate). Do not add catalog widgets. Run `npm test` from repo (workspace ui-compose-kit). Return: files changed, tests, remaining model-quality risks.

### Dev

You own `client/src/studio/*`, `server/plan-turn.js`, `server/chat.js`, Settings, SSE thoughts, canvas. Goal: the studio feels like an agent — thinking in the rail, keys from env, every Send plans live (`fresh: true`), history attached to `/api/chat/turn`. Read MASTER.md before JSX. Lint from `client/`. Verify in browser. Return: files changed, what you verified, what you could not.

### QA

You are hostile QA. Reproduce: (a) new session Snitch checkout + graffiti on load; (b) follow-up “graffiti is not visible”; (c) “Create a game of tic tac toe with heavy animation”; (d) send the same create prompt twice — must not return cached Stride; (e) Settings with empty fields but env keys present. Write/extend Vitest in `packages/core/test` and update `docs/MANUAL_QA.md`. Browser-verify. File bugs as a punch list with severity. Do not “fix” by weakening tests.

## P0 examples (re-discover; do not assume fixed)

Treat as P0 unless something more broken exists:

1. **Agent memory** — follow-ups must not drift (checkout → graffiti wall). Session goal + user history drive Jev and Haiku every turn. Visible thinking in chat, not only `?debug=1`.
2. **Truly dynamic generate** — no Redis fingerprint replay of the last widget. Create prompts must not iterate leftover session widgets. Snitch graffiti checkout must not become Stride shoes.
3. **Catalog vs generate** — catalog is for live JSON dashboards and Maps. Branded / custom-look / games / “asking again” go through Haiku `html-block`. Do not grow the primitive list.
4. **Keys / empty states** — never show “Add a TypeSafe / Anthropic key” when `.env.local` already has them. Surface real Haiku errors.
5. **Motion / look** — graffiti / animation on widget load must be visible in generated CSS/script, not an unused token.
6. **Studio quality** — leftover brand/login on checkout, cramped line items, Recents overlay, canvas paint, iterate chips that match generated UIs.
7. **Docs drift** — keep `README.md` / core README aligned with `CONTEXT.md` (replay off; Haiku copy slots **or** HTML generate).

## Integration checklist

- [ ] No new catalog primitives / React codegen
- [ ] `npm test` from repo (ui-compose-kit)
- [ ] `npm run lint` from `client/` if studio changed
- [ ] Browser: new chat → Snitch; follow-up graffiti; new chat → tic-tac-toe (click a cell); Settings empty + env keys; same create twice is live
- [ ] Iframe is often sandboxed — click cells / inspect motion visually; do not declare playable from a host snapshot alone
- [ ] Honest remaining risk: Haiku is mocked in unit tests; live look/motion/playability is model-quality

## Report template

```markdown
## PM brief
Problem / users / success / non-goals

## EM plan
What AI Engineer, Dev, QA did

## Landed
Files + user-visible behavior

## Still weak
Honest, severity-tagged

## Manual QA
Numbered steps on http://localhost:3000 (API :3001)
```
