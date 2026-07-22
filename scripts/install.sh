#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DEBATE_DATA_DIR:-$HOME/.local/share/claude-codex-debate}"
VENV="$DATA_DIR/venv"

fail() {
  echo "Installation failed: $*" >&2
  exit 1
}

command -v python3 >/dev/null 2>&1 || fail "python3 was not found"
mkdir -p "$DATA_DIR"

python3 -m venv "$VENV" || fail "could not create virtual environment at $VENV"
PYTHON="$VENV/bin/python"
PIP="$VENV/bin/pip"

# Ignore user-level pip settings such as a global `target`, which would install
# packages outside this virtual environment and leave its launchers unusable.
"$PYTHON" -m pip --isolated install --upgrade pip setuptools wheel
"$PYTHON" -m pip --isolated install --no-cache-dir --force-reinstall "$ROOT"

# Create launchers explicitly. Some pip/macOS configurations install the package
# successfully but omit console-script entry points. These launchers do not rely
# on pip generating those files.
create_launcher() {
  local name="$1"
  local module="$2"
  local target="$VENV/bin/$name"
  cat > "$target" <<LAUNCHER
#!/usr/bin/env bash
set -euo pipefail
exec "$PYTHON" -m "$module" "\$@"
LAUNCHER
  chmod 755 "$target"
}

create_launcher debate-bridge claude_codex_debate.bridge
create_launcher debate-admin claude_codex_debate.admin
create_launcher debate-mcp claude_codex_debate.mcp_server

for executable in debate-bridge debate-admin debate-mcp; do
  [[ -x "$VENV/bin/$executable" ]] || fail "$VENV/bin/$executable was not created"
done

# Verify imports and launchers before changing client configuration.
"$PYTHON" -c 'import claude_codex_debate.bridge, claude_codex_debate.admin, claude_codex_debate.mcp_server'
"$VENV/bin/debate-bridge" --help >/dev/null

mkdir -p "$HOME/.claude/skills/debate-peer"
cp "$ROOT/skills/claude/debate-peer/SKILL.md" "$HOME/.claude/skills/debate-peer/SKILL.md"
mkdir -p "$HOME/.agents/skills/debate-peer"
cp "$ROOT/skills/codex/debate-peer/SKILL.md" "$HOME/.agents/skills/debate-peer/SKILL.md"

MCP_CMD="$VENV/bin/debate-mcp"
if command -v claude >/dev/null 2>&1; then
  # -s user: the agents run in arbitrary terminal tabs (and via the control room's
  # launch buttons, in a fresh home-directory shell), so the server must resolve
  # everywhere, not only in the directory the installer happened to run from.
  claude mcp remove -s user debate-relay >/dev/null 2>&1 || true
  claude mcp remove debate-relay >/dev/null 2>&1 || true
  claude mcp add -s user debate-relay -- "$MCP_CMD"
else
  echo "Claude CLI not found; register later with: claude mcp add -s user debate-relay -- '$MCP_CMD'"
fi

if command -v codex >/dev/null 2>&1; then
  codex mcp remove debate-relay >/dev/null 2>&1 || true
  codex mcp add debate-relay -- "$MCP_CMD"
else
  echo "Codex CLI not found; register later with: codex mcp add debate-relay -- '$MCP_CMD'"
fi

cat <<MSG

Installed successfully.
Bridge executable: $VENV/bin/debate-bridge
Admin executable:  $VENV/bin/debate-admin
MCP executable:    $VENV/bin/debate-mcp

Verify:
  $VENV/bin/debate-bridge --help

Register each terminal before launching its client:
  $VENV/bin/debate-bridge register claude
  $VENV/bin/debate-bridge register codex

Then start the bridge:
  $VENV/bin/debate-bridge start
MSG
