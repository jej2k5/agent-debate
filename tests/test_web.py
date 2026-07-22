import tempfile
import unittest
from pathlib import Path
from unittest import mock

from claude_codex_debate import bridge
from claude_codex_debate.bridge import continuation_prompt, kickoff, kickoff_prompt
from claude_codex_debate.store import DebateStore

try:
    from fastapi.testclient import TestClient

    from claude_codex_debate.web import create_app

    HAS_WEB = True
except ImportError:
    HAS_WEB = False


class ModeratorStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = DebateStore(Path(self.tmp.name) / "test.db")

    def tearDown(self):
        self.tmp.cleanup()

    def test_shell_then_join_flow(self):
        self.store.create_debate_shell("d1", "topic", first_speaker="claude")
        status = self.store.status("d1")
        self.assertEqual(status["participants"], {})
        self.assertEqual(status["current_turn"], "claude")
        self.store.join("d1", "claude", "A")
        self.store.join("d1", "codex", "B")
        self.store.send("d1", "claude", "codex", "argument")
        self.assertEqual(self.store.status("d1")["current_turn"], "codex")

    def test_shell_rejects_duplicate_id(self):
        self.store.create_debate_shell("d1", "topic")
        with self.assertRaises(ValueError):
            self.store.create_debate_shell("d1", "other topic")

    def test_shell_rejects_unknown_first_speaker(self):
        with self.assertRaises(ValueError):
            self.store.create_debate_shell("d1", "topic", first_speaker="hal")

    def test_interjection_does_not_flip_turn(self):
        self.store.create_debate_shell("d1", "topic", first_speaker="claude")
        result = self.store.send_moderator("d1", "steer toward cost analysis")
        self.assertEqual(result["recipient"], "claude")
        self.assertEqual(self.store.status("d1")["current_turn"], "claude")

    def test_interjection_targets_current_turn_holder(self):
        self.store.create_debate_shell("d1", "topic", first_speaker="claude")
        self.store.join("d1", "claude", "A")
        self.store.join("d1", "codex", "B")
        self.store.send("d1", "claude", "codex", "argument")
        result = self.store.send_moderator("d1", "consider security")
        self.assertEqual(result["recipient"], "codex")
        inbox = self.store.inbox("d1", "codex")
        self.assertEqual([m["kind"] for m in inbox], ["argument", "interjection"])

    def test_interjection_is_pending_delivery(self):
        self.store.create_debate_shell("d1", "topic")
        self.store.send_moderator("d1", "note")
        pending = self.store.pending_deliveries()
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["sender"], "moderator")

    def test_interjection_rejected_when_not_running(self):
        self.store.create_debate_shell("d1", "topic", first_speaker="claude")
        self.store.join("d1", "claude", "A")
        self.store.join("d1", "codex", "B")
        self.store.propose_resolution("d1", "claude", "agreement", "done")
        self.store.respond_resolution("d1", "codex", True)
        with self.assertRaises(ValueError):
            self.store.send_moderator("d1", "too late")

    def test_interjection_rejects_empty_content(self):
        self.store.create_debate_shell("d1", "topic")
        with self.assertRaises(ValueError):
            self.store.send_moderator("d1", "   ")

    def test_moderator_continuation_prompt(self):
        msg = {"recipient": "codex", "debate_id": "d1", "sender": "moderator"}
        prompt = continuation_prompt(msg)
        self.assertIn("moderator interjection", prompt)
        self.assertIn("$debate-peer", prompt)

    def test_list_debates_detailed_pending_resolution(self):
        self.store.create_debate_shell("d1", "topic")
        self.store.join("d1", "claude", "A")
        self.store.join("d1", "codex", "B")
        rows = self.store.list_debates_detailed()
        self.assertIsNone(rows[0]["pending_resolution"])
        self.store.propose_resolution("d1", "claude", "agreement", "done")
        rows = self.store.list_debates_detailed()
        self.assertEqual(
            rows[0]["pending_resolution"],
            {"proposer": "claude", "resolution_type": "agreement"},
        )
        self.store.respond_resolution("d1", "codex", True)
        rows = self.store.list_debates_detailed()
        self.assertIsNone(rows[0]["pending_resolution"])

    def test_list_debates_detailed_counts(self):
        self.store.create_debate_shell("d1", "topic")
        self.store.join("d1", "claude", "A")
        self.store.join("d1", "codex", "B")
        self.store.send("d1", "claude", "codex", "argument")
        self.store.send_moderator("d1", "note")
        rows = self.store.list_debates_detailed()
        self.assertEqual(rows[0]["message_count"], 2)
        self.assertEqual(rows[0]["undelivered_count"], 2)
        self.assertEqual(rows[0]["participants"], {"claude": "A", "codex": "B"})


class KickoffTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = DebateStore(Path(self.tmp.name) / "test.db")
        self.store.create_debate_shell("d1", "uv vs pip", first_speaker="claude")

    def tearDown(self):
        self.tmp.cleanup()

    def test_first_speaker_prompt_tells_claude_to_open(self):
        debate = self.store.status("d1")
        prompt = kickoff_prompt(debate, "claude")
        self.assertIn("the debate-peer skill", prompt)
        self.assertIn("You speak first", prompt)
        self.assertIn("uv vs pip", prompt)

    def test_second_speaker_prompt_tells_codex_to_wait(self):
        debate = self.store.status("d1")
        prompt = kickoff_prompt(debate, "codex")
        self.assertIn("$debate-peer", prompt)
        self.assertIn("claude opens", prompt)
        self.assertNotIn("You speak first", prompt)

    def test_kickoff_injects_into_both_registered_terminals(self):
        self.store.register_terminal("claude", "Terminal", "/dev/ttys001")
        self.store.register_terminal("codex", "iTerm2", "/dev/ttys002")
        with mock.patch.object(bridge, "inject") as fake_inject:
            result = kickoff("d1", self.store)
        self.assertEqual(fake_inject.call_count, 2)
        self.assertTrue(result["results"]["claude"]["injected"])
        self.assertTrue(result["results"]["codex"]["injected"])

    def test_kickoff_skips_unregistered_agent(self):
        self.store.register_terminal("claude", "Terminal", "/dev/ttys001")
        with mock.patch.object(bridge, "inject") as fake_inject:
            result = kickoff("d1", self.store)
        self.assertEqual(fake_inject.call_count, 1)
        self.assertTrue(result["results"]["claude"]["injected"])
        self.assertFalse(result["results"]["codex"]["injected"])
        self.assertEqual(result["results"]["codex"]["reason"], "terminal not registered")

    def test_kickoff_reports_injection_failure_without_aborting(self):
        self.store.register_terminal("claude", "Terminal", "/dev/ttys001")
        self.store.register_terminal("codex", "Terminal", "/dev/ttys002")
        with mock.patch.object(bridge, "inject", side_effect=[RuntimeError("no tab"), None]):
            result = kickoff("d1", self.store)
        self.assertFalse(result["results"]["claude"]["injected"])
        self.assertEqual(result["results"]["claude"]["reason"], "no tab")
        self.assertTrue(result["results"]["codex"]["injected"])

    def test_kickoff_rejects_completed_debate(self):
        self.store.join("d1", "claude", "A")
        self.store.join("d1", "codex", "B")
        self.store.propose_resolution("d1", "claude", "agreement", "done")
        self.store.respond_resolution("d1", "codex", True)
        with self.assertRaises(ValueError):
            kickoff("d1", self.store)

    def test_kickoff_rejects_unknown_debate(self):
        with self.assertRaises(ValueError):
            kickoff("nope", self.store)


