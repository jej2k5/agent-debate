#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${DEBATE_DATA_DIR:-$HOME/.local/share/claude-codex-debate}"
BRIDGE="$DATA_DIR/venv/bin/debate-bridge"

if [[ -x "$BRIDGE" ]]; then
  "$BRIDGE" stop >/dev/null 2>&1 || true
fi

if command -v claude >/dev/null 2>&1; then
  claude mcp remove debate-relay >/dev/null 2>&1 || true
fi
if command -v codex >/dev/null 2>&1; then
  codex mcp remove debate-relay >/dev/null 2>&1 || true
fi

rm -rf "$HOME/.claude/skills/debate-peer"
rm -rf "$HOME/.agents/skills/debate-peer"
rm -rf "$DATA_DIR"

echo "Claude/Codex debate relay removed."
