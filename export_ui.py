#!/usr/bin/env python3
"""Generate a single-file history viewer (history-viewer.html)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from exporter import DEFAULT_TITLE, generate_single_file_html, load_history_data


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate an offline history viewer with embedded data."
    )
    parser.add_argument("input", help="Path to the history JSON file.")
    parser.add_argument(
        "output",
        help="Destination HTML file (e.g. history-viewer.html).",
    )
    parser.add_argument(
        "--title",
        help="Optional document title to display in the viewer.",
        default=None,
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        history = load_history_data(args.input)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    html = generate_single_file_html(history, title=args.title or DEFAULT_TITLE)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry
    raise SystemExit(main())
