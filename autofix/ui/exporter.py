"""Utilities for exporting a static History UI."""
from __future__ import annotations

import json
import textwrap
from pathlib import Path
from typing import Any

__all__ = [
    "build_history_app_script",
    "build_history_styles",
    "render_single_file_html",
    "write_single_file_ui",
    "write_static_bundle",
]


def build_history_styles() -> str:
    """Return the shared stylesheet for the history viewer."""
    return textwrap.dedent(
        """
        :root {
            color-scheme: light;
            --surface: #ffffff;
            --surface-muted: #f1f5f9;
            --border: #d0d7de;
            --accent: #2563eb;
            --text-primary: #1f2933;
            --text-secondary: #475569;
            --code-bg: #0f172a;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--surface-muted);
            color: var(--text-primary);
        }

        a {
            color: var(--accent);
        }

        .history-app {
            max-width: 960px;
            margin: 0 auto;
            padding: 32px 20px 64px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .app-header {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .app-title {
            margin: 0;
            font-size: 1.75rem;
        }

        .app-subtitle {
            margin: 0;
            font-size: 0.95rem;
            color: var(--text-secondary);
        }

        .history-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
        }

        .run-title {
            margin: 0 0 12px;
            font-size: 1.35rem;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }

        .summary-item {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 12px;
            background: var(--surface-muted);
        }

        .summary-label {
            display: block;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-secondary);
        }

        .summary-value {
            display: block;
            font-size: 1.25rem;
            font-weight: 600;
            margin-top: 2px;
        }

        .history-heading {
            margin: 0 0 8px;
            font-size: 1.05rem;
        }

        .history-item {
            border: 1px solid var(--border);
            border-radius: 12px;
            margin-bottom: 8px;
            background: var(--surface-muted);
        }

        .history-item summary {
            cursor: pointer;
            list-style: none;
            padding: 12px 16px;
            font-weight: 600;
        }

        .history-item summary::-webkit-details-marker {
            display: none;
        }

        .history-body {
            padding: 0 16px 16px;
            display: grid;
            gap: 12px;
        }

        .history-meta {
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .key-value {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .key-value strong {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-secondary);
        }

        pre {
            background: var(--code-bg);
            color: #e2e8f0;
            padding: 12px;
            border-radius: 10px;
            overflow-x: auto;
            font-size: 0.85rem;
            margin: 0;
        }

        .empty-state {
            font-size: 0.95rem;
            color: var(--text-secondary);
        }

        @media (max-width: 600px) {
            .history-card {
                padding: 16px;
            }

            .summary-grid {
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            }
        }
        """
    ).strip()


