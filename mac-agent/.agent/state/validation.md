# Product validation

Date: 2026-09-22T10:33:49.607Z

## Against acceptance criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| Capability-based tools (no free shell) | MET | Security gate in Sources |
| Local-first default | MET | Ollama yes; WhisperKit E2E verified |
| Fast path for simple commands | MET | Battery Listen used fast path |
| External agents share policy | MET (design) | MCP/API bridges use SecurityGate |
| Native menu-bar UX | MET | ~/Applications/Mac Agent.app |
| Mic → WhisperKit → runtime | MET | See docs/poc/mac-voice-e2e.md |

## Would a user use it today?

Yes on this personal Mac for spoken deterministic commands (dry-run) and Ollama tool probes.

## Biggest friction

Optional: live (non-dryRun) toggle; AX journeys; faster warm STT.
