from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from .config import db_path
from .store import DebateStore

mcp = FastMCP("claude-codex-debate")
store = DebateStore(db_path())


@mcp.tool()
def debate_create(debate_id: str, topic: str, creator: str, position: str, first_speaker: str) -> dict:
    """Create a debate. Display the selected position before calling this tool."""
    return store.create_debate(debate_id, topic, creator, position, first_speaker)


@mcp.tool()
def debate_join(debate_id: str, participant: str, position: str) -> dict:
    """Join a debate with an independently selected position, displayed before this call."""
    return store.join(debate_id, participant, position)


@mcp.tool()
def debate_send(debate_id: str, sender: str, recipient: str, content: str) -> dict:
    """Submit the exact argument already displayed in the sender's terminal."""
    return store.send(debate_id, sender, recipient, content)


@mcp.tool()
def debate_inbox(debate_id: str, participant: str) -> list[dict]:
    """Return messages addressed to a participant without blocking."""
    return store.inbox(debate_id, participant, mark_read=True)


@mcp.tool()
def debate_status(debate_id: str) -> dict:
    return store.status(debate_id)


@mcp.tool()
def debate_transcript(debate_id: str) -> list[dict]:
    return store.transcript(debate_id)


@mcp.tool()
def debate_propose_resolution(debate_id: str, proposer: str, resolution_type: str, summary: str) -> dict:
    """Propose either agreement or agree_to_disagree for peer acceptance."""
    return store.propose_resolution(debate_id, proposer, resolution_type, summary)


@mcp.tool()
def debate_respond_resolution(debate_id: str, participant: str, accept: bool) -> dict:
    return store.respond_resolution(debate_id, participant, accept)


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