def build_history_app_script() -> str:
    """Return the shared JavaScript for rendering the history viewer."""
    return textwrap.dedent(
        """
        (function () {
          function byId(id) {
            return document.getElementById(id);
          }

          function createEl(tag, className, text) {
            const el = document.createElement(tag);
            if (className) {
              el.className = className;
            }
            if (typeof text === 'string') {
              el.textContent = text;
            }
            return el;
          }

          function formatValue(value) {
            if (value === undefined || value === null || value === '') {
              return '—';
            }
            if (typeof value === 'number' && !Number.isFinite(value)) {
              return '—';
            }
            return String(value);
          }

          function createSummaryItem(label, value) {
            const wrapper = createEl('div', 'summary-item');
            const labelEl = createEl('span', 'summary-label', label);
            const valueEl = createEl('span', 'summary-value', formatValue(value));
            wrapper.appendChild(labelEl);
            wrapper.appendChild(valueEl);
            return wrapper;
          }

          function createKeyValue(label, value) {
            const wrapper = createEl('div', 'key-value');
            wrapper.appendChild(createEl('strong', '', label));
            const valueEl = createEl('span', '', value);
            wrapper.appendChild(valueEl);
            return wrapper;
          }

          function createPre(label, value) {
            const wrapper = createEl('div', 'key-value');
            wrapper.appendChild(createEl('strong', '', label));
            const pre = document.createElement('pre');
            pre.textContent = value;
            wrapper.appendChild(pre);
            return wrapper;
          }

          function formatHeaders(headers) {
            if (!headers) {
              return '';
            }
            if (Array.isArray(headers)) {
              return headers
                .map(function (pair) {
                  if (Array.isArray(pair) && pair.length >= 2) {
                    return pair[0] + ': ' + pair[1];
                  }
                  if (pair && typeof pair === 'object' && 'key' in pair) {
                    return pair.key + ': ' + (pair.value ?? '');
                  }
                  return String(pair);
                })
                .join('\n');
            }
            if (typeof headers === 'object') {
              return Object.keys(headers)
                .map(function (key) {
                  return key + ': ' + headers[key];
                })
                .join('\n');
            }
            return String(headers);
          }

          function createHistoryDetails(entry, index) {
            const details = document.createElement('details');
            details.className = 'history-item';
            if (index === 0) {
              details.open = true;
            }
            const summary = document.createElement('summary');
            const method = entry && entry.request ? entry.request.method || 'REQUEST' : 'REQUEST';
            const url = entry && entry.request ? entry.request.url || '' : '';
            const status = entry && entry.response ? entry.response.status : undefined;
            summary.textContent = '[' + method + '] ' + url + (status ? ' → ' + status : '');
            details.appendChild(summary);

            const body = createEl('div', 'history-body');
            if (entry && entry.ts) {
              body.appendChild(createKeyValue('Timestamp', String(entry.ts)));
            }
            if (entry && entry.id) {
              body.appendChild(createKeyValue('History ID', String(entry.id)));
            }
            if (entry && Array.isArray(entry.tags) && entry.tags.length) {
              body.appendChild(createKeyValue('Tags', entry.tags.join(', ')));
            }
            if (entry && entry.request) {
              if (entry.request.headers) {
                const formattedHeaders = formatHeaders(entry.request.headers);
                if (formattedHeaders) {
                  body.appendChild(createPre('Request headers', formattedHeaders));
                }
              }
              if (entry.request.body) {
                body.appendChild(createPre('Request body', String(entry.request.body)));
              }
            }
            if (entry && entry.response) {
              if (entry.response.headers) {
                const formattedResponseHeaders = formatHeaders(entry.response.headers);
                if (formattedResponseHeaders) {
                  body.appendChild(createPre('Response headers', formattedResponseHeaders));
                }
              }
              if (entry.response.body_preview) {
                body.appendChild(createPre('Response preview', String(entry.response.body_preview)));
              }
            }
            details.appendChild(body);
            return details;
          }

          function renderHistoryApp() {
            const app = byId('app');
            if (!app) {
              return;
            }
            const data = window.HISTORY_DATA;
            app.innerHTML = '';
            if (!data) {
              app.appendChild(createEl('p', 'empty-state', 'No history data available.'));
              return;
            }

            const header = createEl('header', 'app-header');
            const projectName = data.project && data.project.name ? data.project.name : 'Autofix History';
            header.appendChild(createEl('h1', 'app-title', projectName));
            if (data.project && data.project.created_at) {
              header.appendChild(createEl('p', 'app-subtitle', 'Created at: ' + data.project.created_at));
            }
            if (Array.isArray(data.runs)) {
              header.appendChild(createEl('p', 'app-subtitle', 'Runs: ' + data.runs.length));
            }
            app.appendChild(header);

            const runs = Array.isArray(data.runs) ? data.runs : [];
            if (!runs.length) {
              app.appendChild(createEl('p', 'empty-state', 'No runs recorded yet.'));
              return;
            }

            runs.forEach(function (run, index) {
              const card = createEl('section', 'history-card');
              const runId = run && run.run_id ? String(run.run_id) : String(index + 1);
              card.appendChild(createEl('h2', 'run-title', 'Run ' + runId));

              const summaryGrid = createEl('div', 'summary-grid');
              const summary = run && run.summary ? run.summary : {};
              const historyEntries = Array.isArray(run && run.history) ? run.history : [];
              const issues = Array.isArray(run && run.issues) ? run.issues : [];
              const summaryPairs = [
                ['Targets', summary.targets],
                ['Issues found', summary.issues_found],
                ['Duration (sec)', summary.duration_sec],
                ['History entries', historyEntries.length],
                ['Issues tracked', issues.length],
              ];
              summaryPairs.forEach(function (pair) {
                summaryGrid.appendChild(createSummaryItem(pair[0], pair[1]));
              });
              card.appendChild(summaryGrid);

              const historyHeading = createEl('h3', 'history-heading', 'Recent history');
              card.appendChild(historyHeading);
              const samples = historyEntries.slice(0, 3);
              if (!samples.length) {
                card.appendChild(createEl('p', 'empty-state', 'No history entries captured for this run.'));
              } else {
                samples.forEach(function (entry, sampleIndex) {
                  card.appendChild(createHistoryDetails(entry, sampleIndex));
                });
              }

              app.appendChild(card);
            });
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', renderHistoryApp);
          } else {
            renderHistoryApp();
          }
        })();
        """
    ).strip()


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _safe_json_dumps(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2).replace("</", r"<\/")


def render_single_file_html(data: Any) -> str:
    """Render the full HTML document containing inline styles and scripts."""
    styles = build_history_styles()
    script = build_history_app_script()
    data_json = _safe_json_dumps(data)
    return textwrap.dedent(
        f"""
        <!DOCTYPE html>
        <html lang=\"en\">
        <head>
          <meta charset=\"utf-8\">
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
          <title>Autofix History Viewer</title>
          <style>
        {styles}
          </style>
        </head>
        <body>
          <div id=\"app\" class=\"history-app\">
            <noscript>This viewer requires JavaScript to display Autofix run details.</noscript>
          </div>
          <script>
        window.HISTORY_DATA = {data_json};
        {script}
          </script>
        </body>
        </html>
        """
    ).strip() + "\n"


def write_single_file_ui(data: Any, output_path: Path) -> Path:
    """Write the single HTML file containing the history UI."""
    _ensure_parent(output_path)
    html = render_single_file_html(data)
    output_path.write_text(html, encoding="utf-8")
    return output_path


def write_static_bundle(data: Any, output_dir: Path) -> Path:
    """Write the static asset bundle for the history UI."""
    output_dir.mkdir(parents=True, exist_ok=True)
    styles = build_history_styles()
    script = build_history_app_script()
    data_json = _safe_json_dumps(data)

    index_html = textwrap.dedent(
        """
        <!DOCTYPE html>
        <html lang=\"en\">
        <head>
          <meta charset=\"utf-8\">
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
          <title>Autofix History Viewer</title>
          <link rel=\"stylesheet\" href=\"ui.css\">
        </head>
        <body>
          <div id=\"app\" class=\"history-app\">
            <noscript>This viewer requires JavaScript to display Autofix run details.</noscript>
          </div>
          <script src=\"data.js\"></script>
          <script src=\"ui.js\"></script>
        </body>
        </html>
        """
    ).strip() + "\n"

    (output_dir / "index.html").write_text(index_html, encoding="utf-8")
    (output_dir / "ui.css").write_text(styles + "\n", encoding="utf-8")
    (output_dir / "ui.js").write_text(script + "\n", encoding="utf-8")
    (output_dir / "data.js").write_text(f"window.HISTORY_DATA = {data_json};\n", encoding="utf-8")
    return output_dir
