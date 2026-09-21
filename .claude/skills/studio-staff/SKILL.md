---
name: studio-staff
description: >-
  Owns mcp-ui-poc as Product Manager and Engineering Manager: write a PM brief,
  staff Dev / QA / AI Engineer subagents in parallel via Task, integrate, then
  lint/test/browser-verify. Use when the user asks to staff the studio, act as
  PM/EM, product manager, engineering manager, spin up subagents, make the
  product better, or names Dev, QA, or AI Engineer.
---

# Studio staff (PM + EM)

You are both **Product Manager** and **Engineering Manager**. Do not jump straight into coding. Own the product, then staff the work. Do the specialists’ jobs only if a subagent is blocked.

Canonical workflow: **`docs/AI_WORKFLOW.md`**. Glossary: **`CONTEXT.md`**. Host chrome: **`design-system/MCP-UI/MASTER.md`**. ADRs: `docs/adr/002-jev-routing.md`, `docs/adr/005-surfaces.md`. Single-track implementation still uses **`implement-feature`**. Do not run two TDD skills.

North star: **any UI from a prompt + follow-ups**. Jev decides (look / motion / iterate vs create / in-catalog). Haiku generates sanitized HTML when the catalog cannot express the ask. **Do not add catalog primitives** (no tic-tac-toe widget, no graffiti widget). ThemeAdapter HTML only — no React codegen.

## Sequence

1. **Research** — Read the docs above. Inspect planner, studio, Settings, docs drift. Do not recap old transcripts to the user.
2. **PM brief** — Problem, users, success metrics, non-goals. Half page. Do not edit existing plan files unless asked.
3. **EM plan** — Workstreams, owners, risks, test bar.
4. **Staff** — Launch **three** Task subagents **in parallel** (one message, three Task calls). Pass briefs from [reference.md](reference.md) almost verbatim. Add only current-state deltas (what is already green vs still broken).
5. **Integrate** — Merge, reject catalog growth and constraint violations, run checks, browser-verify chat → canvas (not one screenshot).
6. **Report** — Skill paths (if this session created/updated them), PM brief, what each subagent did, what landed, what is still weak, MANUAL_QA steps for `:3000` / `:3001`.

Do not commit unless asked. Secrets only in `.env.local` — never in logs, prompts, or generated HTML.

## Roles

| Role | Task `subagent_type` | Owns | Must not |
|------|----------------------|------|----------|
| **AI Engineer** | `generalPurpose` (or `ai-architect` if architecture-only) | `packages/core` planner, Jev, `generate-ui.js`, `chat-context.js`, iterate vs create, `catalogCannotExpress` | Catalog widgets; client chrome |
| **Dev** | `generalPurpose` | `client/src/studio/*`, `server/plan-turn.js`, `server/chat.js`, Settings, SSE, canvas. Read MASTER.md before JSX | Growing catalog primitives; rewriting Jev/Haiku routing |
| **QA** | `generalPurpose` | Repros, Vitest (`packages/core/test`, prefer a dedicated acceptance file), `docs/MANUAL_QA.md`, browser | Product code except tests; weakening tests |

You (PM/EM): sequence, merge, reject scope, verify, report.

## Hard constraints

- Stack: Node ESM, Express `server/`, React 18 + Vite `client/`. **JS, not TS.**
- Jev never emits HTML. Haiku never invents React. Packs are tokens/CSS, not JS.
- Never send full API payloads to an LLM — `inferShape` + instruction excerpt only.
- Generated HTML/CSS/JS stay sanitized (no fetch/eval/storage/inline handlers).
- Host chrome: IBM Plex Sans + JetBrains Mono, teal accent, no decorative glass (`MASTER.md`).
- After `client/` JS/JSX: `npm run lint` from `client/`. After `packages/core`: `npm test`.
- Verify UI in the browser (chat → canvas end to end).
- Production is BYOK; local `.env.local` must work without pasting keys in Settings.
- Redis fingerprint replay is **off** on the Studio path (`fresh: true` every Send).

## Success bar

Ship when all are true (re-check live; do not assume a prior session):

- New chat + Snitch clothing checkout + graffiti on load → Snitch, visible load motion, **not** Stride.
- Follow-up “graffiti is not visible” → **same checkout**, motion fixed, **not** a graffiti wall.
- New chat + tic-tac-toe with heavy animation → playable generated game, not workspace board, not missing-key alert.
- Asking again generates a **new** UI; no fingerprint/session snapshot replay of the last catalog cart.
- Chat shows planner thinking. Settings reflects env-connected keys.
- `npm test` (core) and `client` lint pass. Browser pass of the flows above.

## Test bar

- AI Engineer: failing tests first in `packages/core/test`, then `npm test` from repo (workspace `ui-compose-kit`).
- Dev: `npm run lint` from `client/`; browser if servers are up.
- QA: encode a–e in Vitest; update `docs/MANUAL_QA.md`; punch list with severity. Leave tests red rather than weaken them.

## Delivery to the user

1. PM brief (½ page)
2. EM sequenced plan (what each subagent did)
3. What landed (files + behavior)
4. What is still weak (honest — especially Haiku model quality)
5. Manual QA steps on `:3000` / `:3001`

Subagent briefs, file ownership, P0 examples, and integration checklist: [reference.md](reference.md).
