import tempfile
import unittest
from pathlib import Path

from claude_codex_debate.bridge import continuation_prompt
from claude_codex_debate.store import DebateStore


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = DebateStore(Path(self.tmp.name) / "test.db")

    def tearDown(self):
        self.tmp.cleanup()

    def test_turn_and_delivery(self):
        self.store.create_debate("d1", "topic", "claude", "A", "claude")
        self.store.join("d1", "codex", "B")
        msg = self.store.send("d1", "claude", "codex", "argument")
        self.assertEqual(self.store.status("d1")["current_turn"], "codex")
        self.assertEqual(len(self.store.pending_deliveries()), 1)
        self.store.mark_delivered(msg["message_id"])
        self.assertEqual(self.store.pending_deliveries(), [])

    def test_no_round_limit(self):
        self.store.create_debate("d2", "topic", "claude", "A", "claude")
        self.store.join("d2", "codex", "B")
        for i in range(60):
            sender = "claude" if i % 2 == 0 else "codex"
            recipient = "codex" if sender == "claude" else "claude"
            self.store.send("d2", sender, recipient, f"m{i}")
        self.assertEqual(self.store.status("d2")["status"], "running")

    def test_resolution_handshake(self):
        self.store.create_debate("d3", "topic", "claude", "A", "claude")
        self.store.join("d3", "codex", "B")
        self.store.propose_resolution("d3", "claude", "agreement", "shared conclusion")
        result = self.store.respond_resolution("d3", "codex", True)
        self.assertEqual(result["debate_status"], "completed")

    def test_prompt_targets_correct_skill(self):
        msg = {"recipient": "codex", "debate_id": "d1"}
        self.assertIn("$debate-peer", continuation_prompt(msg))


if __name__ == "__main__":
    unittest.main()
