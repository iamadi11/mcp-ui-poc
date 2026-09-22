# Product validation

Date: 2026-09-22T08:40:00.588Z

## Against acceptance criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| Capability-based tools (no free shell) | MET | Security gate in Sources |
| Local-first default | PARTIAL | Docs + Ollama stub; Mac STT NOT VERIFIED on this host |
| Fast path for simple commands | MET | Benchmark when available |
| External agents share policy | MET (design) | MCP/API bridges use SecurityGate |
| Native menu-bar UX | NOT VERIFIED | Requires Mac |

## Would a user use it today?

Foundation is promising on security/architecture. Voice+AX product experience needs a Mac host.

## Biggest friction

Cannot validate microphone → tool → speak loop on Linux CI.
