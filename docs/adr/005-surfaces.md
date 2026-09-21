# ADR-005: Surfaces — fixtures vs planner

## Status

Superseded in part (Jev now plans every surface; classifier only binds data)

## Context

Jev + `LayoutPolicy` were first built for **record dashboards**. Text-only product prompts were bound as fake Primary/Details/Next rows, so Jev “succeeded” at 50%+ on tables. ADR-005 originally **took product UI away from Jev** (catalog shells for login/maps). That hid the real bug: fake record fixtures.

## Decision

1. **Code binds fixtures** (`promptPayload` / `classifySurface`): login fields, workspace layers, landing/checkout/pricing/form/settings/calendar demo data, or live JSON. Never fake Primary/Details/Next rows for a product prompt.
2. **Jev decides the surface** (`surface_kind`, `named_widget`, `tool_primitive`) and layout. Catalog shells must not skip Jev when a TypeSafe key exists.
3. **No TypeSafe key:** regex classifier + catalog primitives remain the fallback.
4. Map `work-stage` still loads the Google Maps JS API at **render** from env/header. The key is never stored on the spec.

Unknown prompts that are not a named catalog primitive bind a **generated fixture**. Haiku constructs the UI; Jev still chooses look and motion. Map/editor/board prompts still bind a **workspace fixture**. Never fake Primary/Details/Next rows.

## Consequences

- New primitives (landing, checkout, pricing, form, settings, calendar) are catalog + ThemeAdapter + Jev `include_*` / `named_widget`.
- Product UIs compete on `surface_kind`, not by short-circuiting the planner.
