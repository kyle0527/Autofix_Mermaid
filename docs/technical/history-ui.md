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

       "schema_version": "1.2",
       "project": {"name": "Demo", "created_at": "2024-05-10T12:00:00Z"},
       "run_metadata": {
           "branch": "main",
           "commit": "abcdef1234567890",
           "tool_versions": {
               "autofix": "3.4.0",
               "ui": "1.2.0",
               "mermaid": "10.6.1",
           },
       },
       "runs": [{
           "run_id": "demo-run",
           "summary": {"targets": 1, "issues_found": 0, "duration_sec": 3.2},
           "history_proxy": [{
               "id": "req-1",
               "request": {
                   "method": "GET",
                   "url": "https://example.com/api",
                   "headers": {"Accept": "application/json"},
               },
               "response": {
                   "status": 200,
                   "headers": {"Content-Type": "application/json"},
                   "body_preview": "{\"ok\": true}"
               },
               "tags": ["info"],
               "ts": "2024-05-10T12:00:00Z"
           }],
           "history_repeater": [],
\
       "project": {"name": "Demo", "created_at": "2024-05-10T12:00:00Z"},
       "runs": [{
           "run_id": "demo-run",
           "summary": {"targets": 1, "issues_found": 0, "duration_sec": 3.2},
           "history": [],
\
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

## Viewer controls, filters, and shortcuts

Each run card shows a summary grid (targets, duration, proxy/repeater totals, issue counts) and a
paginated list of history entries. The top filter bar works entirely via delegated events so it is
safe over `file://` and supports:

- **Source/method/status/tag filters** – buttons and drop-downs let you focus on a specific method,
  response bucket (1xx–5xx), tag, or origin (Proxy/Repeater). Clicking a quick filter chip populates
  the underlying select input.
- **Host and path filtering** – narrow the list to a particular host or match parts of the URL path.
- **Preview search** – searches across request/response previews and tags.
- **Saved views** – name the current filter/search combination to store it in `localStorage` and
  recall it later, even after re-opening the viewer.
- **Pinned entries** – keep important requests always visible at the top of the run card. Pinned
  entries expand automatically.
- **Pagination** – adjust the page size (25/50/100/200) to browse thousands of requests without
  rendering every DOM node at once.

Keyboard navigation complements the buttons:

| Action | Button label | Shortcut |
| --- | --- | --- |
| Expand all visible entries | `Expand all` | `Shift+E` |
| Collapse all entries | `Collapse all` | `Shift+W` |
| Copy the run summary | `Copy summary` | `Shift+C` |
| Copy the run JSON payload | `Copy run JSON` | `Shift+J` |
| Copy selected request URLs | `Copy URLs` | `Shift+L` |
| Export selected URLs to `runlist.json` | `Export runlist` | `Shift+X` |
| Move between entries | – | `↑` / `↓` |
| Toggle the focused entry | – | `Enter` / `Space` |
| Collapse the focused entry | – | `Esc` |

Use the checkboxes next to each row to drive copy/export actions. If nothing is selected, the export
falls back to the first page of results.



## Data contract

The CLI consumes a single JSON file shaped as follows (fields are extensible):

```json

  "schema_version": "1.2",
  "project": { "name": "Example repo", "created_at": "2024-05-10T12:34:56Z" },
  "run_metadata": {
    "branch": "main",
    "commit": "abcdef1234567890",
    "tool_versions": {
      "autofix": "3.4.0",
      "ui": "1.2.0",
      "mermaid": "10.6.1"
    }

  "project": {
    "name": "Example repo",
    "created_at": "2024-05-10T12:34:56Z"

  },
  "runs": [
    {
      "run_id": "run-001",

        {
          "id": "req-123",
          "request": {
            "method": "GET",
            "url": "https://example.com/api?token=abc123",
            "headers": {"Authorization": "Bearer token"},
            "body_preview": ""
          },
          "response": {
            "status": 200,
            "headers": {"Content-Type": "application/json"},
            "body_preview": "{\"ok\": true}",
            "body_blob": "blob-1"


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
   
      "history_repeater": [],
      "issues": [],
      "artifacts": {"mermaid": []},
      "blobs": {
        "blob-1": "{\"ok\": true}"
      }
    }
  ]
}
```

The exporter automatically injects `run.blobs` for full request/response bodies and exposes them via
`body_blob` IDs so the UI can lazily render large payloads. Request and response objects should
prefer `body_preview` for lightweight display. Additional fields (issues, repeater data, custom
artifacts) can be added alongside these keys without breaking the viewer.

## Privacy and data hygiene

The exporter scrubs common secrets (Authorization, cookies, API keys) and redacts suspicious query
parameters before serialising the payload. Large bodies are stored once in `run.blobs` and only
rendered when you click “Show full request/response”, keeping the initial DOM lightweight. Despite
the built-in defences, always review the resulting HTML before sharing and remove any content that
should remain private.

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

