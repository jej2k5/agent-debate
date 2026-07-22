from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any, AsyncIterator

from . import bridge as bridge_daemon
from . import terminal
from .config import bridge_pid_path, db_path
from .store import DebateStore
from .transcript import render_markdown

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import FileResponse, Response, StreamingResponse
    from fastapi.staticfiles import StaticFiles
    from pydantic import BaseModel
except ImportError as exc:  # pragma: no cover - guarded by the [web] extra
    raise ImportError(
        "The control room requires the web extra. Install with: pip install -e .[web]"
    ) from exc

POLL_SECONDS = 0.4
HEARTBEAT_SECONDS = 10.0
AGENT_CHECK_SECONDS = 2.0


def webui_dir() -> Path:
    return Path(os.environ.get("DEBATE_WEBUI", Path(__file__).parent / "webui")).expanduser()


def bridge_status() -> dict[str, Any]:
    pidfile = bridge_pid_path()
    if not pidfile.exists():
        return {"running": False, "pid": None}
    try:
        pid = int(pidfile.read_text().strip())
        os.kill(pid, 0)
        return {"running": True, "pid": pid}
    except (ProcessLookupError, ValueError, PermissionError):
        return {"running": False, "pid": None}


AGENT_COMMANDS = {"claude": "claude", "codex": "codex"}

# Model identifiers are interpolated into a shell command, so restrict them to a
# safe charset (CLI model names/aliases only need these) to prevent injection.
MODEL_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


def bridge_executable() -> str:
    candidate = Path(sys.executable).parent / "debate-bridge"
    return str(candidate) if candidate.exists() else "debate-bridge"


def normalize_model(model: str | None) -> str | None:
    """Trim a requested model to a validated name, or None to use the CLI default."""
    if model is None:
        return None
    model = model.strip()
    if not model:
        return None
    if not MODEL_PATTERN.match(model):
        raise HTTPException(status_code=400, detail=f"Invalid model name: {model}")
    return model


def launch_command(participant: str, model: str | None = None) -> str:
    """Shell command for a fresh terminal tab: register this TTY, then run the agent CLI.

    Both `claude` and `codex` accept `--model <name>`; omit it to use the CLI default.
    """
    parts = []
    for var in ("DEBATE_DATA_DIR", "DEBATE_DB"):
        value = os.environ.get(var)
        if value:
            parts.append(f"export {var}={value}")
    parts.append(f"{bridge_executable()} register {participant}")
    agent = AGENT_COMMANDS[participant]
    parts.append(f"{agent} --model {model}" if model else agent)
    return " && ".join(parts)


def agent_status(store: DebateStore, participant: str) -> dict[str, Any]:
    registration = store.registration(participant)
    running = False
    if registration and sys.platform == "darwin":
        running = terminal.tty_has_process(registration["tty"], AGENT_COMMANDS[participant])
    return {
        "registered": registration is not None,
        "running": running,
        "app": registration["app"] if registration else None,
        "tty": registration["tty"] if registration else None,
    }


class CreateDebateRequest(BaseModel):
    debate_id: str
    topic: str
    first_speaker: str = "claude"


class InterjectRequest(BaseModel):
    content: str


class LaunchRequest(BaseModel):
    model: str | None = None


def _raise_for(error: ValueError) -> None:
    text = str(error)
    if "not found" in text:
        raise HTTPException(status_code=404, detail=text)
    if "already exists" in text:
        raise HTTPException(status_code=409, detail=text)
    raise HTTPException(status_code=400, detail=text)


