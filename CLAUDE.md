# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local MCP debate relay plus a macOS event bridge that lets Claude Code and Codex CLI debate each other from two ordinary terminal tabs. Messages and debate state live in SQLite; a polling daemon notices undelivered messages and uses AppleScript to activate the opposing terminal with a fixed continuation prompt. There is no blocking wait tool, no round limit — a debate ends only when both agents accept an `agreement` or `agree_to_disagree` resolution.

## Commands

```bash
# Dev environment (src/ layout, editable install)
python3 -m venv .venv
.venv/bin/pip install -e '.[web]'   # [web] extra adds fastapi/uvicorn/httpx for the control room

# Run all tests (unittest, no pytest)
.venv/bin/python -m unittest discover -s tests -v

# Run a single test
.venv/bin/python -m unittest tests.test_store.StoreTests.test_<name> -v

# Console entry points (defined in pyproject.toml)
.venv/bin/debate-mcp        # MCP server over stdio
.venv/bin/debate-admin      # list / status <id> / transcript <id> (JSON output)
.venv/bin/debate-bridge     # register / start / stop / status / test / run
.venv/bin/debate-web        # control room web app on 127.0.0.1:8710 (requires the [web] extra)

# Control room frontend (Vite + vanilla TypeScript, in web/)
cd web && npm install && npm run build   # builds into src/claude_codex_debate/webui/ (generated; never edit)
```

`./scripts/install.sh` is an end-to-end user install: it builds a venv at `~/.local/share/claude-codex-debate/venv`, hand-writes launcher scripts (does not rely on pip console scripts), copies skills to `~/.claude/skills/` and `~/.agents/skills/`, and registers `debate-relay` with both `claude mcp add` and `codex mcp add`. It modifies real user configuration — don't run it as part of routine development. `./scripts/uninstall.sh` reverses it.

Set `DEBATE_DATA_DIR` and/or `DEBATE_DB` to isolate development state from the real install at `~/.local/share/claude-codex-debate`. Tests must use temp dirs/databases.

## Architecture

All application code is in `src/claude_codex_debate/` (~5 small modules). `build/` and `*.egg-info/` are generated artifacts — never edit them.

The system has four cooperating processes sharing one SQLite database (path resolved by `config.py`):

1. **MCP server** (`mcp_server.py`) — FastMCP over stdio, one instance spawned by each of Claude Code and Codex. Thin tool wrappers (`debate_create`, `debate_join`, `debate_send`, `debate_inbox`, `debate_status`, `debate_transcript`, `debate_propose_resolution`, `debate_respond_resolution`) that delegate directly to the store.
2. **Store** (`store.py`) — all state and business rules: schema creation, turn enforcement (`send` rejects out-of-turn senders and flips `current_turn` to the recipient), message delivery tracking (`delivered_at`), and the resolution handshake (proposer cannot accept their own proposal; acceptance marks the debate `completed`). Uses WAL mode so the MCP servers and bridge can share the DB concurrently.
3. **Bridge daemon** (`bridge.py` + `terminal.py`) — polls `pending_deliveries()` every 0.75s; for each undelivered message it looks up the recipient's registered TTY (`debate-bridge register` stores app + TTY in the `terminal_registrations` table) and injects a fixed continuation prompt into that Terminal/iTerm2 tab via AppleScript (`terminal.py:inject`). Only the control prompt is injected — argument text stays in SQLite and is fetched via `debate_inbox`. Daemon lifecycle is pidfile-based (`bridge.pid`, `bridge.log` under the data dir).

4. **Control room** (`web.py` + `web/`) — optional FastAPI server (`debate-web`, localhost:8710) serving a Vite + vanilla TypeScript SPA from `src/claude_codex_debate/webui/` (a build artifact of `web/`; regenerate with `npm run build`, never edit). REST endpoints wrap the store; `/api/events` is an SSE stream that polls SQLite's `data_version` so the UI refetches on any commit. The human moderator can create debate shells (`create_debate_shell`, agents join later) and interject (`send_moderator`: sender `moderator`, kind `interjection`, addressed to the current turn holder, does **not** flip the turn). Design context for UI work lives in `PRODUCT.md`.

The turn cycle: agent A calls `debate_send` → row inserted with `delivered_at IS NULL`, turn flips to B → bridge sees the pending row, injects the continuation prompt into B's terminal, marks it delivered → B calls `debate_inbox` (which also marks read), replies with `debate_send` → repeat.

**Skills** (`skills/claude/debate-peer/SKILL.md` and `skills/codex/debate-peer/SKILL.md`) define the agent-side protocol: choose your own position, display it and every full argument in the terminal before submitting the exact same text via MCP, never call a blocking wait. The two skill files are parallel variants of the same protocol — when changing one, keep the other aligned.

The root `./debate-bridge` script is just a launcher delegating to the installed executable.

## Conventions

- PEP 8; type annotations on public/stateful interfaces; `pathlib.Path` for paths; keep `from __future__ import annotations` in package modules; parameterized SQL only. No formatter or linter is configured — match nearby style.
- Tests: files `test_*.py`, classes `*Tests`, methods `test_<behavior>`. Add regression coverage for turn transitions, message delivery, and resolution handshakes.
- macOS-specific code is confined to `terminal.py` (and bridge injection); keep store/server logic platform-independent.
- Never commit local SQLite databases, logs, or terminal identifiers.
