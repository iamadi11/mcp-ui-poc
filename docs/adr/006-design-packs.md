# ADR-006: LayoutPolicy vs design-system pack

## Status

Accepted

## Context

Four hardcoded ThemeAdapter skins (`shadcn`, `material`, `plain`, `glass`) could not accept a user’s tokens. Layout decisions and visual tokens were easy to mix.

## Decision

- **LayoutPolicy** is value- and token-independent (which primitives, fields, chart type, motion token).
- A **Design System Pack** is tokens + optional sanitized CSS + `supports[]` primitive ids. ThemeAdapter `render(spec, pack) → HTML`.
- Studio users connect a pack (CSS variables, tokens.json, starter). They never upload JavaScript.
- Developers may still `registerDesignSystem` with a custom `render`.
- Jev `state.catalog` is `supports` (or the full catalog). Raw CSS is never sent to Jev or Haiku.
- Widget versions persist `themeId` + `themePack` so embeds stay branded. Fingerprints include a pack hash.

## Consequences

- Connecting a look restyles the catalog; it does not invent widgets.
- Extra CSS is sanitized (no `@import`, `url(javascript:)`, `expression(`, or script).
