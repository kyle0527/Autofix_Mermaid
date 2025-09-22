#!/usr/bin/env python3
"""Generate a static asset bundle (index.html + ui.js + data.js)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from exporter import DEFAULT_TITLE, generate_asset_bundle, load_history_data


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate the static history viewer asset pack."
    )
    parser.add_argument("input", help="Path to the history JSON file.")
    parser.add_argument(
        "output",
        help="Directory to write the generated files (index.html, ui.js, data.js).",
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

    bundle = generate_asset_bundle(history, title=args.title or DEFAULT_TITLE)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    for name, content in bundle.items():
        path = output_dir / name
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path}")

    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry
    raise SystemExit(main())
