# ADR-002: Jev decides, Haiku constructs when the catalog cannot

## Status

Accepted (amended)

## Context

Jev (TypeSafe System One) returns typed Choice/Score/Noul — not HTML or spec JSON. LLMs are slow and expensive as the default planner. A frozen catalog (login, checkout, dashboards, maps) cannot express every prompt. Adding a new primitive per ask (tic-tac-toe, graffiti, …) does not scale.

## Decision

`DecisionAdapter` seam with **one Jev fan-out per turn**. Studio does **not** replay Redis fingerprints — asking again generates a new UI.

Cascade: **Jev** (intent, look, motion, in_catalog, named_widget, patches) →

1. **Catalog hit** (`in_catalog` high / named exclusive, and the prompt is expressible): code `applyPolicy` + ThemeAdapter. Haiku fills copy slots only if `needs_llm`.
2. **Catalog miss** (unknown surface, custom brand/look such as graffiti, follow-up on a generated widget that is not look/motion-only, or the same session asking for a new widget): **Haiku generates** a sanitized HTML widget (`html-block`). ThemeAdapter wraps pack tokens, `data-look`, and `data-motion`.
3. **No TypeSafe key:** regex catalog for named primitives; Haiku generate for the rest if an Anthropic key exists.

Jev never emits HTML. Haiku never invents React. Packs remain tokens/CSS — generated `script` is sanitized (no fetch/eval/storage). Never send full JSON to Claude — `inferShape` + prompt excerpt only. Never send design-system CSS files to Jev.

Motion is a **token** (`none` | `enter` | `stagger` | `live`) implemented in CSS on the host.

## Consequences

- New product UIs do not require a new catalog primitive.
- Catalog questions stay cheap (parallel evaluation).
- Cost log fields (`planner`, `latencyMs`, `jevConfidence`) go to Mongo turns — never API keys.
- Look/motion follow-ups on generated UIs stay on Jev + CSS; content follow-ups re-call Haiku with the previous HTML.