@unittest.skipUnless(HAS_WEB, "fastapi/httpx not installed; install with pip install -e .[web]")
class WebApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "test.db"
        self.client = TestClient(create_app(self.db))
        self.store = DebateStore(self.db)

    def tearDown(self):
        self.tmp.cleanup()

    def test_create_and_fetch_debate(self):
        response = self.client.post(
            "/api/debates", json={"debate_id": "arch-001", "topic": "Monolith vs microservices"}
        )
        self.assertEqual(response.status_code, 201)
        detail = self.client.get("/api/debates/arch-001").json()
        self.assertEqual(detail["debate"]["topic"], "Monolith vs microservices")
        self.assertEqual(detail["messages"], [])

    def test_create_duplicate_conflicts(self):
        self.client.post("/api/debates", json={"debate_id": "d1", "topic": "t"})
        response = self.client.post("/api/debates", json={"debate_id": "d1", "topic": "t"})
        self.assertEqual(response.status_code, 409)

    def test_unknown_debate_is_404(self):
        self.assertEqual(self.client.get("/api/debates/nope").status_code, 404)

    def test_interject_endpoint(self):
        self.client.post("/api/debates", json={"debate_id": "d1", "topic": "t"})
        response = self.client.post("/api/debates/d1/interject", json={"content": "focus on cost"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["sender"], "moderator")
        messages = self.client.get("/api/debates/d1").json()["messages"]
        self.assertEqual(messages[0]["kind"], "interjection")

    def test_export_transcript_returns_markdown_attachment(self):
        self.client.post("/api/debates", json={"debate_id": "d1", "topic": "Monolith vs microservices"})
        self.store.join("d1", "claude", "A")
        self.store.join("d1", "codex", "B")
        self.store.send("d1", "claude", "codex", "First argument.")
        response = self.client.get("/api/debates/d1/transcript.md")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/markdown", response.headers["content-type"])
        self.assertIn('filename="d1.md"', response.headers["content-disposition"])
        self.assertIn("# Debate: Monolith vs microservices", response.text)
        self.assertIn("First argument.", response.text)

    def test_export_transcript_unknown_debate_is_404(self):
        self.assertEqual(self.client.get("/api/debates/nope/transcript.md").status_code, 404)

    def test_overview_lists_debates(self):
        self.client.post("/api/debates", json={"debate_id": "d1", "topic": "t"})
        payload = self.client.get("/api/overview").json()
        self.assertEqual(len(payload["debates"]), 1)
        self.assertIn("bridge", payload)

    def test_overview_reports_agent_status(self):
        payload = self.client.get("/api/overview").json()
        self.assertEqual(set(payload["agents"]), {"claude", "codex"})
        self.assertFalse(payload["agents"]["claude"]["registered"])
        self.assertFalse(payload["agents"]["claude"]["running"])

    def test_launch_unknown_participant_is_404(self):
        response = self.client.post("/api/agents/hal/launch")
        self.assertEqual(response.status_code, 404)

    def test_launch_agent_opens_terminal(self):
        with mock.patch("claude_codex_debate.web.sys") as fake_sys, mock.patch(
            "claude_codex_debate.web.terminal"
        ) as fake_terminal:
            fake_sys.platform = "darwin"
            fake_terminal.detect_app.return_value = "Terminal"
            response = self.client.post("/api/agents/claude/launch")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["app"], "Terminal")
        command = fake_terminal.launch.call_args.args[1]
        self.assertIn("register claude", command)
        self.assertTrue(command.endswith("claude"))

    def test_launch_agent_passes_model_flag(self):
        with mock.patch("claude_codex_debate.web.sys") as fake_sys, mock.patch(
            "claude_codex_debate.web.terminal"
        ) as fake_terminal:
            fake_sys.platform = "darwin"
            fake_terminal.detect_app.return_value = "Terminal"
            response = self.client.post("/api/agents/claude/launch", json={"model": "opus"})
        self.assertEqual(response.status_code, 201)
        command = fake_terminal.launch.call_args.args[1]
        self.assertTrue(command.endswith("claude --model opus"))

    def test_launch_agent_rejects_unsafe_model(self):
        with mock.patch("claude_codex_debate.web.sys") as fake_sys, mock.patch(
            "claude_codex_debate.web.terminal"
        ) as fake_terminal:
            fake_sys.platform = "darwin"
            fake_terminal.detect_app.return_value = "Terminal"
            response = self.client.post(
                "/api/agents/claude/launch", json={"model": "opus; rm -rf /"}
            )
        self.assertEqual(response.status_code, 400)
        fake_terminal.launch.assert_not_called()

    def test_launch_agent_blank_model_uses_default(self):
        with mock.patch("claude_codex_debate.web.sys") as fake_sys, mock.patch(
            "claude_codex_debate.web.terminal"
        ) as fake_terminal:
            fake_sys.platform = "darwin"
            fake_terminal.detect_app.return_value = "Terminal"
            response = self.client.post("/api/agents/codex/launch", json={"model": "  "})
        self.assertEqual(response.status_code, 201)
        command = fake_terminal.launch.call_args.args[1]
        self.assertTrue(command.endswith("&& codex"))
        self.assertNotIn("--model", command)

    def test_launch_failure_reports_automation_hint(self):
        with mock.patch("claude_codex_debate.web.sys") as fake_sys, mock.patch(
            "claude_codex_debate.web.terminal"
        ) as fake_terminal:
            fake_sys.platform = "darwin"
            fake_terminal.detect_app.return_value = "Terminal"
            fake_terminal.launch.side_effect = RuntimeError("not authorized")
            response = self.client.post("/api/agents/claude/launch")
        self.assertEqual(response.status_code, 502)
        self.assertIn("Automation", response.json()["detail"])

    def test_kickoff_endpoint_injects_into_registered_terminals(self):
        self.client.post("/api/debates", json={"debate_id": "d1", "topic": "t"})
        self.store.register_terminal("claude", "Terminal", "/dev/ttys001")
        self.store.register_terminal("codex", "Terminal", "/dev/ttys002")
        with mock.patch("claude_codex_debate.web.sys") as fake_sys, mock.patch(
            "claude_codex_debate.bridge.inject"
        ) as fake_inject:
            fake_sys.platform = "darwin"
            response = self.client.post("/api/debates/d1/kickoff")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(fake_inject.call_count, 2)
        self.assertTrue(response.json()["results"]["claude"]["injected"])

    def test_kickoff_endpoint_unknown_debate_is_404(self):
        with mock.patch("claude_codex_debate.web.sys") as fake_sys:
            fake_sys.platform = "darwin"
            response = self.client.post("/api/debates/nope/kickoff")
        self.assertEqual(response.status_code, 404)

    def test_kickoff_endpoint_requires_macos(self):
        self.client.post("/api/debates", json={"debate_id": "d1", "topic": "t"})
        with mock.patch("claude_codex_debate.web.sys") as fake_sys:
            fake_sys.platform = "linux"
            response = self.client.post("/api/debates/d1/kickoff")
        self.assertEqual(response.status_code, 400)

    def test_start_bridge_endpoint(self):
        with mock.patch("claude_codex_debate.web.bridge_daemon") as fake_daemon, mock.patch(
            "claude_codex_debate.web.bridge_status", return_value={"running": False, "pid": None}
        ):
            response = self.client.post("/api/bridge/start")
        self.assertEqual(response.status_code, 200)
        self.assertIn("running", response.json())
        fake_daemon.start_daemon.assert_called_once()

    def test_start_bridge_noop_when_already_running(self):
        with mock.patch("claude_codex_debate.web.bridge_daemon") as fake_daemon, mock.patch(
            "claude_codex_debate.web.bridge_status", return_value={"running": True, "pid": 123}
        ):
            response = self.client.post("/api/bridge/start")
        self.assertEqual(response.json()["pid"], 123)
        fake_daemon.start_daemon.assert_not_called()


