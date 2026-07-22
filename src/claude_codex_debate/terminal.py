from __future__ import annotations

import os
import subprocess


def detect_app() -> str:
    script = '''
    tell application "System Events"
      set frontName to name of first application process whose frontmost is true
    end tell
    return frontName
    '''
    try:
        name = subprocess.check_output(["osascript", "-e", script], text=True).strip()
    except Exception:
        name = "Terminal"
    if "iTerm" in name:
        return "iTerm2"
    return "Terminal"


def launch(app: str, command: str) -> None:
    """Open a new tab/window in the given terminal app and run a command."""
    safe = command.replace("\\", "\\\\").replace('"', '\\"')
    if app == "iTerm2":
        script = f'''
        tell application "iTerm2"
          activate
          set newWindow to (create window with default profile)
          tell current session of newWindow
            write text "{safe}"
          end tell
        end tell
        '''
    else:
        script = f'''
        tell application "Terminal"
          activate
          do script "{safe}"
        end tell
        '''
    subprocess.run(["osascript", "-e", script], check=True, capture_output=True, text=True)


def tty_has_process(tty: str, executable: str) -> bool:
    """True if a process for `executable` (matched by token basename) is attached to the TTY."""
    short = tty.replace("/dev/", "")
    try:
        output = subprocess.check_output(["ps", "-t", short, "-o", "command="], text=True)
    except subprocess.CalledProcessError:
        return False
    for line in output.splitlines():
        for token in line.split():
            if token.rsplit("/", 1)[-1] == executable:
                return True
    return False


# Seconds to wait after the text lands before the explicit submit Return. The
# text arrives as one paste; TUIs in bracketed-paste mode (Claude Code, Codex,
# most modern CLIs) treat a newline *inside* that paste as a literal line, not a
# submit. Sending Return as a separate event after the paste closes is what
# actually submits. Override with DEBATE_SUBMIT_DELAY if a machine needs longer.
SUBMIT_DELAY = float(os.environ.get("DEBATE_SUBMIT_DELAY", "0.5"))


def inject(app: str, tty: str, text: str, submit: bool = True) -> None:
    """Deliver text to a registered terminal tab and (by default) submit it.

    `submit` sends an explicit Return as a distinct event after the text, so
    bracketed-paste TUIs run the prompt instead of leaving it in the input box.
    """
    safe = text.replace("\\", "\\\\").replace('"', '\\"')
    safe_tty = tty.replace("/dev/", "")
    if app == "iTerm2":
        # `write text` appends a newline; the extra bare `write text ""` sends a
        # second Return that submits if the paste's own newline was absorbed.
        submit_step = f"delay {SUBMIT_DELAY}\n                  tell s to write text \"\"" if submit else ""
        script = f'''
        tell application "iTerm2"
          activate
          repeat with w in windows
            repeat with t in tabs of w
              repeat with s in sessions of t
                if tty of s is "{safe_tty}" or tty of s is "{tty}" then
                  select t
                  tell s to write text "{safe}"
                  {submit_step}
                  return
                end if
              end repeat
            end repeat
          end repeat
        end tell
        error "No iTerm2 session found for TTY {safe_tty}"
        '''
    else:
        # Terminal's `do script` always appends a Return; the extra bare Return
        # is a no-op empty Enter if the paste's own newline already submitted.
        submit_step = f"delay {SUBMIT_DELAY}\n                do script \"\" in t" if submit else ""
        script = f'''
        tell application "Terminal"
          activate
          repeat with w in windows
            repeat with t in tabs of w
              if tty of t is "{tty}" or tty of t is "{safe_tty}" then
                set selected tab of w to t
                do script "{safe}" in t
                {submit_step}
                return
              end if
            end repeat
          end repeat
        end tell
        error "No Terminal tab found for TTY {tty}"
        '''
    subprocess.run(["osascript", "-e", script], check=True, capture_output=True, text=True)
