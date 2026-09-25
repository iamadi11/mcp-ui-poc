#!/usr/bin/env bash
# Latency micro-benchmark for deterministic fast path (Linux/macOS).
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/usr/bin:${SWIFT_PATH:-/home/ubuntu/swift/usr/bin}:$PATH"
swift build -c release 2>/dev/null || swift build -c release
BIN=".build/release/mac-agent-cli"
START=$(date +%s%N)
"$BIN" "What's my battery?" >/dev/null
END=$(date +%s%N)
MS=$(( (END - START) / 1000000 ))
echo "fast_path_cli_ms=$MS"
# Target: near-instant for deterministic path on warm process; first launch includes dyld.
