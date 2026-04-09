# /start

**Autonomous end-to-end cycle**: discover and choose one feature → research → plan → implement → QA (automated + **MCP browser** manual testing) → **brutal user** critique → commit → deploy.

Always follow **`docs/AI_WORKFLOW.md`** (Research → Plan → Test definition → Implement → Tests & checks → Validate → Document → Instrument). Do not skip steps without a one-line rationale.

### Source of truth

- **The codebase is the source of truth** for behavior, APIs, patterns, and what is actually shipped. Read and trace real code paths before deciding what to build.
- **`README.md`** (and **`CLAUDE.md`**, **`docs/AI_WORKFLOW.md`**) supply product intent, structure overview, ports, and scripts — use them to understand **what this project is supposed to do** and how to run it.
- If README and code disagree (endpoints, flows, folder layout), **follow the code** and note the doc drift only if you fix docs in scope.

---

## Phase A — Project context, then auto-collect and pick a feature

Run this **before** writing implementation code.

### A1 — Understand the project (codebase first, README second)

1. **Codebase (mandatory)** — Establish how the app actually works:
   - Entry points: e.g. **`server/index.js`**, **`client/src/main.jsx`**, **`client/src/App.jsx`** (adjust if the repo differs).
   - Trace **`server/`** routes, MCP-related modules, and **`client/src/`** UI flow enough to describe the main user journey in plain language.
   - Use **`explore-codebase`** when layout or dependencies are unclear; prefer scoped search under `server/` and `client/` per **`docs/AI_WORKFLOW.md`**.
2. **README + project docs** — Read **`README.md`** for feature list, API summary, ports, and install/run steps; skim **`CLAUDE.md`** and **`docs/AI_WORKFLOW.md`** for workflow and boundaries.
3. **Synthesize** — In your working notes, write a short **“what this project does”** paragraph grounded in **code + README** (not generic stack guesses). This is the lens for every later step.

### A2 — Harvest candidates and choose one feature (include a PM lens)

Treat feature selection like a **product manager** who is constrained by this repo: propose what to build **for users and outcomes**, not only what the code complains about.

1. **Harvest** (still code-led): `TODO`, `FIXME`, `HACK`, `XXX` in `server/` and `client/`; gaps you observed while mapping (validation, errors, a11y, UX, undocumented behavior).
2. **Optional external signals** (only if available in-session): issue trackers, product notes, team MCP — never invent tickets.

3. **Product manager pass (mandatory before picking)** — Ground every answer in **A1** (code + README); do not invent personas or markets the product does not serve.
   - **Who uses this?** Infer the primary user and job-to-be-done from the app’s actual flows and README positioning.
   - **Problem → outcome** — For each candidate, state the **user problem** and the **measurable or demo-able outcome** (e.g. fewer steps, clearer errors, faster feedback), not just an engineering task.
   - **Why now?** — Link to product goals implied by the project (e.g. MCP UI demos, builder UX, reliability). Deprioritize pure refactors unless they unblock a user-visible outcome.
   - **Value vs effort** — Prefer **small slices** that deliver visible value; flag dependencies and cut scope with explicit **out of scope for this run**.
   - **Risks & assumptions** — One line each: what could be wrong about user need or feasibility; how you’ll validate after ship (see Phase D/E).
   - **Hypothesis (one sentence)** — *We believe [change] will help [user] achieve [outcome] because [reason tied to this codebase].*

4. **Choose exactly one** item to ship in this run:
   - Prefer **small, high-impact** scope with clear acceptance criteria that **fits existing patterns** you already saw in the codebase **and** passes the PM pass above.
   - Reject vague multi-week epics; narrow until one vertical slice is feasible now.

5. **Record**: chosen feature, **user/outcome framing**, why it wins over alternatives, **out of scope** for this run, and **definition of done** (observable user or operator behavior).

---

## Phase B — Research, plan, test definition (extends A1)

Research **builds on** the project context from Phase A1; do not “research in a vacuum.”

1. **`research-first`** (`.claude/skills/research-first/SKILL.md`) — Re-check **`README.md`** and **relevant files** under **`server/`** / **`client/`** for the chosen feature; confirm feasibility, constraints, and alternatives against **actual** imports and patterns. Security: no secrets in code or logs.
2. **`plan-task`** (`.claude/skills/plan-task/SKILL.md`) — Atomic tasks, concrete files/modules to touch, API/UX impact — aligned with how similar work is already done in this repo. Tie tasks to the **hypothesis and definition of done** from A2 (user-visible outcomes, not only internal refactors).
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
