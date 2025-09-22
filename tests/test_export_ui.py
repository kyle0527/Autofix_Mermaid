"""Tests for the History UI export commands."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from autofix.cli import export_ui, export_ui_static


@pytest.fixture()
def sample_history(tmp_path: Path) -> Path:
    data = {
        "project": {"name": "Demo Project", "created_at": "2024-05-10T12:34:56Z"},
        "runs": [
            {
                "run_id": "run-001",
                "summary": {"targets": 2, "issues_found": 1, "duration_sec": 12.5},
                "history": [
                    {
                        "id": "req-1",
                        "request": {
                            "method": "GET",
                            "url": "https://example.com/api",
                            "headers": {"Accept": "application/json"},
                            "body": "",
                        },
                        "response": {
                            "status": 200,
                            "headers": {"Content-Type": "application/json"},
                            "body_preview": '{"ok": true}',
                        },
                        "tags": ["info"],
                        "ts": "2024-05-10T12:00:00Z",
                    },
                    {
                        "id": "req-2",
                        "request": {
                            "method": "POST",
                            "url": "https://example.com/login",
                            "headers": {"Content-Type": "application/json"},
                            "body": '{"email": "user@example.com"}',
                        },
                        "response": {
                            "status": 401,
                            "headers": {"Content-Type": "application/json"},
                            "body_preview": '{"error": "Unauthorized"}',
                        },
                        "tags": ["auth", "warning"],
                        "ts": "2024-05-10T12:05:00Z",
                    },
                    {
                        "id": "req-3",
                        "request": {
                            "method": "PATCH",
                            "url": "https://example.com/users/1",
                            "headers": {"Content-Type": "application/json"},
                            "body": '{"name": "Ada"}',
                        },
                        "response": {
                            "status": 200,
                            "headers": {"Content-Type": "application/json"},
                            "body_preview": '{"name": "Ada"}',
                        },
                        "tags": ["update"],
                        "ts": "2024-05-10T12:10:00Z",
                    },
                    {
                        "id": "req-4",
                        "request": {
                            "method": "DELETE",
                            "url": "https://example.com/users/2",
                            "headers": {"Authorization": "Bearer token"},
                            "body": "",
                        },
                        "response": {
                            "status": 204,
                            "headers": {"Content-Length": "0"},
                            "body_preview": "",
                        },
                        "tags": ["cleanup"],
                        "ts": "2024-05-10T12:15:00Z",
                    },
                ],
                "issues": [
                    {
                        "id": "issue-1",
                        "title": "Example issue",
                        "severity": "medium",
                        "evidence": {"request_id": "req-2"},
                        "status": "open",
                        "cwe": "CWE-79",
                    }
                ],
                "artifacts": {"mermaid": [{"name": "flow.mmd", "content": "graph TD;"}]},
            }
        ],
    }
    data_path = tmp_path / "autofix_last_run.json"
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data_path


def test_export_single_file_creates_html(tmp_path: Path, sample_history: Path) -> None:
    output = tmp_path / "dist/ui/history-viewer.html"
    export_ui.main(["--single", str(output), "--data", str(sample_history)])
    assert output.exists()
    html = output.read_text(encoding="utf-8")
    assert "window.HISTORY_DATA" in html
    assert '"summary"' in html
    assert '"targets": 2' in html


def test_export_static_bundle_creates_assets(tmp_path: Path, sample_history: Path) -> None:
    out_dir = tmp_path / "dist/ui"
    export_ui_static.main(["--out", str(out_dir), "--data", str(sample_history)])
    index_file = out_dir / "index.html"
    ui_js = out_dir / "ui.js"
    ui_css = out_dir / "ui.css"
    data_js = out_dir / "data.js"

    for file in (index_file, ui_js, ui_css, data_js):
        assert file.exists(), f"{file} was not created"

    assert "window.HISTORY_DATA" in data_js.read_text(encoding="utf-8")
    assert "Recent history" in ui_js.read_text(encoding="utf-8")
    assert "data.js" in index_file.read_text(encoding="utf-8")
