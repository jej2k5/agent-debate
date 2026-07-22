import unittest
from unittest import mock

from claude_codex_debate import terminal


def _script_for(app: str, **kwargs) -> str:
    with mock.patch.object(terminal.subprocess, "run") as run:
        terminal.inject(app, "/dev/ttys009", "join debate d1", **kwargs)
    return run.call_args.args[0][2]  # osascript -e <script>


class InjectSubmitTests(unittest.TestCase):
    def test_terminal_sends_explicit_submit_return(self):
        script = _script_for("Terminal")
        self.assertIn('do script "join debate d1" in t', script)
        # A separate bare Return after the text is what submits in a paste-mode TUI.
        self.assertIn('do script "" in t', script)

    def test_iterm_sends_text_then_a_separate_return(self):
        script = _script_for("iTerm2")
        self.assertIn('write text "join debate d1"', script)
        self.assertIn('write text ""', script)

    def test_submit_false_omits_the_extra_return(self):
        term = _script_for("Terminal", submit=False)
        self.assertNotIn('do script "" in t', term)
        iterm = _script_for("iTerm2", submit=False)
        self.assertIn('write text "join debate d1"', iterm)
        self.assertNotIn('write text ""', iterm)

    def test_delay_precedes_the_submit_return(self):
        script = _script_for("Terminal")
        self.assertIn(f"delay {terminal.SUBMIT_DELAY}", script)

    def test_quotes_and_backslashes_are_escaped(self):
        with mock.patch.object(terminal.subprocess, "run") as run:
            terminal.inject("Terminal", "/dev/ttys009", 'say "hi" \\ bye')
        script = run.call_args.args[0][2]
        self.assertIn('\\"hi\\"', script)
        self.assertIn("\\\\", script)


if __name__ == "__main__":
    unittest.main()
