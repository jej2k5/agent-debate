from __future__ import annotations

from datetime import datetime
from typing import Any

_DISPLAY = {"claude": "Claude", "codex": "Codex", "moderator": "Moderator"}


def _display_name(name: str) -> str:
    return _DISPLAY.get(name, name)


def _timestamp(iso: str) -> str:
    """Render an ISO-8601 UTC timestamp as `YYYY-MM-DD HH:MM UTC`, unchanged if unparseable."""
    try:
        return datetime.fromisoformat(iso).strftime("%Y-%m-%d %H:%M UTC")
    except (ValueError, TypeError):
        return iso


def _outcome_label(resolution_type: str | None) -> str:
    return "Agreement" if resolution_type == "agreement" else "Agreed to disagree"


def render_markdown(debate: dict[str, Any], messages: list[dict[str, Any]]) -> str:
    """Format a debate and its messages as a self-contained Markdown transcript.

    `debate` is a `DebateStore.status` dict (topic, status, participants, …);
    `messages` is a `DebateStore.transcript` list. Presentation only — no I/O.
    """
    lines: list[str] = [f"# Debate: {debate.get('topic', debate['id'])}", ""]
    lines.append(f"- **Debate ID:** `{debate['id']}`")
    if debate.get("status") == "completed":
        lines.append(f"- **Outcome:** {_outcome_label(debate.get('resolution_type'))}")
    else:
        lines.append(
            f"- **Status:** {debate.get('status', 'running')} "
            f"(turn: {_display_name(debate.get('current_turn', ''))})"
        )
    lines.append(f"- **Opened:** {_timestamp(debate['created_at'])}")

    participants = debate.get("participants") or {}
    if participants:
        lines.append("- **Participants:**")
        for name in ("claude", "codex"):
            if name in participants:
                lines.append(f'  - **{_display_name(name)}:** "{participants[name]}"')

    lines += ["", "---", ""]

    if not messages:
        lines += ["_No messages yet._", ""]
    for index, message in enumerate(messages, start=1):
        tag = " (interjection)" if message.get("kind") == "interjection" else ""
        header = (
            f"## Message {index} — {_display_name(message['sender'])} → "
            f"{_display_name(message['recipient'])}{tag} ({_timestamp(message['created_at'])})"
        )
        lines += [header, "", message["content"].rstrip(), "", "---", ""]

    if debate.get("status") == "completed" and debate.get("resolution_summary"):
        lines += [
            f"## Resolution — {_outcome_label(debate.get('resolution_type'))}",
            "",
            debate["resolution_summary"].rstrip(),
            "",
        ]

    return "\n".join(lines).rstrip() + "\n"
