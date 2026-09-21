# Studio staff — briefs, deltas, checklists

Read this after `SKILL.md`. Do not duplicate `CONTEXT.md` or `docs/AI_WORKFLOW.md`.

## File ownership (avoid collisions)

**AI Engineer:** `packages/core/src/planner.js`, `jev/planner.js`, `generate-ui.js`, `chat-context.js`, `surface.js`, `iterate.js`, `demo-payload.js`, `index.js` (exports only), matching tests (`planner`, `chat-context`, `generate-ui`, `iterate`, `surface`). Do not edit `client/` or `server/` except when blocked and EM reassigns.

**Dev:** `client/src/studio/*`, `client/src/App.jsx` / `App.css` if health/Settings/canvas require it, `server/plan-turn.js`, `server/chat.js`, `server/index.js` (health flags only), `README.md` / `design-system/MCP-UI/pages/studio.md` (align with `CONTEXT.md`). Do not rewrite `packages/core` planner/Jev/Haiku.

**QA:** `packages/core/test/acceptance-p0.test.js` (create/extend only — do not gut or fight AI Engineer on `planner.test.js`), `docs/MANUAL_QA.md`. No product code.

**EM on integrate:** merge, reject new catalog `componentTypes`, fix `packages/core/README.md` if drifted, run checks, browser-verify.

## Current-state delta (required in every staff brief)

Before launching Task agents, probe live and fill:

```markdown
## Already green (do not regress)
- evidence: planner / types / title / HTML sniff / health flags

## Still broken (this staffing’s job)
- severity + expected vs actual + which role owns it
```

Examples of green ≠ done: `haiku:generate` + Snitch in HTML but graffiti is opacity-only → still **broken** for motion. Tic-tac-toe html-block but cell click does nothing → still **broken** for playability.

## Subagent briefs (pass almost verbatim)

Prefix with: workspace path, hard constraints from `SKILL.md`, “do not commit”, “no secrets”, and the **delta**. Then paste the role block.

### AI Engineer

You own `packages/core` planner, Jev, `generate-ui.js`, `chat-context.js`, iterate vs create, catalogCannotExpress. Goal: Haiku + Jev generate any UI from prompt + follow-ups with session memory. Add failing tests first (Snitch checkout → “graffiti is not visible” still Snitch, not Graffiti Wall; create+animation is not iterate). Do not add catalog widgets. Prefer deterministic sanitized CSS/HTML fallbacks when Haiku returns weak motion or login-only checkout — never a new catalog type. Run `npm test` from repo (workspace ui-compose-kit). Return: files changed, tests, remaining model-quality risks.

### Dev

You own `client/src/studio/*`, `server/plan-turn.js`, `server/chat.js`, Settings, SSE thoughts, canvas. Goal: the studio feels like an agent — thinking in the rail, keys from env, every Send plans live (`fresh: true`), history attached to `/api/chat/turn`. Read MASTER.md before JSX. Lint from `client/`. Verify in browser (or Playwright if MCP browser cannot hold a tab). Return: files changed, what you verified, what you could not.

### QA

You are hostile QA. Reproduce: (a) new session Snitch checkout + graffiti on load; (b) follow-up “graffiti is not visible”; (c) “Create a game of tic tac toe with heavy animation”; (d) send the same create prompt twice — must not return cached Stride; (e) Settings with empty fields but env keys present. Fail (a) if motion is fade-only. Fail (c) if a cell click does not mark the board. Write/extend Vitest in `packages/core/test/acceptance-p0.test.js` and update `docs/MANUAL_QA.md`. Browser-verify. File bugs as a punch list with severity. Do not “fix” by weakening tests.

## P0 catalog (re-discover every run)

Treat as P0 unless something more broken exists:

1. **Agent memory** — follow-ups must not drift (checkout → graffiti wall). Session goal + user history drive Jev and Haiku every turn. Visible thinking in chat, not only `?debug=1`.
2. **Truly dynamic generate** — no Redis fingerprint replay. Create prompts must not iterate leftover session widgets. Snitch must not become Stride.
3. **Catalog vs generate** — dashboards + Maps in catalog; branded / custom-look / games / asking again → Haiku `html-block`. Do not grow the primitive list. Named brand + login → generate, not anonymous catalog login.
4. **Keys / empty states** — never “Add a TypeSafe / Anthropic key” when `.env.local` has them. Surface real Haiku errors when keys exist but generate fails.
5. **Motion / look** — graffiti / animation on load must be **user-visible** (spray/stripe/paint CSS or clear first-paint motion), not an unused token or opacity-only fade.
6. **Studio quality** — no leftover login-as-checkout; short titles; Recents overlay+scrim; canvas host sizes the iframe; iterate chips match generated UIs (vivid/revise, not hide-table).
7. **Docs drift** — `README.md` / core README / studio journey stay aligned with `CONTEXT.md` (replay off; Haiku copy slots **or** HTML generate).

## Integration checklist

- [ ] Delta was live-probed this session
- [ ] No new catalog primitives / React codegen
- [ ] `npm test` from repo (ui-compose-kit)
- [ ] `npm run lint` from `client/` if studio changed
- [ ] Browser or Playwright: New chat → Snitch; follow-up graffiti; New chat → tic-tac-toe (click a cell); Settings empty + env keys; same create twice is live
- [ ] Iframe sandboxed — do not declare playable from host a11y snapshot alone
- [ ] Rejected any PR-sized drive-by outside the delta
- [ ] “Still weak” names Haiku mock vs live model-quality explicitly

## Report template

```markdown
## PM brief
Problem / users / success / non-goals

## EM plan
Delta summary; what AI Engineer, Dev, QA did

## Landed
Files + user-visible behavior

## Still weak
Severity-tagged; Haiku model quality called out

## Manual QA
Numbered steps on http://localhost:3000 (API :3001)
```

## Anti-patterns (EM reject)

- Adding a catalog `componentType` for one demo prompt
- Declaring success from unit tests alone while live canvas fails hostile quality
- Weakening `acceptance-p0` assertions to go green
- Recapping prior agent transcripts to the user
- Committing or pushing without an explicit user ask
- Pasting secrets into prompts, logs, tests, or generated HTML
