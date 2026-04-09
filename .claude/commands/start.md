# /start

**Autonomous end-to-end cycle**: discover and choose one feature → research → plan → implement → QA (automated + **MCP browser** manual testing) → **brutal user** critique → commit → deploy.

Always follow **`docs/AI_WORKFLOW.md`** (Research → Plan → Test definition → Implement → Tests & checks → Validate → Document → Instrument). Do not skip steps without a one-line rationale.

---

## Phase A — Auto-collect and pick a feature

Run this **before** writing implementation code.

1. **Orient** — Read **`README.md`**, **`CLAUDE.md`**, and **`docs/AI_WORKFLOW.md`**.
2. **Harvest candidates** (scoped search in `server/` and `client/` first):
   - `TODO`, `FIXME`, `HACK`, `XXX` comments
   - Obvious gaps: missing validation, error states, accessibility, inconsistent UX, undocumented API behavior
   - **`explore-codebase`** skill if the repo layout is unclear
3. **Optional external signals** (only if available in-session): issue trackers, product notes, team MCP — never invent tickets.
4. **Choose exactly one** item to ship in this run:
   - Prefer **small, high-impact** scope with clear acceptance criteria
   - Reject vague multi-week epics; narrow until one vertical slice is feasible now
5. **Record** in your working notes: chosen feature, why it wins over alternatives, and **definition of done** (observable behavior).

---

## Phase B — Research, plan, test definition

1. **`research-first`** (`.claude/skills/research-first/SKILL.md`) — feasibility, constraints, alternatives, security (no secrets in code or logs).
2. **`plan-task`** (`.claude/skills/plan-task/SKILL.md`) — atomic tasks, files/modules touched, API/UX impact.
3. State **how you will prove** correctness: `client/` lint, `npm run build`, and **manual browser steps** for any UI change.

---

## Phase C — Implement

Follow **`implement-feature`** (`.claude/skills/implement-feature/SKILL.md`): focused changes, `server/` vs `client/` boundaries, `npm run lint` in `client/` after JSX/JS changes.

---

## Phase D — QA (automated + MCP browser)

1. **`validate-release`** (`.claude/skills/validate-release/SKILL.md`) — lint, build, smoke per project scripts.
2. **MCP manual testing (required for UI-affecting work)** — use **cursor-ide-browser**:
   - **Read tool schemas** in the MCP descriptors folder before calling tools
   - Start dev servers per **`README.md`** (e.g. backend and client ports)
   - **`browser_navigate`** to the app URL → **`browser_lock`** (lock) before interactions
   - **`browser_snapshot`** before every structural interaction; use refs from the snapshot
   - Exercise the **changed flows** and one **regression path** (e.g. main navigation)
   - **`browser_unlock`** when finished
   - If blocked (login, captcha, missing data), report the blocker and what was still verified

---

## Phase E — Brutal user feedback (honest review)

After QA, adopt a **hostile-but-fair end-user** persona (not personal abuse). Output structured feedback:

- **What would make you abandon this in 10 seconds?** (copy, confusion, bugs, slowness)
- **Edge cases**: empty states, errors, slow network, invalid input, mobile width
- **Accessibility**: focus, contrast, keyboard paths (call out failures bluntly)
- **Verdict**: ship / fix-first / block — with reasons

If verdict is **fix-first** for issues in scope, implement minimal fixes and re-run Phase D for affected paths before commit.

---

## Phase F — Commit

1. **`review-changes`** (`.claude/skills/review-changes/SKILL.md`) — quick sanity pass
2. Single logical commit with a clear message; **no** secrets, `.env`, or credentials in the diff

---

## Phase G — Deploy

1. Confirm **`npm run build`** succeeds at repo root (or per project convention).
2. Deploy using **this project’s** hosting workflow (not assumed):
   - If **Vercel** (or similar) is linked: use the platform CLI or dashboard as configured locally; **`npx vercel`** can substitute if the global CLI is absent
   - If **no deploy target** is configured: stop after commit, list exact steps a human would run (env vars, branch, promote) — do not fabricate deployment success

---

## Abort conditions

Stop and report clearly if: no safe feature can be chosen, secrets would be required in-repo, deploy credentials are missing, or browser MCP is unavailable for mandatory UI validation — state what was completed and what remains.