@unittest.skipUnless(HAS_WEB, "fastapi/httpx not installed; install with pip install -e .[web]")
class LaunchCommandTests(unittest.TestCase):
    def test_launch_command_registers_then_runs_agent(self):
        from claude_codex_debate.web import launch_command

        with mock.patch.dict("os.environ", {}, clear=False):
            for var in ("DEBATE_DATA_DIR", "DEBATE_DB"):
                import os

                os.environ.pop(var, None)
            command = launch_command("codex")
        self.assertIn("register codex", command)
        self.assertTrue(command.endswith("&& codex"))
        self.assertNotIn("export", command)

    def test_launch_command_propagates_data_env(self):
        from claude_codex_debate.web import launch_command

        with mock.patch.dict("os.environ", {"DEBATE_DB": "/tmp/x.db"}):
            command = launch_command("claude")
        self.assertIn("export DEBATE_DB=/tmp/x.db", command)

    def test_launch_command_appends_model_flag(self):
        from claude_codex_debate.web import launch_command

        command = launch_command("claude", "sonnet")
        self.assertTrue(command.endswith("claude --model sonnet"))

    def test_normalize_model_validates_and_defaults(self):
        from claude_codex_debate.web import normalize_model

        self.assertIsNone(normalize_model(None))
        self.assertIsNone(normalize_model("   "))
        self.assertEqual(normalize_model("gpt-5.2-codex"), "gpt-5.2-codex")


if __name__ == "__main__":
    unittest.main()
