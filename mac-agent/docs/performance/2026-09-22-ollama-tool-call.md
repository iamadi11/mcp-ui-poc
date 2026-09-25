# Performance — Ollama tool-call latency

Date: 2026-09-22  
Host: darwin arm64 (Apple Silicon)  
Model: `qwen2.5:0.5b` via local Ollama (`127.0.0.1:11434`)

## Command

```bash
./Benchmarks/ollama_tool_call.sh
```

## Results

| Probe | ms | Notes |
|-------|-----|-------|
| Warm CLI `--ollama` tool path | **285** | After one discarded warm call |
| Follow-up CLI call | **1226** | Includes process start + model |

Target: simple tool call &lt; 2s when local model warm → **PASS** (285ms warm).

## Sample output

```
provider=ollama
latency_ms=263
state=succeeded
processors=8 memoryBytes=8589934592 host=… dryRun=true
ollama_tool_call_ms=285
model=qwen2.5:0.5b
```

## Notes

- Ollama installed via Homebrew (`brew install ollama`); service started with `brew services start ollama`.
- Tool calling implemented in `OllamaProvider` (`Sources/MacAgentLLM/Providers.swift`).
- SecurityGate still authorizes every tool call — model never bypasses policy.
