# Studio staff — concepts, audit, briefs, gates

Read after `SKILL.md`. Do not duplicate `CONTEXT.md` / `docs/AI_WORKFLOW.md`.

## Apply AI engineering (decisions, not buzzwords)

### Agent architecture

Judge: agent vs workflow · planning · tools · structured outputs · state machines · routing · decomposition · loops · reflection · validation · retries · HITL · deterministic vs probabilistic · single vs multi-agent.

Add agents only when work is independent and valuable—not for theater.

### Context engineering

Distinguish: original request · current change · current UI contents · prior AI decisions · what user wants preserved · what to replace. Prefer relevant context over blind history append. Consider compression, isolation, conflicts, artifact versions.

### Structured generation

Prefer validated plans/schemas, declarative UI defs, patches, manifests, contracts over raw prose driving runtime. Never let unvalidated model output control privileged execution.

### Tools / execution

Permissions · I/O validation · failures · idempotency · retries · timeouts · side effects · tracing · confirm consequential actions. Separate intent interpretation from privileged execution.

### Evaluation-driven development

Measure: task success · intent adherence · artifact correctness · visual/interaction quality · follow-up consistency · security · reliability · latency · cost · regressions. Realistic scenarios > one pretty demo.

### Observability

Safe progress: planning · tools · generation · validation · errors · latency · retries · session transitions. No fabricated progress. No hidden CoT / secrets in chat.

### Reliability

Model/tool/network failures · invalid structured output · partial gen · state corruption · conflicting follow-ups · duplicates · timeouts · recovery that preserves user work.

## UI as runtime (investigate before building)

Artifact may describe: structure · components · layout · theme · content · state · events · actions · data · navigation · validation · permissions · responsive · a11y · capabilities · version · deps.

Distinguish: declarative properties · supported interactions · controlled actions · data requests · external integrations · unsafe/unsupported executable behavior.

Choose declarative artifact, controlled runtime, or hybrid from requirements—not schema-first speculation.

## URL-driven UI (investigate)

URL may identify: artifact · version · runtime config · data view · theme · widget instance · route · action target · host endpoint.

Config via: path · query · fragment · remote config · schema · API · signed config · host props · runtime messages—not “everything in query.”

Probe: click handlers · event routing · action validation · navigation · data load · state · dynamic styles · host↔widget messaging · permissions · malicious config · unsupported behavior.

Existing baseline: `/e/:publicId`, pin `?v=`, owner `/w/:publicId`. Extend with evidence.

## Portability

Trade off: hosted URL · iframe · script loader · Web Components · portable schema · adapters · framework packages. Do not claim all-framework compatibility without proof. Vertical slice: create → preview → iterate → publish → integrate URL → customize → update without surprise breaks—pick one meaningful slice per cycle.

## Generic generation (no catalog sprawl)

Support many experience types via reusable capabilities + declarative composition + controlled runtime—not a new primitive per prompt. Distinguish supported vs unsupported/unsafe vs needs external data. Do not shove every ask into a rigid catalog if a better generic path exists; do not assume unbounded flexibility is safe.

## Audit checklist (Phase 2)

| Area | Probe |
|------|--------|
| UX | Intent, polish, canvas coherence, interactivity, empty/error/retry, unified studio |
| Iteration | Identity preserved, create vs iterate, multi-turn, no unrelated spawn |
| Jev | Create/iterate, strategy, catalog awareness, observability |
| Haiku / generation | Intent fit, brand, interaction, a11y, sanitize, ThemeAdapter, follow-ups |
| Runtime / URL | Artifact portability, config surface, security boundaries |
| Session | Goal/history/artifact state; patch vs full regen tradeoff |
| Engineering | Modularity, security, perf, tests, DX |
| **This skill** | Task selection quality, agent coordination, eval honesty, dependency handling |

## Impact scorecard

For each candidate: User value / Vision leverage / Deferred risk / Break evidence / Effort (1–5). Pick highest verifiable. Reject cosmetic / already-green demo polish unless regression found.

## File ownership

**AI Engineer:** `packages/core` planner, Jev, `generate-ui.js`, `chat-context.js`, `surface.js`, `iterate.js`, `demo-payload.js`, structured outputs, prompts, sanitize, tests. No catalog widgets.

**Dev:** `client/src/studio/*`, MASTER.md before JSX, `server/plan-turn.js`, `server/chat.js`, embed/publish surfaces, host integration. No core planner rewrite unless EM assigns.

**QA:** `acceptance-p0.test.js` (+ journey tests), `docs/MANUAL_QA.md`, browser. No product code except tests. Don’t weaken assertions.

**Architecture/Security Reviewer** (when runtime/URL/actions change): threat model, sanitize, privilege boundaries, no secret-in-URL, no arbitrary JS exec. Review-only unless EM assigns tiny hardening.

**EM:** merge, reject catalog/React-primary/unsafe exec, lint + `npm test` + browser proof, then **two-axis review** (below).

## Two-axis integration review

After agents land a non-trivial diff, EM runs a **Standards** axis and a **Spec** axis as **parallel Task sub-agents** (same pattern as project `code-review`). Keep axes separate—Standards pass must not hide Spec fail and vice versa.

