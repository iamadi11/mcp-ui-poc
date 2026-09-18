#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npx --yes skills@latest add mattpocock/skills -y \
  --agent cursor \
  --agent claude-code \
  --skill setup-matt-pocock-skills \
  --skill ask-matt \
  --skill grill-with-docs \
  --skill implement \
  --skill tdd \
  --skill diagnosing-bugs \
  --skill code-review \
  --skill prototype \
  --skill research \
  --skill handoff

npx --yes ui-ux-pro-max-cli@latest init --ai cursor --ai claude --force

echo "Skills installed. In chat, run /setup-matt-pocock-skills once per clone."
echo "UI work: read design-system/MCP-UI/MASTER.md and the ui-ux-pro-max SKILL.md."
