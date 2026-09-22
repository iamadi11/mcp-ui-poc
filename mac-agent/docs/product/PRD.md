# PRD — Mac Agent MVP

## Users

Privacy-sensitive Mac power users and developers integrating local agents.

## MVP

1. Capability-based tool runtime + security policy (no unrestricted shell)
2. Deterministic fast path for common queries
3. Local LLM provider interface (Ollama)
4. Voice pipeline interface (STT→runtime)
5. MCP/API entry that cannot bypass policy
6. Audit log

## Non-goals (MVP)

- Full vision-based computer use
- Cloud-required inference
- Electron UI
- Arbitrary AppleScript execution

## Constraints

Local-first; TCC respected; Linux CI can only verify non-AppKit core.
