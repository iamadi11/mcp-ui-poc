# ADR-001: Chat-first studio

## Status

Accepted

## Context

The endpoint form (`EndpointToUI.jsx`) plus glass/mesh chrome reads as a demo. Users think in messages, not HTTP method dropdowns. The durable artifact must be a reusable widget, not a one-off iframe.

## Decision

The product surface is a split **studio**: chat (left) + live preview (right) + Publish. A turn is a message, optionally with API URLs. Output is always a Widget (policy + spec + theme + motion).

The form-based endpoint builder is retired as the primary UX.

## Consequences

- `client/src/studio/` owns chrome; `packages/core` stays the composition kernel.
- SSE (or a streaming POST) reports `routed` → `fetching` → `planned` → `rendered` so perceived latency stays honest.
- Instruction chips remain as optional prompt starters, not the main IA.
