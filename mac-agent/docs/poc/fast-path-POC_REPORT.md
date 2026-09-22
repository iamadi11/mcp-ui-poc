# POC Report — Deterministic fast path latency

## Hypothesis

Battery/CPU style commands can complete without an LLM in well under 2s on this host.

## Setup

`./Benchmarks/fast_path.sh` → `mac-agent-cli "What's my battery?"` dry-run.

## Measurements

```
Building for production...
[0/10] Write sources
[7/10] Write swift-version-39DE35E5FB675785.txt
[9/11] Compiling MacAgentSecurity AuditLog.swift
[10/13] Compiling MacAgentLLM ModelRouter.swift
/workspace/mac-agent/Sources/MacAgentLLM/ModelRouter.swift:2:8: warning: file 'ModelRouter.swift' is part of module 'MacAgentLLM'; ignoring import
 1 | import Foundation
 2 | import MacAgentLLM
   |        `- warning: file 'ModelRouter.swift' is part of module 'MacAgentLLM'; ignoring import
 3 | import MacAgentSecurity
 4 | 
[11/13] Compiling MacAgentTools Catalog.swift
[12/14] Compiling MacAgentCore PermissionDoctor.swift
[13/16] Compiling MacAgentInterfaces Bridges.swift
[14/16] Compiling MacAgentVoice VoicePipeline.swift
[15/17] Compiling MacAgentCLI main.swift
[15/17] Write Objects.LinkFileList
[16/17] Linking mac-agent-cli
Build complete! (5.59s)
fast_path_cli_ms=12
```

Parsed ms: 12

## Result

PASS for deterministic path on this Linux host

## Limitations

Does **not** measure WhisperKit STT or Ollama tool-calling on Apple Silicon (host is Linux). Those remain UNKNOWN until Mac POC.

## Decision

Proceed with architecture using fast path; schedule Mac STT+LLM POC as separate blocked item.
