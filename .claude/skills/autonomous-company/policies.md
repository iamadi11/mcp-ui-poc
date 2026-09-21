# Policies

## Execution budgets (defaults)

See `packages/autonomous-company/defaults/config.json`.

Override locally with `.autonomous-company/config.json` or committed `autonomous-company.config.json` at repo root.

## High-impact actions (default deny)

- deploy
- force_push
- secret_mutation
- production_infra_change
- gate_weakening
- major_dependency_bump
- irreversible_data_migration

Agents must not edit safety config to self-authorize.

## Validation honesty

- Skipped checks are not passes.
- `claimedPass` requires `status: "passed"` and recorded `exitCode: 0`.
- UI product changes: browser or MANUAL_QA evidence when tooling available; otherwise mark validation incomplete.

## Task deduplication

Task ids = fingerprint(`category` + `problemKey`). Do not recreate completed/queued/active tasks.

## Branch / migration conflicts

Do not open parallel company tasks that claim the same files (`npm run company -- conflicts`).  
Do not duplicate migrations or branches for the same problemKey.

## Autonomy limits (disclose)

This host may lack deploy credentials, production access, or MCP browser. Report limits; do not fabricate success.
