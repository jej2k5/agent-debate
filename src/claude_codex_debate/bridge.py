from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from .config import bridge_log_path, bridge_pid_path, db_path
from .store import DebateStore
from .terminal import detect_app, inject

POLL_SECONDS = 0.75


def continuation_prompt(message: dict) -> str:
    skill = "the debate-peer skill" if message["recipient"] == "claude" else "$debate-peer"
    if message.get("sender") == "moderator":
        return (
            f"A moderator interjection is available in debate {message['debate_id']}. "
            f"Use {skill}, call debate_inbox, display the moderator's guidance, and take it into account "
            "in your next argument. The turn order is unchanged."
        )
    return (
        f"A new message is available in debate {message['debate_id']}. "
        f"Use {skill}, call debate_inbox, display the opponent's argument, "
        "display your complete response before submitting it, and continue toward agreement or an explicit agree-to-disagree resolution."
    )


def kickoff_prompt(debate: dict, participant: str) -> str:
    """Opening prompt injected into a terminal to start a fresh debate.

    The turn holder is told to open; the other agent joins and then waits for
    the bridge to nudge it once the opening argument lands.
    """
    skill = "the debate-peer skill" if participant == "claude" else "$debate-peer"
    opponent = "codex" if participant == "claude" else "claude"
    topic = debate["topic"]
    debate_id = debate["id"]
    if debate["current_turn"] == participant:
        return (
            f"Start debate {debate_id} (topic: {topic}). "
            f"Use {skill}: choose your own position, call debate_join with the debate id and that position, "
            f"display your position and your complete opening argument in the terminal, "
            f"then submit the argument with debate_send addressed to {opponent}. You speak first."
        )
    return (
        f"Join debate {debate_id} (topic: {topic}); {opponent} opens. "
        f"Use {skill}: choose your own position, call debate_join with the debate id and that position, and display it. "
        f"Do not call a blocking wait — you will be prompted when {opponent}'s opening argument arrives."
    )


def kickoff(debate_id: str, store: DebateStore | None = None) -> dict:
    """Inject the opening prompt into both agents' registered terminals.

    The bridge only nudges on message *deliveries*, and a fresh debate has no
    messages until the first agent speaks; this is the explicit, human-triggered
    start. Returns a per-participant record of what was injected or skipped.
    """
    store = store or DebateStore(db_path())
    debate = store.status(debate_id)  # raises ValueError for an unknown debate
    if debate["status"] != "running":
        raise ValueError(f"Debate is not running: {debate['status']}")
    results: dict[str, dict] = {}
    for participant in ("claude", "codex"):
        registration = store.registration(participant)
        if not registration:
            results[participant] = {"injected": False, "reason": "terminal not registered"}
            continue
        try:
            inject(registration["app"], registration["tty"], kickoff_prompt(debate, participant))
            results[participant] = {
                "injected": True,
                "app": registration["app"],
                "tty": registration["tty"],
            }
        except Exception as exc:
            detail = getattr(exc, "stderr", "") or str(exc)
            results[participant] = {"injected": False, "reason": detail.strip()}
    return {"debate_id": debate_id, "results": results}


def run_loop() -> None:
    store = DebateStore(db_path())
    while True:
        for message in store.pending_deliveries():
            registration = store.registration(message["recipient"])
            if not registration:
                continue
            try:
                inject(registration["app"], registration["tty"], continuation_prompt(message))
                store.mark_delivered(message["id"])
                print(f"Delivered message {message['id']} to {message['recipient']}", flush=True)
            except Exception as exc:
                print(f"Delivery failed for message {message['id']}: {exc}", flush=True)
        time.sleep(POLL_SECONDS)


def start_daemon() -> int:
    pidfile = bridge_pid_path()
    if pidfile.exists():
        try:
            os.kill(int(pidfile.read_text().strip()), 0)
            print("debate-bridge is already running")
            return 0
        except (ProcessLookupError, ValueError):
            pidfile.unlink(missing_ok=True)
    log = open(bridge_log_path(), "a", buffering=1)
    proc = subprocess.Popen(
        [sys.executable, "-m", "claude_codex_debate.bridge", "run"],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=log,
        start_new_session=True,
    )
    pidfile.write_text(str(proc.pid))
    print(f"debate-bridge started (pid {proc.pid})")
    return 0


def stop_daemon() -> int:
    pidfile = bridge_pid_path()
    if not pidfile.exists():
        print("debate-bridge is not running")
        return 0
    try:
        pid = int(pidfile.read_text().strip())
        os.kill(pid, signal.SIGTERM)
        print(f"debate-bridge stopped (pid {pid})")
    except ProcessLookupError:
        print("stale pid file removed")
    finally:
        pidfile.unlink(missing_ok=True)
    return 0


def status_daemon() -> int:
    pidfile = bridge_pid_path()
    if not pidfile.exists():
        print("stopped")
        return 1
    try:
        pid = int(pidfile.read_text().strip())
        os.kill(pid, 0)
        print(f"running (pid {pid})")
        return 0
    except (ProcessLookupError, ValueError):
        print("stopped (stale pid file)")
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(prog="debate-bridge")
    sub = parser.add_subparsers(dest="command", required=True)
    reg = sub.add_parser("register")
    reg.add_argument("participant", choices=["claude", "codex"])
    reg.add_argument("--app", choices=["Terminal", "iTerm2"])
    sub.add_parser("start")
    sub.add_parser("stop")
    sub.add_parser("status")
    test = sub.add_parser("test")
    test.add_argument("participant", choices=["claude", "codex"])
    kick = sub.add_parser("kickoff")
    kick.add_argument("debate_id")
    sub.add_parser("run")
    args = parser.parse_args()

    if args.command == "register":
        tty = os.ttyname(sys.stdin.fileno())
        app = args.app or detect_app()
        DebateStore(db_path()).register_terminal(args.participant, app, tty)
        print(f"Registered {args.participant}: app={app}, tty={tty}")
    elif args.command == "start":
        raise SystemExit(start_daemon())
    elif args.command == "stop":
        raise SystemExit(stop_daemon())
    elif args.command == "status":
        raise SystemExit(status_daemon())
    elif args.command == "test":
        registration = DebateStore(db_path()).registration(args.participant)
        if not registration:
            raise SystemExit(f"No terminal registration for {args.participant}")
        inject(registration["app"], registration["tty"], f"debate-bridge test delivery for {args.participant}")
        print("Test prompt delivered")
    elif args.command == "kickoff":
        try:
            result = kickoff(args.debate_id)
        except ValueError as exc:
            raise SystemExit(str(exc))
        for participant, info in result["results"].items():
            if info["injected"]:
                print(f"Kicked off {participant} ({info['app']} {info['tty']})")
            else:
                print(f"Skipped {participant}: {info['reason']}")
    elif args.command == "run":
        run_loop()


if __name__ == "__main__":
    main()