### Pin the fixed point

Diff since cycle start: `git diff <fixed-point>...HEAD` (three-dot) and `git log <fixed-point>..HEAD --oneline`. Default fixed point = commit/SHA before this cycle’s edits, or `main` if branching. Confirm ref resolves and diff non-empty.

### Spec source (this cycle)

1. The **PM brief + success criteria + definition of done** from Phases 3–4 (primary).
2. Else issue refs in commits (`docs/agents/issue-tracker.md`).
3. Else user-provided path under `docs/` / `specs/` / `.scratch/`.
4. If none: Spec agent reports `no spec available` and skips findings.

### Standards sources

- `docs/AI_WORKFLOW.md`, `CONTEXT.md`, `CLAUDE.md`, `design-system/MCP-UI/MASTER.md`, ADRs `002`/`005`, this skill’s non-negotiables.
- **Smell baseline** (judgement calls; repo docs override; skip tooling-enforced): Mysterious Name · Duplicated Code · Feature Envy · Data Clumps · Primitive Obsession · Repeated Switches · Shotgun Surgery · Divergent Change · Speculative Generality · Message Chains · Middle Man · Refused Bequest.

Also hard-flag: new catalog primitives · React-as-primary artifact · secrets in client/URL · unvalidated model→privileged exec · fingerprint replay reintroduced on Studio path.

### Parallel prompts (under 400 words each return)

**Standards agent:** full diff cmd + commit list + standards list + smell baseline. Report (a) documented-standard breaches with cite; (b) smell hits with hunk quote. Distinguish hard vs judgement. Skip tooling noise.

**Spec agent:** full diff cmd + commit list + PM brief/DoD text. Report (a) missing/partial requirements; (b) scope creep; (c) implemented-but-wrong. Quote brief line per finding.

### Aggregate

Present `## Standards` and `## Spec` side by side. Do **not** rerank across axes. One-line summary: count per axis + worst issue within each. Fix hard Spec/Standards failures before declaring the cycle done; judgement smells = EM call.

## Delta template

```markdown
## Already green (do not regress)
## Still broken / highest-value next (this cycle)
## Skill weakness (if any) this cycle fixes
```

## Agent briefs (almost verbatim)

Prefix: workspace path, constraints, delta, do not commit, no secrets.

### Dev

Implement assigned slice. Follow architecture. Avoid rewrites. Preserve behavior. Tests. Modular. MASTER.md before JSX. Lint `client/`. Browser or Playwright if MCP flaky. Return files, verified, gaps.

### QA

Hostile journeys. Design tests for PM success criteria. Regression risks. Browser interaction (not HTTP 200). Punch list severity. Don’t weaken tests. Return pass/fail + evidence, MANUAL_QA steps.

### AI Engineer

Jev + Haiku/context/structured outputs. Session preservation. HTML/runtime safety. Realistic prompts. Failing tests first. `npm test` (ui-compose-kit). Objective: useful product-specific UI, not “model returned 200.” Return files, tests, model-quality risks.

### Architecture/Security Reviewer

Review runtime/URL/action/sanitize diffs. Flag unrestricted exec, secret leakage, missing validation. Approve or block merge criteria.

## Mandatory benchmarks (when relevant)

1. **Snitch graffiti checkout** — brand-specific, intentional, not Stride; follow-up customizable.
2. **Multi-turn continuity** — same artifact; cumulative edits; identity preserved.
3. **Playable tic-tac-toe** — browser clicks; win/draw/reset.
4. **Interactive dashboard** — filters/data model meaningful; no fake production APIs.
5. **URL-driven integration** — load via intended URL; behavior + security evidenced; no universal-compat claims.
6. **Env configuration** — `.env.local`; no chat paste; useful missing-key errors.
7. **Progress visibility** — real status; no fabricated CoT; clear errors/done.

## Quality gates (evidence required)

- [ ] Meaningful problem + clear rationale
- [ ] Architecture inspected; AI concepts applied where relevant
- [ ] Agent/context/generation/runtime/URL/security evaluated as needed
- [ ] No catalog primitives; no unjustified complexity
- [ ] Journeys tested; unit/integration/browser/lint as applicable
- [ ] Two-axis Standards + Spec review run on cycle diff; hard fails fixed
- [ ] Failures + remaining weaknesses documented
- [ ] Skill instructions improved if task-selection was the bottleneck

Passing build ≠ product quality. Render ≠ function. Valid model JSON ≠ correct AI behavior. URL loads ≠ integration architecture. Standards pass ≠ Spec pass.

## Report template

```markdown
## Product audit
## Existing skill weaknesses
## PM brief
## Selected improvement
## EM plan / architecture decisions
## AI engineering concepts applied
## Agents / files / tests / browser
## Standards axis (verbatim or lightly cleaned)
## Spec axis (verbatim or lightly cleaned)
## AI / session / runtime / security assessment
## Remains weak / next / intentionally skipped
```

## Anti-patterns

Easy tasks · random features · LOC theater · fake multi-agent · blind HTML forever · blind HTML delete · universal runtime speculation · secrets in URLs · unvalidated model exec · weaken tests · invent file paths · unsolicited commit · claim all-framework support without proof
