"""Tests for the History UI export commands."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from autofix.cli import export_ui, export_ui_static



@pytest.fixture()
def sample_history(tmp_path: Path) -> Path:
    data = {
": "1.0",
        "project": {"name": "Demo Project", "created_at": "2024-05-10T12:34:56Z"},
        "run_metadata": {
            "branch": "main",
            "commit": "abcdef1234567890",
            "tool_versions": {
                "autofix": "3.4.0",
                "ui": "1.0.0",
                "mermaid": "10.6.1",
            },
        },

        "runs": [
            {
                "run_id": "run-001",
                "summary": {"targets": 2, "issues_found": 1, "duration_sec": 12.5},

                    {
                        "id": "req-1",
                        "request": {
                            "method": "GET",

                            "url": "https://example.com/api?token=abc123&safe=value",
                            "headers": {
                                "Accept": "application/json",
                                "Authorization": "Bearer super-secret-token",
                                "Cookie": "sessionid=abcdef"
                            },

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

                        },
                        "response": {
                            "status": 401,
                            "headers": {"Content-Type": "application/json"},
{
                        "id": "req-3",
                        "request": {
                            "method": "PATCH",

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



def test_prepare_history_payload_redacts_sensitive_values(sample_history: Path) -> None:
    raw = json.loads(sample_history.read_text(encoding="utf-8"))
    payload = prepare_history_payload(raw)
    assert payload["schema_version"] == "1.2"
    tool_versions = payload["run_metadata"]["tool_versions"]
    assert tool_versions["ui"] == "1.2.0"
    run = payload["runs"][0]
    entry = run["history_proxy"][0]
    request = entry["request"]
    assert request["headers"]["Authorization"] == "[redacted]"
    assert request["headers"]["Cookie"] == "[redacted]"
    assert "redacted" in (request["url"] or "")
    assert "body" not in request
    repeater_request = run["history_repeater"][0]["request"]
    assert repeater_request.get("body_blob") in run["blobs"]
    assert len(repeater_request.get("body_preview", "")) <= 2048
    response = run["history_proxy"][1]["response"]
    assert "body_preview" in response



def test_export_single_file_creates_html(tmp_path: Path, sample_history: Path) -> None:
    output = tmp_path / "dist/ui/history-viewer.html"
    export_ui.main(["--single", str(output), "--data", str(sample_history)])
    assert output.exists()
    html = output.read_text(encoding="utf-8")
    assert "window.HISTORY_DATA" in html

    assert '"schema_version": "1.2"' in html
    assert '"history_proxy"' in html
    assert "Proxy entries" in html
    assert "Keyboard shortcuts" in html
    assert "status-banner" in html



def test_export_static_bundle_creates_assets(tmp_path: Path, sample_history: Path) -> None:
    out_dir = tmp_path / "dist/ui"
    export_ui_static.main(["--out", str(out_dir), "--data", str(sample_history)])
    index_file = out_dir / "index.html"
    ui_js = out_dir / "ui.js"
    ui_css = out_dir / "ui.css"
    data_js = out_dir / "data.js"

    for file in (index_file, ui_js, ui_css, data_js):
        assert file.exists(), f"{file} was not created"


    data_js_text = data_js.read_text(encoding="utf-8")
    ui_js_text = ui_js.read_text(encoding="utf-8")

    assert "window.HISTORY_DATA" in data_js_text
    assert '"history_repeater"' in data_js_text
    assert '"schema_version": "1.2"' in data_js_text
    assert "[redacted]" in data_js_text
    assert "body_blob" in data_js_text
    assert "expand-all" in ui_js_text
    assert "collapse-all" in ui_js_text
    assert "copy-summary" in ui_js_text
    assert "copy-run" in ui_js_text
    assert "copy-urls" in ui_js_text
    assert "export-runlist" in ui_js_text
    assert "setAttribute('data-action', 'filter')" in ui_js_text
    assert "data-page-size" in ui_js_text
    assert "autofix.history.views" in ui_js_text
    assert "Save view" in ui_js_text
    assert "Navigate entries" in ui_js_text
    assert "data.js" in index_file.read_text(encoding="utf-8")

    # Combined verification script should succeed for generated assets once the single file exists.
    export_ui.main(["--single", str(out_dir / "history-viewer.html"), "--data", str(sample_history)])
    verify_history_ui(out_dir, out_dir / "history-viewer.html")

