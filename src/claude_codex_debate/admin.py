from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import db_path
from .store import DebateStore
from .transcript import render_markdown


def main() -> None:
    parser = argparse.ArgumentParser(prog="debate-admin")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list")
    status = sub.add_parser("status")
    status.add_argument("debate_id")
    transcript = sub.add_parser("transcript")
    transcript.add_argument("debate_id")
    transcript.add_argument(
        "--format", choices=["json", "md"], default="json", help="output format (default: json)"
    )
    transcript.add_argument("--out", help="write to this file instead of stdout")
    args = parser.parse_args()
    store = DebateStore(db_path())

    if args.command == "list":
        print(json.dumps(store.list_debates(), indent=2))
        return
    if args.command == "status":
        print(json.dumps(store.status(args.debate_id), indent=2))
        return

    messages = store.transcript(args.debate_id)
    if args.format == "md":
        output = render_markdown(store.status(args.debate_id), messages)
    else:
        output = json.dumps(messages, indent=2)
    if args.out:
        Path(args.out).write_text(output, encoding="utf-8")
        print(f"Wrote transcript to {args.out}")
    else:
        print(output)


if __name__ == "__main__":
    main()
