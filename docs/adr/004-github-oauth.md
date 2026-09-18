# ADR-004: GitHub OAuth for widget owners

## Status

Accepted

## Context

Published widgets need a public embed URL. Paid auth (Clerk/Auth0) is out of budget. The product owner chose GitHub OAuth so only the owner can edit.

## Decision

Free **GitHub OAuth App**. View/embed at `/e/:publicId` is public (unguessable id). Owner UI at `/w/:publicId` requires a GitHub session. Sessions live in Redis (or a signed cookie if Redis is down) using `SESSION_SECRET`.

Consumers pin versions with `?v=`. Republish keeps the same `publicId`.

## Consequences

Local and preview deploys need `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, and a callback URL. Production omits TypeSafe/Anthropic keys so visitors BYOK; OAuth + Mongo + Upstash stay configured.
