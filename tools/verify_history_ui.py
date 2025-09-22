"""Verify that the exported History UI assets are well-formed."""

from __future__ import annotations

import argparse
from pathlib import Path


class VerificationError(RuntimeError):
    """Raised when the History UI export is incomplete."""


SUMMARY_MARKERS = ["Targets", "Issues found", "History entries"]


def _ensure_exists(path: Path) -> None:
    if not path.exists():
        raise VerificationError(f"Expected file not found: {path}")


def verify_history_ui(base_dir: Path, single_file: Path | None = None) -> None:
    """Validate the generated History UI assets."""

    base_dir = base_dir.expanduser().resolve()
    single_path = (single_file or (base_dir / "history-viewer.html")).expanduser()

    _ensure_exists(single_path)
    single_text = single_path.read_text(encoding="utf-8")
    if "window.HISTORY_DATA" not in single_text:
        raise VerificationError("Single-file HTML is missing window.HISTORY_DATA")
    for marker in SUMMARY_MARKERS:
        if marker not in single_text:
            raise VerificationError(f"Single-file HTML is missing summary marker: {marker}")

    index_path = base_dir / "index.html"
    data_js_path = base_dir / "data.js"
    ui_js_path = base_dir / "ui.js"
    css_path = base_dir / "ui.css"

    for asset in (index_path, data_js_path, ui_js_path, css_path):
        _ensure_exists(asset)

    data_js_text = data_js_path.read_text(encoding="utf-8")
    if "window.HISTORY_DATA" not in data_js_text:
        raise VerificationError("data.js is missing window.HISTORY_DATA assignment")

    ui_js_text = ui_js_path.read_text(encoding="utf-8")
    for marker in SUMMARY_MARKERS:
        if marker not in ui_js_text:
            raise VerificationError(f"ui.js is missing summary marker: {marker}")
    for required in ("setAttribute('data-action', 'filter')", "autofix.history.views"):
        if required not in ui_js_text:
            raise VerificationError(f"ui.js is missing expected marker: {required}")

    index_text = index_path.read_text(encoding="utf-8")
    if "data.js" not in index_text or "ui.js" not in index_text:
        raise VerificationError("index.html does not load data.js/ui.js")


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Verify exported History UI assets.")
    parser.add_argument(
        "--base",
        type=Path,
        default=Path("dist/ui"),
        help="Directory containing the static asset export (default: dist/ui)",
    )
    parser.add_argument(
        "--single",
        type=Path,
        default=None,
        help="Path to the single-file HTML export (default: <base>/history-viewer.html)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_arg_parser()
    args = parser.parse_args(argv)
    try:
        verify_history_ui(args.base, args.single)
    except VerificationError as exc:  # pragma: no cover - exercised via CLI
        print(f"[verify-history-ui] {exc}")
        return 1
    print("[verify-history-ui] History UI export looks good.")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())
