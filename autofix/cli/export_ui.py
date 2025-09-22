"""Export the Autofix History UI as a single HTML file."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Sequence

from autofix.ui import write_single_file_ui


def _load_history_data(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(f"History data file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Export the Autofix History UI as a self-contained HTML file that can be "
            "opened directly from the filesystem."
        )
    )
    parser.add_argument(
        "--single",
        required=True,
        type=Path,
        help="Output path for the generated HTML file (e.g. dist/ui/history-viewer.html).",
    )
    parser.add_argument(
        "--data",
        required=True,
        type=Path,
        help="Path to the autofix_last_run.json file containing history data.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    data = _load_history_data(args.data)
    output = write_single_file_ui(data, args.single)
    print(f"History UI exported to {output}")
    return 0


if __name__ == "__main__":  # pragma: no cover - entry point
    raise SystemExit(main())
