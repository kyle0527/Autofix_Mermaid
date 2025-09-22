# History UI Exporter

The History UI exporter turns the latest Autofix run output (`autofix_last_run.json`) into a
self-contained HTML viewer that can be opened directly from your file manager. The viewer does not
require a local web server and never issues `fetch()` calls, so it works over `file://` URLs on any
platform.

## Quick start

1. Ensure Python 3.9+ is available.
2. Produce a run summary JSON file. The CLI expects a file named `autofix_last_run.json` containing
   the most recent Autofix execution. If you do not have one yet, you can generate a demo file:

   ```bash
   python - <<'PY'
   import json, pathlib
   data = {
       "project": {"name": "Demo", "created_at": "2024-05-10T12:00:00Z"},
       "runs": [{
           "run_id": "demo-run",
           "summary": {"targets": 1, "issues_found": 0, "duration_sec": 3.2},
           "history": [],
           "issues": [],
           "artifacts": {"mermaid": []},
       }],
   }
   pathlib.Path("autofix_last_run.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
   print("Saved autofix_last_run.json")
   PY
   ```

3. Export the UI in either format:
   - Single-file HTML:

     ```bash
     python -m autofix.cli.export_ui --single dist/ui/history-viewer.html --data autofix_last_run.json
     ```

   - Static asset bundle:

     ```bash
     python -m autofix.cli.export_ui_static --out dist/ui --data autofix_last_run.json
     ```

Both commands create the output directories automatically. The generated files are safe to share
internally because all data is embedded via `window.HISTORY_DATA`.

## Opening the viewer

- **Windows** – Locate the generated file (`history-viewer.html` or `index.html`) in File Explorer
  and double-click it. Microsoft Edge/Chrome will open the page via `file://` with the data already
  embedded.
- **macOS** – Open Finder, browse to the `dist/ui/` folder, and double-click the HTML file. Safari
  and Chrome will load it directly from disk.
- **Linux** – From your favourite file manager (Nautilus, Dolphin, Thunar, etc.), double-click the
  HTML file. You can also run `xdg-open dist/ui/history-viewer.html` from the terminal.

No ports, local servers, or additional tooling are required.

## Data contract

The CLI consumes a single JSON file shaped as follows (fields are extensible):

```json
{
  "project": {
    "name": "Example repo",
    "created_at": "2024-05-10T12:34:56Z"
  },
  "runs": [
    {
      "run_id": "run-001",
      "summary": {
        "targets": 2,
        "issues_found": 1,
        "duration_sec": 12.5
      },
      "history": [
        {
          "id": "req-123",
          "request": {
            "method": "GET",
            "url": "https://example.com/api",
            "headers": {
              "Accept": "application/json"
            },
            "body": ""
          },
          "response": {
            "status": 200,
            "headers": {
              "Content-Type": "application/json"
            },
            "body_preview": "{\"ok\": true}"
          },
          "tags": ["info"],
          "ts": "2024-05-10T12:00:00Z"
        }
      ],
      "issues": [
        {
          "id": "issue-1",
          "title": "Example issue",
          "severity": "medium",
          "evidence": {
            "request_id": "req-123"
          },
          "status": "open",
          "cwe": "CWE-79"
        }
      ],
      "artifacts": {
        "mermaid": [
          {"name": "flow.mmd", "content": "graph TD;"}
        ]
      }
    }
  ]
}
```

Large payloads should prefer `response.body_preview` instead of the full body to keep the UI
lightweight. Additional sections (issues, blobs, etc.) can be added alongside these fields without
breaking the viewer.

## Privacy and data hygiene

The exported HTML and asset bundles embed the entire JSON payload. Review the data for secrets or
personally identifiable information before sharing. Remove or mask request/response bodies,
credentials, or headers that are not safe to distribute.
