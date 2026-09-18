# ADR-002: Jev decides, code constructs, Haiku is rare

## Status

Accepted

## Context

Jev (TypeSafe System One) returns typed Choice/Score/Noul — not HTML or spec JSON. LLMs are slow and expensive when used as the default planner. TypeSafe docs: decompose atomic questions, combine in code, use confidence as a second axis.

## Decision

`DecisionAdapter` seam with one Jev **fan-out** per turn. Code combines answers into a `LayoutPolicy` and hydrates via `applyPolicy`.

Cascade: Redis fingerprint replay → Mongo neighbor (thumbs-up) → Jev + applyPolicy if confidence high and in-catalog → Haiku structured spec if `needs_llm` or low confidence → heuristic.

Never send full JSON to Claude — `inferShape` + prompt excerpt only.

Motion is a **token** (`none` | `enter` | `stagger` | `live`) implemented in CSS. Claude writes keyframes only if the token set cannot express the ask.

## Consequences

- Adding catalog questions barely changes Jev latency (parallel evaluation).
- A future `LocalAdapter` (ONNX/WASM) implements the same `{ state, questions }` contract.
- Cost log fields (`planner`, `latencyMs`, `jevConfidence`) go to Mongo turns — never API keys.
