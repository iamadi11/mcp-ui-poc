# ADR-001: Security invariant — no LLM→OS path

## Status

Accepted

## Context

Computer-control agents fail catastrophically when models emit free-form shell.

## Decision

Only path: LLM → structured ToolCall → schema → policy → permission → tool → OS.

Hard-block `execute_shell` and shell wrappers. Filesystem deny-wins. Confirmation tokens minted by SecurityGate only.

## Consequences

Slightly less “autonomy theater”; much stronger safety. MCP/API must share the same gate.
