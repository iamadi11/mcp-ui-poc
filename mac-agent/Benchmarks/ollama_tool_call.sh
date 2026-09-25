#!/usr/bin/env bash
# Measure Ollama → tool-call → AgentRuntime latency on this Mac.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/usr/bin:/opt/homebrew/bin:${PATH}"

MODEL="${MAC_AGENT_OLLAMA_MODEL:-qwen2.5:0.5b}"
if ! command -v ollama >/dev/null; then
  echo "ollama_not_installed=1"
  exit 2
fi

# Ensure daemon is up
if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  brew services start ollama >/dev/null 2>&1 || true
  sleep 2
fi

if ! ollama list 2>/dev/null | awk 'NR>1{print $1}' | grep -qx "$MODEL"; then
  echo "pulling model=$MODEL"
  ollama pull "$MODEL"
fi

swift build -c release --product mac-agent-cli 2>/dev/null || swift build -c release --product mac-agent-cli
BIN=".build/release/mac-agent-cli"

# Warm request (discard)
"$BIN" --ollama "Call get_system_status for a quick system summary." >/dev/null || true

START=$(date +%s%N)
OUT=$("$BIN" --ollama "Call get_system_status for a quick system summary." || true)
END=$(date +%s%N)
MS=$(( (END - START) / 1000000 ))

echo "$OUT"
echo "ollama_tool_call_ms=$MS"
echo "model=$MODEL"
