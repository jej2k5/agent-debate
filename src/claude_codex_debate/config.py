from __future__ import annotations

import os
from pathlib import Path


def data_dir() -> Path:
    path = Path(os.environ.get("DEBATE_DATA_DIR", "~/.local/share/claude-codex-debate")).expanduser()
    path.mkdir(parents=True, exist_ok=True)
    return path


def db_path() -> Path:
    return Path(os.environ.get("DEBATE_DB", data_dir() / "debates.db")).expanduser()


def bridge_pid_path() -> Path:
    return data_dir() / "bridge.pid"


def bridge_log_path() -> Path:
    return data_dir() / "bridge.log"
