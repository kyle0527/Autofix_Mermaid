"""Export the Autofix History UI as a static asset bundle."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Sequence

from autofix.ui import write_static_bundle


def _load_history_data(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(f"History data file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Export the Autofix History UI as a static asset bundle that can be opened "
            "directly via file:// URLs."
        )
    )
    parser.add_argument(
        "--out",
        required=True,
        type=Path,
        help="Directory to place the exported assets (e.g. dist/ui).",
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
    output_dir = write_static_bundle(data, args.out)
    print(f"History UI assets exported to {output_dir}")
    return 0


if __name__ == "__main__":  # pragma: no cover - entry point
    raise SystemExit(main())
