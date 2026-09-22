# Architecture

## Invariant (non-negotiable)

```
LLM  →  Structured Tool Request  →  Schema Validation
     →  Policy Engine  →  Permission Engine  →  Tool Runtime  →  OS
```

There is **no** path `LLM → shell string → OS`.  
There is **no** path `MCP/API → tools` that skips Policy.

Automated tests assert that MockLLM / injected payloads cannot call OS adapters without passing `SecurityGate`.

## Layer diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Interfaces: Voice │ Text │ MCP │ Local API │ CLI │ FastPath │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Task Engine (state machine) + Action Planner                │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ LLM Runtime (pluggable) — produces ToolCall[] only          │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Security: Schema → Policy → Permissions → Confirmation      │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Tool Runtime (capability modules) → macOS APIs              │
└─────────────────────────────────────────────────────────────┘
```

## Modules (Swift packages / targets)

| Target | Responsibility | Linux CI |
|--------|----------------|----------|
| `MacAgentSecurity` | Risk levels, policy, path sandbox, command allowlist, audit, redaction | Yes |
| `MacAgentCore` | Task state, planner, runtime orchestration, context | Yes |
| `MacAgentTools` | Tool definitions + validators; OS adapters `#if canImport(AppKit)` | Partial |
| `MacAgentLLM` | `LLMProvider` + Ollama HTTP + Mock | Yes |
| `MacAgentInterfaces` | FastPath, MCP stubs, API stubs | Partial |
| `MacAgentVoice` | STT/TTS protocols; WhisperKit on Apple | Stubs |
| `MacAgentApp` | SwiftUI menu bar (Mac only) | No |

## Task state machine

```
planned → running → waiting_for_confirmation → running → succeeded
                 ↘ failed
                 ↘ cancelled
```

Cancellation is cooperative: runtime checks `Task.isCancelled` between tool steps.

## Fast path

`FastPathRouter` matches normalized utterances to deterministic handlers (`get_battery`, `open_application`, `get_cpu`, …) **before** LLM. Returns a `ToolCall` already in structured form; still passes SecurityGate.

## Planner

For multi-step NL: LLM returns ordered `ToolCall`s (or a plan object). Runtime executes sequentially; on failure, does not blindly restart prior successful side effects — records checkpoint and surfaces recovery options.

## Interfaces converge

All of Voice / Text / MCP / API / CLI construct a `TaskRequest { source, instruction, auth }` and call `AgentRuntime.submit`.

## Observability

Structured logs with `taskId`, `requestId`, `tool`, latency, permission decision. Secrets redacted via `Redactor` before audit persist.
