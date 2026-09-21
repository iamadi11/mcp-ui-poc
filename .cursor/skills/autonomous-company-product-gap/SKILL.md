---
name: autonomous-company-product-gap
description: >-
  Diagnose and remediate Autonomous Company idle when Selected roadmap
  engineering work exists but discovery only surfaces ops/docs/speculative
  items. Use when /autonomous-company reports IDLE / ONLY_SPECULATIVE_OR_DEFERRED
  with Ready: 0 while docs/engineering-roadmap.md still has Selected rows.
---

# Autonomous Company — product gap

When the company idles with **no engineering READY** work while the engineering roadmap still has **Selected / must implement** rows, the gap is in **discovery → triage**, not “nothing left to build.”

Do **not** invent customers, metrics, or side-quest features to stay busy.

## Diagnose

1. Run `npm run company -- status` (or `start`).
2. Note `stopReason`: `NO_ACTIONABLE_HIGH_VALUE_TASK` or `ONLY_SPECULATIVE_OR_DEFERRED`.
3. Open **`docs/engineering-roadmap.md`**.
4. Check whether **Selected / must implement** still lists unimplemented `EE-###` (or similar) IDs.
5. Inspect the work pool: are candidates only cadence/test-gap/deferred/docs?

| Symptom | Likely cause |
|---------|----------------|
| Idle + Selected rows remain | Roadmap discovery off, parse failed, or Selected rows rejected as low score |
| Only Deferred / hypothesis items | Correct idle **after** product-gap check; do not promote Deferred without new evidence |
| READY `department=engineering` / `roadmap:EE-*` present | Not a product gap — execute as Cursor LLM engineering work |
| BLOCKED “Requires Cursor agent…” | Expected host honesty — Cursor worker must implement |

## Remediation checklist

1. Confirm Selected table rows in `docs/engineering-roadmap.md` (evidence column required).
2. Ensure config `discovery.scanEngineeringRoadmap: true` (default).
3. `npm run company -- start --fresh` or `tick` so discovery re-runs.
4. Expect pool entries `problemKey: roadmap:EE-###` with confidence ≥ 0.8 → **READY** or **BLOCKED-for-Cursor**.
5. As Cursor `/autonomous-company` worker: claim/implement Selected engineering items (Matt `implement` / project `implement-feature` / one TDD skill).
6. `complete` with real validation → `tick` → repeat until Selected empty or honestly idle.

## Anti-slop

- No invented customers, revenue, or engagement metrics.
- Do **not** promote **Deferred** rows to READY without new verified evidence or an ADR.
- Do **not** flip locked product decisions in the roadmap without a new ADR.
- Do **not** mark Selected feature/fix complete via fake compile on hosts without the toolchain — leave **BLOCKED** for Cursor.

## Related

- Main skill: `.claude/skills/autonomous-company/SKILL.md`
- Parser: `packages/autonomous-company/src/discovery/roadmap.js`
- Architecture: `docs/autonomous-company/ARCHITECTURE.md`
- Detail: `reference.md`
