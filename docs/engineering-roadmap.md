# Engineering roadmap

Evidence-backed product/engineering backlog for Company OS discovery.
Agents and `npm run company` **must not invent** Selected rows. Only promote what is listed here with doc or issue evidence.

IDs use `EE-###` (engineering) or `LA-###` (local/on-device adapter). Discovery parses the tables below.

## Selected / must implement

High-confidence work the company should ship. Discovery emits these as engineering items with confidence ≥ 0.8.

| ID | Type | Title | Evidence | Acceptance |
|----|------|-------|----------|------------|

## Shipped

| ID | Type | Title | Evidence | Shipped |
|----|------|-------|----------|---------|
| EE-004 | feature | Laya DecisionAdapter (HTTP sidecar + optional ONNX) | `docs/research/oss-decision-llm.md`; ADR-007; `packages/core/src/decisions/laya.js`; `services/laya-sidecar` | 2026-09-22 |
| EE-005 | feature | OpenAI-compatible OSS LLM path (`OPENAI_BASE_URL`) | ADR-007; `packages/core/src/llm/openai.js`; `.env.example` | 2026-09-22 |
| EE-001 | fix | Fence LLM prompts treating fetched endpoint data as UNTRUSTED (#5 residual) | `packages/core/src/untrusted-data.js`; wired in `planner.js` / `generate-ui.js`; tests in `untrusted-data.test.js` | 2026-09-21 |

## Deferred

Low-confidence review only. Triage may defer. Do **not** promote to READY without new evidence or an ADR.

| ID | Type | Title | Evidence | Why deferred |
|----|------|-------|----------|--------------|
| LA-001 | feature | Wire on-device LocalAdapter (ONNX/WASM) from training export | `docs/training-export.md`; `packages/core/src/decisions/local.js` throws `LOCAL_ADAPTER_UNAVAILABLE` | Explicitly future; needs model artifact + ADR before Selected |
| EE-003 | fix | Close stale open GitHub issues already fixed on main | Open issues #3–#11 vs completed company tasks | Process/hygiene; `gh` write often unavailable on Cloud Agent hosts |

## Locked product decisions

Do not flip without a new ADR:

- DecisionAdapter decides; ThemeAdapter constructs (`docs/adr/002-jev-routing.md`, `docs/adr/007-oss-decision-llm.md`, `docs/adr/005-surfaces.md`) — Laya preferred when configured; Jev remains optional BYOK
- No fingerprint replay on Studio hot path (`CONTEXT.md`)
- Design packs, not user-uploaded JS (`docs/adr/006-design-packs.md`)
- Secrets only via env / BYOK headers — never in prompts or commits

## How Company OS uses this file

1. `discoverEngineeringRoadmap` parses **Selected** → `roadmap:EE-###` candidates (confidence ≥ 0.8).
2. **Deferred** → separate low-confidence review candidates (may be deferred/rejected).
3. Cursor `/autonomous-company` implements READY / BLOCKED-for-Cursor Selected items — not invented side quests.
4. After shipping a Selected row, move it to a **Shipped** section (or remove it) and record evidence in company memory.
