# ADR-003: Redis hot path, Mongo source of truth

## Status

Accepted

## Context

Upstash Redis is already used for fingerprint replay. Atlas M0 (512MB, free) can hold widgets and training turns. Raw API payloads must not be stored (privacy + quota).

## Decision

- **Redis**: session turns (TTL), OAuth session, fingerprint → policy, rate limits.
- **Mongo**: `widgets` (versions, owner, theme, motion), `turns` (shape, prompt excerpt, jevAnswers, planner, latency, rating), `studio_chats` (soft-deleted studio threads for training), `users` (GitHub id).
- Similarity remains `shapeHash` lists, not a paid vector DB.
- If `MONGODB_URI` is unset, the app still plans; publish/history degrade gracefully.

## Consequences

Turns + ratings are the labeled set for a future on-device model. Replay stays on Redis so the generate path does not wait on Atlas.