def create_app(database: str | Path | None = None) -> FastAPI:
    store = DebateStore(database or db_path())
    app = FastAPI(title="debate-control-room")

    def agents() -> dict[str, Any]:
        return {name: agent_status(store, name) for name in ("claude", "codex")}

    @app.get("/api/overview")
    def overview() -> dict[str, Any]:
        return {
            "debates": store.list_debates_detailed(),
            "bridge": bridge_status(),
            "agents": agents(),
        }

    @app.post("/api/debates", status_code=201)
    def create_debate(request: CreateDebateRequest) -> dict[str, Any]:
        try:
            return store.create_debate_shell(request.debate_id.strip(), request.topic.strip(), request.first_speaker)
        except ValueError as error:
            _raise_for(error)
            raise

    @app.get("/api/debates/{debate_id}")
    def debate_detail(debate_id: str) -> dict[str, Any]:
        try:
            status = store.status(debate_id)
        except ValueError as error:
            _raise_for(error)
            raise
        return {
            "debate": status,
            "messages": store.transcript(debate_id),
            "bridge": bridge_status(),
            "agents": agents(),
        }

    @app.get("/api/debates/{debate_id}/transcript.md")
    def export_transcript(debate_id: str) -> Response:
        try:
            debate = store.status(debate_id)
        except ValueError as error:
            _raise_for(error)
            raise
        body = render_markdown(debate, store.transcript(debate_id))
        return Response(
            content=body,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{debate_id}.md"'},
        )

    @app.post("/api/debates/{debate_id}/interject", status_code=201)
    def interject(debate_id: str, request: InterjectRequest) -> dict[str, Any]:
        try:
            return store.send_moderator(debate_id, request.content)
        except ValueError as error:
            _raise_for(error)
            raise

    @app.post("/api/debates/{debate_id}/kickoff", status_code=201)
    def kickoff_debate(debate_id: str) -> dict[str, Any]:
        if sys.platform != "darwin":
            raise HTTPException(status_code=400, detail="Injecting prompts requires macOS.")
        try:
            return bridge_daemon.kickoff(debate_id, store)
        except ValueError as error:
            _raise_for(error)
            raise

    @app.post("/api/bridge/start")
    def start_bridge() -> dict[str, Any]:
        status = bridge_status()
        if status["running"]:
            return status
        bridge_daemon.start_daemon()
        return bridge_status()

    @app.post("/api/agents/{participant}/launch", status_code=201)
    def launch_agent(participant: str, body: LaunchRequest | None = None) -> dict[str, Any]:
        if participant not in AGENT_COMMANDS:
            raise HTTPException(status_code=404, detail=f"Unknown participant: {participant}")
        if sys.platform != "darwin":
            raise HTTPException(status_code=400, detail="Launching terminals requires macOS.")
        model = normalize_model(body.model if body else None)
        registration = store.registration(participant)
        app_name = registration["app"] if registration else terminal.detect_app()
        command = launch_command(participant, model)
        try:
            terminal.launch(app_name, command)
        except Exception as exc:
            # A stale registration can name an app that is gone; Terminal always exists on macOS.
            if app_name != "Terminal":
                try:
                    terminal.launch("Terminal", command)
                    return {"launched": True, "app": "Terminal", "participant": participant}
                except Exception as retry_exc:
                    exc = retry_exc
                    app_name = "Terminal"
            detail = getattr(exc, "stderr", "") or str(exc)
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Couldn't open {app_name}: {detail.strip()} — check System Settings → "
                    "Privacy & Security → Automation."
                ),
            )
        return {"launched": True, "app": app_name, "participant": participant}

    @app.get("/api/events")
    async def events() -> StreamingResponse:
        async def stream() -> AsyncIterator[str]:
            conn = sqlite3.connect(store.path, timeout=5)
            try:
                last_version: int | None = None
                last_bridge: bool | None = None
                last_agents: str | None = None
                since_heartbeat = 0.0
                since_agent_check = AGENT_CHECK_SECONDS
                agent_state = "unknown"
                while True:
                    version = conn.execute("PRAGMA data_version").fetchone()[0]
                    bridge = bridge_status()
                    if since_agent_check >= AGENT_CHECK_SECONDS:
                        agent_state = json.dumps(
                            {name: status["running"] for name, status in agents().items()}
                        )
                        since_agent_check = 0.0
                    changed = (
                        version != last_version
                        or bridge["running"] != last_bridge
                        or agent_state != last_agents
                    )
                    if changed or since_heartbeat >= HEARTBEAT_SECONDS:
                        kind = "change" if changed else "heartbeat"
                        payload = json.dumps({"bridge": bridge})
                        yield f"event: {kind}\ndata: {payload}\n\n"
                        last_version = version
                        last_bridge = bridge["running"]
                        last_agents = agent_state
                        since_heartbeat = 0.0
                    await asyncio.sleep(POLL_SECONDS)
                    since_heartbeat += POLL_SECONDS
                    since_agent_check += POLL_SECONDS
            finally:
                conn.close()

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    ui = webui_dir()
    if ui.exists():
        app.mount("/assets", StaticFiles(directory=ui / "assets"), name="assets")

        @app.get("/")
        def index() -> FileResponse:
            return FileResponse(ui / "index.html")

    return app


def main() -> None:
    parser = argparse.ArgumentParser(prog="debate-web")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8710)
    args = parser.parse_args()

    import uvicorn

    uvicorn.run(create_app(), host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
