# Security report — adversarial

## Scope

Prompt/tool injection, path traversal, forged confirmation, unknown tools.

## Evidence

`swift test --filter Adversarial` exit=0

## Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| S-1 | INFO | Linux host cannot validate TCC bypass attempts | Open (env) |
| S-2 | — | execute_shell hard-blocked in SecurityGate | Closed |
| S-3 | — | ~/.ssh and .env globs denied | Closed |

No CRITICAL findings in AgentCore unit adversarial suite.
