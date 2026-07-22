import tempfile
import unittest
from pathlib import Path

from claude_codex_debate.store import DebateStore
from claude_codex_debate.transcript import render_markdown


class TranscriptMarkdownTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = DebateStore(Path(self.tmp.name) / "test.db")

    def tearDown(self):
        self.tmp.cleanup()

    def _render(self, debate_id):
        return render_markdown(self.store.status(debate_id), self.store.transcript(debate_id))

    def test_header_lists_topic_id_and_positions(self):
        self.store.create_debate_shell("d1", "uv vs pip", first_speaker="claude")
        self.store.join("d1", "claude", "uv is the better default")
        self.store.join("d1", "codex", "pip remains the safe baseline")
        md = self._render("d1")
        self.assertIn("# Debate: uv vs pip", md)
        self.assertIn("- **Debate ID:** `d1`", md)
        self.assertIn('- **Claude:** "uv is the better default"', md)
        self.assertIn('- **Codex:** "pip remains the safe baseline"', md)

    def test_messages_render_as_numbered_sections(self):
        self.store.create_debate_shell("d1", "topic", first_speaker="claude")
        self.store.join("d1", "claude", "A")
        self.store.join("d1", "codex", "B")
        self.store.send("d1", "claude", "codex", "Opening argument here.")
        self.store.send("d1", "codex", "claude", "Rebuttal here.")
        md = self._render("d1")
        self.assertIn("## Message 1 — Claude → Codex (", md)
        self.assertIn("Opening argument here.", md)
        self.assertIn("## Message 2 — Codex → Claude (", md)
        self.assertIn("Rebuttal here.", md)

    def test_interjection_is_tagged(self):
        self.store.create_debate_shell("d1", "topic", first_speaker="claude")
        self.store.send_moderator("d1", "Consider total cost of ownership.")
        md = self._render("d1")
        self.assertIn("Moderator → Claude (interjection)", md)
        self.assertIn("Consider total cost of ownership.", md)

    def test_completed_debate_includes_outcome_and_resolution(self):
        self.store.create_debate_shell("d1", "topic", first_speaker="claude")
        self.store.join("d1", "claude", "A")
        self.store.join("d1", "codex", "B")
        self.store.propose_resolution("d1", "claude", "agreement", "We converged on a shared rule.")
        self.store.respond_resolution("d1", "codex", True)
        md = self._render("d1")
        self.assertIn("- **Outcome:** Agreement", md)
        self.assertIn("## Resolution — Agreement", md)
        self.assertIn("We converged on a shared rule.", md)

    def test_empty_debate_notes_no_messages(self):
        self.store.create_debate_shell("d1", "topic")
        md = self._render("d1")
        self.assertIn("_No messages yet._", md)

    def test_output_ends_with_single_newline(self):
        self.store.create_debate_shell("d1", "topic")
        md = self._render("d1")
        self.assertTrue(md.endswith("\n"))
        self.assertFalse(md.endswith("\n\n"))


if __name__ == "__main__":
    unittest.main()
