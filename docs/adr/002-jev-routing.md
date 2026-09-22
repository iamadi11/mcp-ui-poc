# ADR-002: Jev decides, Haiku constructs when the catalog cannot

## Status

Accepted (amended by **ADR-007**)

## Context

Jev (TypeSafe System One) returns typed Choice/Score/Noul — not HTML or spec JSON. LLMs are slow and expensive as the default planner. A frozen catalog (login, checkout, dashboards, maps) cannot express every prompt. Adding a new primitive per ask (tic-tac-toe, graffiti, …) does not scale.

## Decision

`DecisionAdapter` seam with **one System 1 fan-out per turn** (originally Jev-only; ADR-007 adds open **Laya** as a preferred peer). Studio does **not** replay Redis fingerprints — asking again generates a new UI.

Cascade: **DecisionAdapter** (intent, look, motion, in_catalog, named_widget, patches) →

1. **Catalog hit** (`in_catalog` high / named exclusive, and the prompt is expressible): code `applyPolicy` + ThemeAdapter. LLM fills copy slots only if `needs_llm`.
2. **Catalog miss** (unknown surface, custom brand/look such as graffiti, follow-up on a generated widget that is not look/motion-only, or the same session asking for a new widget): **LLM generates** a sanitized HTML widget (`html-block`). ThemeAdapter wraps pack tokens, `data-look`, and `data-motion`.
3. **No decision backend:** regex catalog for named primitives; LLM generate for the rest if a generative provider is configured.

The DecisionAdapter never emits HTML. The generative LLM never invents React. Packs remain tokens/CSS — generated `script` is sanitized (no fetch/eval/storage). Never send full JSON to the LLM — `inferShape` + prompt excerpt only. Never send design-system CSS files to the DecisionAdapter.

Motion is a **token** (`none` | `enter` | `stagger` | `live`) implemented in CSS on the host.

## Consequences

- New product UIs do not require a new catalog primitive.
- Catalog questions stay cheap (parallel evaluation).
- Cost log fields (`planner`, `latencyMs`, `jevConfidence`) go to Mongo turns — never API keys.
- Look/motion follow-ups on generated UIs stay on DecisionAdapter + CSS; content follow-ups re-call the LLM with the previous HTML.
- See **ADR-007** for Laya + OpenAI-compatible OSS defaults.
