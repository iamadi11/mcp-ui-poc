#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes skills update -p -y || npx --yes skills@latest update -p -y
npx --yes ui-ux-pro-max-cli@latest update || true
echo "Skills updated."
