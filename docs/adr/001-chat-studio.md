# ADR-001: Chat-first studio

## Status

Accepted (amended)

## Context

The endpoint form (`EndpointToUI.jsx`) plus glass/mesh chrome reads as a demo. A later lab studio (Chat / History / Examples tabs, Replan, Skip cache, planner traces) taught caching instead of creation. Users think in messages, not HTTP methods or fingerprint indexes.

## Decision

The product surface is a **creation journey**: describe → see → talk → share.

- Split studio: composer + live preview + Publish. A turn is a **prompt**. JSON API URLs may appear in the message; there is no separate URL field.
- Output is always a Widget (policy + spec + theme pack + motion).
- SSE may emit machine traces; the host maps them to human stages (`fetching` → `designing` → `rendering`).
- The form-based endpoint builder is retired. Lab chrome is not the happy path (`?debug=1` only).

## Consequences

- `client/src/studio/` owns chrome; `packages/core` stays the composition kernel.
- Starters must produce the UI they name.
- Instruction chips after first success are optional, skippable, and never a locked tour.
