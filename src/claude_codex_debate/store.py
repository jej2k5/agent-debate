from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class DebateStore:
    def __init__(self, path: str | Path):
        self.path = str(path)
        self.initialize()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def initialize(self) -> None:
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS debates (
                    id TEXT PRIMARY KEY,
                    topic TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'running',
                    current_turn TEXT NOT NULL,
                    resolution_type TEXT,
                    resolution_summary TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS participants (
                    debate_id TEXT NOT NULL,
                    participant TEXT NOT NULL,
                    position TEXT NOT NULL,
                    joined_at TEXT NOT NULL,
                    PRIMARY KEY (debate_id, participant),
                    FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    debate_id TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    recipient TEXT NOT NULL,
                    kind TEXT NOT NULL DEFAULT 'argument',
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    delivered_at TEXT,
                    FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS resolutions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    debate_id TEXT NOT NULL,
                    proposer TEXT NOT NULL,
                    resolution_type TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    responded_at TEXT,
                    FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS terminal_registrations (
                    participant TEXT PRIMARY KEY,
                    app TEXT NOT NULL,
                    tty TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_messages_delivery
                ON messages(recipient, delivered_at, id);
                """
            )

    def create_debate(self, debate_id: str, topic: str, creator: str, position: str, first_speaker: str) -> dict[str, Any]:
        now = utc_now()
        with self.connection() as conn:
            conn.execute(
                "INSERT INTO debates(id, topic, status, current_turn, created_at, updated_at) VALUES(?,?,?,?,?,?)",
                (debate_id, topic, "running", first_speaker, now, now),
            )
            conn.execute(
                "INSERT INTO participants(debate_id, participant, position, joined_at) VALUES(?,?,?,?)",
                (debate_id, creator, position, now),
            )
        return self.status(debate_id)

    def create_debate_shell(self, debate_id: str, topic: str, first_speaker: str = "claude") -> dict[str, Any]:
        """Create a debate with no participants yet; agents join via `join`."""
        if first_speaker not in {"claude", "codex"}:
            raise ValueError("first_speaker must be claude or codex")
        now = utc_now()
        with self.connection() as conn:
            existing = conn.execute("SELECT id FROM debates WHERE id=?", (debate_id,)).fetchone()
            if existing:
                raise ValueError(f"Debate already exists: {debate_id}")
            conn.execute(
                "INSERT INTO debates(id, topic, status, current_turn, created_at, updated_at) VALUES(?,?,?,?,?,?)",
                (debate_id, topic, "running", first_speaker, now, now),
            )
        return self.status(debate_id)

    def join(self, debate_id: str, participant: str, position: str) -> dict[str, Any]:
        with self.connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO participants(debate_id, participant, position, joined_at) VALUES(?,?,?,?)",
                (debate_id, participant, position, utc_now()),
            )
        return self.status(debate_id)

    def send(self, debate_id: str, sender: str, recipient: str, content: str, kind: str = "argument") -> dict[str, Any]:
        now = utc_now()
        with self.connection() as conn:
            row = conn.execute("SELECT status,current_turn FROM debates WHERE id=?", (debate_id,)).fetchone()
            if not row:
                raise ValueError(f"Debate not found: {debate_id}")
            if row["status"] != "running":
                raise ValueError(f"Debate is not running: {row['status']}")
            if row["current_turn"] != sender:
                raise ValueError(f"It is {row['current_turn']}'s turn, not {sender}'s")
            cur = conn.execute(
                "INSERT INTO messages(debate_id,sender,recipient,kind,content,created_at) VALUES(?,?,?,?,?,?)",
                (debate_id, sender, recipient, kind, content, now),
            )
            conn.execute("UPDATE debates SET current_turn=?, updated_at=? WHERE id=?", (recipient, now, debate_id))
            message_id = int(cur.lastrowid)
        return {"message_id": message_id, "debate_id": debate_id, "sender": sender, "recipient": recipient, "content": content}

    def send_moderator(self, debate_id: str, content: str) -> dict[str, Any]:
        """Store a moderator interjection without consuming or flipping the turn.

        Addressed to whichever participant currently holds the floor so the
        bridge nudges the agent that acts next; the other agent sees it in the
        transcript.
        """
        if not content.strip():
            raise ValueError("Interjection content must not be empty")
        now = utc_now()
        with self.connection() as conn:
            row = conn.execute("SELECT status,current_turn FROM debates WHERE id=?", (debate_id,)).fetchone()
            if not row:
                raise ValueError(f"Debate not found: {debate_id}")
            if row["status"] != "running":
                raise ValueError(f"Debate is not running: {row['status']}")
            cur = conn.execute(
                "INSERT INTO messages(debate_id,sender,recipient,kind,content,created_at) VALUES(?,?,?,?,?,?)",
                (debate_id, "moderator", row["current_turn"], "interjection", content, now),
            )
            conn.execute("UPDATE debates SET updated_at=? WHERE id=?", (now, debate_id))
            message_id = int(cur.lastrowid)
        return {
            "message_id": message_id,
            "debate_id": debate_id,
            "sender": "moderator",
            "recipient": row["current_turn"],
            "content": content,
        }

    def inbox(self, debate_id: str, participant: str, mark_read: bool = False) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM messages WHERE debate_id=? AND recipient=? ORDER BY id",
                (debate_id, participant),
            ).fetchall()
            if mark_read and rows:
                conn.execute(
                    "UPDATE messages SET delivered_at=COALESCE(delivered_at,?) WHERE debate_id=? AND recipient=?",
                    (utc_now(), debate_id, participant),
                )
        return [dict(r) for r in rows]

    def pending_deliveries(self) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM messages WHERE delivered_at IS NULL ORDER BY id"
            ).fetchall()
        return [dict(r) for r in rows]

    def mark_delivered(self, message_id: int) -> None:
        with self.connection() as conn:
            conn.execute("UPDATE messages SET delivered_at=? WHERE id=?", (utc_now(), message_id))

    def status(self, debate_id: str) -> dict[str, Any]:
        with self.connection() as conn:
            debate = conn.execute("SELECT * FROM debates WHERE id=?", (debate_id,)).fetchone()
            if not debate:
                raise ValueError(f"Debate not found: {debate_id}")
            participants = conn.execute("SELECT participant,position FROM participants WHERE debate_id=?", (debate_id,)).fetchall()
            pending = conn.execute("SELECT * FROM resolutions WHERE debate_id=? AND status='pending' ORDER BY id DESC LIMIT 1", (debate_id,)).fetchone()
        result = dict(debate)
        result["participants"] = {r["participant"]: r["position"] for r in participants}
        result["pending_resolution"] = dict(pending) if pending else None
        return result

    def list_debates(self) -> list[dict[str, Any]]:
        with self.connection() as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM debates ORDER BY updated_at DESC").fetchall()]

    def list_debates_detailed(self) -> list[dict[str, Any]]:
        """Debates newest-first, each with participants and message counts."""
        with self.connection() as conn:
            debates = [dict(r) for r in conn.execute("SELECT * FROM debates ORDER BY updated_at DESC").fetchall()]
            participants = conn.execute("SELECT debate_id,participant,position FROM participants").fetchall()
            counts = conn.execute(
                "SELECT debate_id, COUNT(*) AS total, SUM(CASE WHEN delivered_at IS NULL THEN 1 ELSE 0 END) AS undelivered"
                " FROM messages GROUP BY debate_id"
            ).fetchall()
            pending = conn.execute(
                "SELECT debate_id, proposer, resolution_type FROM resolutions WHERE status='pending' ORDER BY id"
            ).fetchall()
        pending_map = {
            row["debate_id"]: {"proposer": row["proposer"], "resolution_type": row["resolution_type"]}
            for row in pending
        }
        by_debate: dict[str, dict[str, str]] = {}
        for row in participants:
            by_debate.setdefault(row["debate_id"], {})[row["participant"]] = row["position"]
        count_map = {row["debate_id"]: row for row in counts}
        for debate in debates:
            debate["participants"] = by_debate.get(debate["id"], {})
            row = count_map.get(debate["id"])
            debate["message_count"] = int(row["total"]) if row else 0
            debate["undelivered_count"] = int(row["undelivered"] or 0) if row else 0
            debate["pending_resolution"] = pending_map.get(debate["id"])
        return debates

    def transcript(self, debate_id: str) -> list[dict[str, Any]]:
        with self.connection() as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM messages WHERE debate_id=? ORDER BY id", (debate_id,)).fetchall()]

    def propose_resolution(self, debate_id: str, proposer: str, resolution_type: str, summary: str) -> dict[str, Any]:
        if resolution_type not in {"agreement", "agree_to_disagree"}:
            raise ValueError("resolution_type must be agreement or agree_to_disagree")
        with self.connection() as conn:
            cur = conn.execute(
                "INSERT INTO resolutions(debate_id,proposer,resolution_type,summary,status,created_at) VALUES(?,?,?,?,?,?)",
                (debate_id, proposer, resolution_type, summary, "pending", utc_now()),
            )
        return {"resolution_id": int(cur.lastrowid), "status": "pending"}

    def respond_resolution(self, debate_id: str, participant: str, accept: bool) -> dict[str, Any]:
        now = utc_now()
        with self.connection() as conn:
            row = conn.execute("SELECT * FROM resolutions WHERE debate_id=? AND status='pending' ORDER BY id DESC LIMIT 1", (debate_id,)).fetchone()
            if not row:
                raise ValueError("No pending resolution")
            if row["proposer"] == participant:
                raise ValueError("Proposer cannot respond to its own resolution")
            status = "accepted" if accept else "rejected"
            conn.execute("UPDATE resolutions SET status=?, responded_at=? WHERE id=?", (status, now, row["id"]))
            if accept:
                conn.execute(
                    "UPDATE debates SET status='completed', resolution_type=?, resolution_summary=?, updated_at=? WHERE id=?",
                    (row["resolution_type"], row["summary"], now, debate_id),
                )
        return {"status": status, "debate_status": "completed" if accept else "running"}

    def register_terminal(self, participant: str, app: str, tty: str) -> None:
        with self.connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO terminal_registrations(participant,app,tty,updated_at) VALUES(?,?,?,?)",
                (participant, app, tty, utc_now()),
            )

    def registration(self, participant: str) -> dict[str, Any] | None:
        with self.connection() as conn:
            row = conn.execute("SELECT * FROM terminal_registrations WHERE participant=?", (participant,)).fetchone()
        return dict(row) if row else None
