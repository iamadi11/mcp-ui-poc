#!/usr/bin/env bash
# AX click/type journey (TextEdit menu clicks + type into seeded document).
# Default: dry-run. Pass --live for real Accessibility actions.
# Note: modern Calculator often exposes no AX window tree; TextEdit is the reliable target.
set -euo pipefail
cd "$(dirname "$0")/.."
swift build -c release --product mac-agent-cli 2>/dev/null || swift build --product mac-agent-cli
BIN=".build/release/mac-agent-cli"
if [[ ! -x "$BIN" ]]; then
  BIN=".build/debug/mac-agent-cli"
fi
MODE=(--ax-journey)
if [[ "${1:-}" == "--live" ]]; then
  MODE+=(--live)
fi
"$BIN" "${MODE[@]}"
