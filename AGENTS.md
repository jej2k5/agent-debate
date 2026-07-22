# Repository Guidelines

## Project Structure & Module Organization

This is a Python 3.11+ package using a `src/` layout. Application code lives in `src/claude_codex_debate/`: `mcp_server.py` exposes the MCP relay, `store.py` manages SQLite state, `bridge.py` and `terminal.py` handle macOS terminal activation, and `admin.py` provides administrative commands. Tests live in `tests/`. Agent skill definitions are under `skills/claude/` and `skills/codex/`; keep their shared behavior aligned. Installation utilities live in `scripts/`, while the root `debate-bridge` script delegates to the installed executable. Treat `build/` and `*.egg-info/` as generated artifacts.

## Build, Test, and Development Commands

Create an isolated development environment and install the package:

```bash
python3 -m venv .venv
.venv/bin/pip install -e .
```

Run the complete test suite with:

```bash
.venv/bin/python -m unittest discover -s tests -v
```

Use `.venv/bin/debate-mcp`, `.venv/bin/debate-admin`, or `.venv/bin/debate-bridge --help` to exercise console entry points. `./scripts/install.sh` performs a user installation and modifies local Claude/Codex configuration; reserve it for end-to-end installation checks. `./scripts/uninstall.sh` removes that installation.

## Coding Style & Naming Conventions

Follow standard PEP 8 conventions: four-space indentation, `snake_case` functions and variables, and `PascalCase` classes. Keep type annotations on public and stateful interfaces, use `pathlib.Path` for filesystem paths, and retain `from __future__ import annotations` in package modules. Prefer small, explicit functions and parameterized SQL. No formatter or linter is configured, so keep imports ordered and match nearby style.

## Testing Guidelines

Tests use Python's built-in `unittest` framework. Name files `test_*.py`, classes `*Tests`, and methods `test_<behavior>`. Use temporary directories and databases so tests do not touch the user's debate data. Add regression coverage for turn transitions, message delivery, resolution handshakes, and platform-independent bridge logic. No coverage threshold is currently enforced.

## Commit & Pull Request Guidelines

Git history is unavailable in this checkout. Use short, imperative commit subjects, optionally scoped, such as `store: reject messages after resolution`. Keep commits focused. Pull requests should explain the behavior change, list verification commands, link relevant issues, and call out macOS Terminal/iTerm2 or MCP configuration impacts. Include logs or screenshots when terminal activation behavior changes.

## Security & Configuration Tips

Never commit local SQLite databases, logs, terminal identifiers, or credentials. Use `DEBATE_DATA_DIR` and `DEBATE_DB` to isolate development state from `~/.local/share/claude-codex-debate`.
