"""Utilities for exporting a static History UI."""
from __future__ import annotations


import copy
import json
import re
import textwrap
from pathlib import Path
from typing import Any, Iterable, Mapping, MutableMapping
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

__all__ = [
    "SCHEMA_VERSION",
    "prepare_history_payload",
    "build_history_styles",
    "build_history_app_script",

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


SCHEMA_VERSION = "1.2"
UI_VERSION = "1.2.0"
PREVIEW_LIMIT = 2048
MAX_BLOB_SIZE = 200_000
REDACTED_VALUE = "[redacted]"

SENSITIVE_HEADER_NAMES = {
    "authorization",
    "proxy-authorization",
    "x-api-key",
    "api-key",
    "x-auth-token",
    "x-session-id",
    "x-csrf-token",
    "cookie",
    "set-cookie",
}
SENSITIVE_HEADER_PREFIXES = (
    "x-api-",
    "x-auth-",
    "x-session-",
    "x-token-",
)
SENSITIVE_QUERY_KEYS = {
    "access_token",
    "auth",
    "authorization",
    "key",
    "api_key",
    "token",
    "session",
    "sessionid",
    "secret",
    "password",
    "signature",
}
TOKEN_VALUE_PATTERN = re.compile(r"(?i)(bearer\s+[a-z0-9\-_.]+)")
LONG_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9\-_.]{16,}$")
WHITESPACE_RE = re.compile(r"\s+")


class BlobStore:
    """Collect large payloads so the UI can lazily render them."""

    def __init__(self) -> None:
        self._data: dict[str, str] = {}
        self._counter = 0

    def add(self, text: str | None) -> str | None:
        if not text:
            return None
        trimmed = text[:MAX_BLOB_SIZE]
        if not trimmed:
            return None
        self._counter += 1
        blob_id = f"blob-{self._counter}"
        self._data[blob_id] = trimmed
        return blob_id

    def as_dict(self) -> dict[str, str]:
        return dict(self._data)


def _clone_data(data: Any) -> Any:
    try:
        return copy.deepcopy(data)
    except Exception:
        return data


def _ensure_mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _mask_value(value: str, keep: int = 2) -> str:
    if not value:
        return ""
    if len(value) <= keep * 2:
        return "*" * len(value)
    return f"{value[:keep]}…{value[-keep:]}"


def _looks_like_token(value: str) -> bool:
    if not value:
        return False
    if TOKEN_VALUE_PATTERN.search(value):
        return True
    cleaned = WHITESPACE_RE.sub("", value)
    if len(cleaned) >= 16 and LONG_TOKEN_PATTERN.match(cleaned):
        return True
    return False


def _is_sensitive_key(name: str | None) -> bool:
    if not name:
        return False
    lowered = name.lower()
    if lowered in SENSITIVE_HEADER_NAMES or lowered in SENSITIVE_QUERY_KEYS:
        return True
    return any(lowered.startswith(prefix) for prefix in SENSITIVE_HEADER_PREFIXES)


def _redact_value(name: str | None, value: Any) -> str:
    text = "" if value is None else str(value)
    if not name:
        return text
    if _is_sensitive_key(name) or _looks_like_token(text):
        return REDACTED_VALUE
    return text


def _sanitize_headers(headers: Any) -> Any:
    if headers is None:
        return None
    if isinstance(headers, Mapping):
        return {key: _redact_value(key, headers[key]) for key in headers}
    if isinstance(headers, list):
        sanitized: list[Any] = []
        for item in headers:
            if isinstance(item, Mapping):
                key = item.get("key") or item.get("name")
                value = _redact_value(key, item.get("value"))
                sanitized.append({"key": key, "value": value})
            elif isinstance(item, (list, tuple)) and item:
                key = item[0]
                value = _redact_value(key, item[1] if len(item) > 1 else "")
                sanitized.append([key, value])
            else:
                sanitized.append(item)
        return sanitized
    return headers


def _sanitize_url(url: Any) -> str | None:
    if not url:
        return None
    text = str(url)
    try:
        parsed = urlsplit(text)
    except ValueError:
        return text
    query_params = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if _is_sensitive_key(key) or _looks_like_token(value):
            query_params.append((key, REDACTED_VALUE))
        else:
            query_params.append((key, value))
    path_parts = [
        REDACTED_VALUE if _looks_like_token(part) else part
        for part in parsed.path.split("/")
    ]
    sanitized = parsed._replace(
        path="/".join(path_parts),
        query=urlencode(query_params, doseq=True),
    )
    return urlunsplit(sanitized)


def _prepare_body_fields(
    body: Any,
    preview: Any,
    blobs: BlobStore,
) -> tuple[str | None, str | None, bool]:
    text_value = "" if body is None else str(body)
    preview_value = "" if preview is None else str(preview)
    if not preview_value:
        preview_value = text_value[:PREVIEW_LIMIT]
    else:
        preview_value = preview_value[:PREVIEW_LIMIT]
    blob_id = None
    truncated = False
    if text_value and text_value != preview_value:
        blob_id = blobs.add(text_value)
        truncated = True if blob_id else False
    return preview_value or None, blob_id, truncated


def _sanitize_message(data: Any, blobs: BlobStore, *, include_method: bool = False) -> MutableMapping[str, Any]:
    message: MutableMapping[str, Any] = {}  # type: ignore[assignment]
    mapping = _ensure_mapping(data)
    if include_method:
        method = mapping.get("method")
        message["method"] = str(method).upper() if method else ""
    url = mapping.get("url")
    sanitized_url = _sanitize_url(url)
    if sanitized_url:
        message["url"] = sanitized_url
    headers = mapping.get("headers")
    sanitized_headers = _sanitize_headers(headers)
    if sanitized_headers is not None:
        message["headers"] = sanitized_headers
    if "status" in mapping:
        message["status"] = mapping.get("status")
    if "reason" in mapping:
        message["reason"] = mapping.get("reason")
    preview, blob_id, truncated = _prepare_body_fields(
        mapping.get("body"),
        mapping.get("body_preview"),
        blobs,
    )
    if preview is not None:
        message["body_preview"] = preview
    if blob_id:
        message["body_blob"] = blob_id
    if truncated:
        message["body_truncated"] = True
    return message


def _sanitize_history_entry(entry: Any, blobs: BlobStore, source: str) -> MutableMapping[str, Any]:
    mapping = _ensure_mapping(entry)
    result: MutableMapping[str, Any] = {}  # type: ignore[assignment]
    for key in ("id", "ts"):
        if key in mapping:
            result[key] = mapping[key]
    tags = mapping.get("tags")
    if isinstance(tags, Iterable) and not isinstance(tags, (str, bytes, bytearray)):
        result["tags"] = [str(tag) for tag in tags]
    request = mapping.get("request")
    response = mapping.get("response")
    result["request"] = _sanitize_message(request, blobs, include_method=True)
    result["response"] = _sanitize_message(response, blobs)
    result["source"] = source
    return result


def _sanitize_history_collection(entries: Any, blobs: BlobStore, source: str) -> list[MutableMapping[str, Any]]:
    if not entries:
        return []
    sanitized: list[MutableMapping[str, Any]] = []
    if isinstance(entries, Iterable) and not isinstance(entries, (str, bytes, bytearray)):
        for entry in entries:
            sanitized.append(_sanitize_history_entry(entry, blobs, source))
    return sanitized


def _sanitize_run(run: Any) -> MutableMapping[str, Any]:
    blobs = BlobStore()
    mapping = _ensure_mapping(run)
    result: MutableMapping[str, Any] = {}  # type: ignore[assignment]
    for key, value in mapping.items():
        if key in {"history", "history_proxy", "history_repeater"}:
            continue
        result[key] = _clone_data(value)
    result["history_proxy"] = _sanitize_history_collection(mapping.get("history_proxy"), blobs, "proxy")
    result["history_repeater"] = _sanitize_history_collection(mapping.get("history_repeater"), blobs, "repeater")
    if not result.get("history"):
        result["history"] = _sanitize_history_collection(mapping.get("history"), blobs, "history")
    else:
        result["history"] = _sanitize_history_collection(result.get("history"), blobs, "history")
    blob_dict = blobs.as_dict()
    if blob_dict:
        result["blobs"] = blob_dict
    return result


def prepare_history_payload(data: Any) -> MutableMapping[str, Any]:
    payload = _clone_data(data)
    if not isinstance(payload, MutableMapping):
        payload = {}  # type: ignore[assignment]
    payload["schema_version"] = SCHEMA_VERSION
    project = payload.setdefault("project", {})
    if "name" not in project:
        project["name"] = "Autofix Project"
    run_metadata = payload.setdefault("run_metadata", {})
    tool_versions = run_metadata.setdefault("tool_versions", {})
    tool_versions["ui"] = UI_VERSION
    tool_versions.setdefault("autofix", tool_versions.get("autofix", "unknown"))
    tool_versions.setdefault("mermaid", tool_versions.get("mermaid", "unknown"))
    runs = payload.get("runs")
    sanitized_runs = []
    if isinstance(runs, Iterable) and not isinstance(runs, (str, bytes, bytearray)):
        for run in runs:
            sanitized_runs.append(_sanitize_run(run))
    payload["runs"] = sanitized_runs
    return payload


def build_history_styles() -> str:

    return textwrap.dedent(
        """
        :root {
            color-scheme: light;
            --surface: #ffffff;
            --surface-muted: #f1f5f9;

            --surface-strong: #e2e8f0;
            --border: #d0d7de;
            --border-strong: #94a3b8;
            --accent: #2563eb;
            --accent-strong: #1d4ed8;
            --accent-muted: rgba(37, 99, 235, 0.12);
            --text-primary: #1f2933;
            --text-secondary: #475569;
            --text-muted: #64748b;
            --pin: #ea580c;
            --danger: #dc2626;

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


            max-width: 1080px;
            margin: 0 auto;
            padding: 32px 20px 96px;

            display: flex;
            flex-direction: column;
            gap: 24px;
        }


            margin: 0;


        .app-subtitle {
            margin: 0;
            font-size: 0.95rem;
            color: var(--text-secondary);
        }


        .app-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            margin-top: 8px;
        }

        .key-value {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 12px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            font-size: 0.85rem;
        }

        .status-banner {
            min-height: 1.5rem;
            font-size: 0.85rem;
            color: var(--text-secondary);
        }

        .status-banner[data-visible="true"] {
            color: var(--text-primary);
        }

        .view-controls {
            display: flex;
            flex-direction: column;
            gap: 16px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 16px;
        }

        .filter-panel {
            display: flex;
            flex-wrap: wrap;
            gap: 12px 16px;
            align-items: flex-end;
        }

        .filter-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 160px;
        }

        .filter-field label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text-muted);
        }

        .filter-field input,
        .filter-field select {
            appearance: none;
            font: inherit;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 6px 10px;
            background: var(--surface-muted);
            color: var(--text-primary);
        }

        .filter-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .chip-button {
            border: 1px solid var(--border);
            background: var(--surface-muted);
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            cursor: pointer;
        }

        .chip-button:hover,
        .chip-button:focus-visible {
            border-color: var(--accent);
            color: var(--accent-strong);
            outline: none;
        }

        .view-saver {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }

        .view-saver input {
            flex: 1 1 220px;
            padding: 6px 10px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: var(--surface-muted);
        }

        .saved-views {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .saved-views button {
            border: 1px solid var(--border);
            background: var(--surface-muted);
            border-radius: 8px;
            padding: 4px 10px;
            font-size: 0.8rem;
            cursor: pointer;
        }

        .saved-views button[data-active="true"] {
            background: var(--accent);
            color: white;
            border-color: var(--accent-strong);
        }

        .history-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 20px;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .history-card[data-active="true"] {
            border-color: var(--accent);
            box-shadow: 0 12px 28px rgba(37, 99, 235, 0.18);
        }

        .run-title {
            margin: 0 0 8px;
            font-size: 1.4rem;
        }

        .run-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 8px;
        }

        .action-button {
            appearance: none;
            border: 1px solid var(--border);
            background: var(--surface);
            color: var(--text-primary);
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.85rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background 0.2s ease;
        }

        .action-button:hover {
            background: var(--surface-muted);
        }

        .action-button:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
        }

        .shortcut-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 2px 6px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--surface-muted);
            font-size: 0.7rem;
            color: var(--text-secondary);
        }

        .keyboard-hint {
            margin: -8px 0 0;
            font-size: 0.8rem;
            color: var(--text-secondary);

        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
        }

        .summary-item {
            background: var(--surface-muted);
            border-radius: 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .summary-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
        }

        .summary-value {
            font-size: 1.1rem;
            font-weight: 600;
        }

        .history-heading {
            margin: 12px 0 0;
            font-size: 1rem;
        }

        .entry-list {
            display: flex;
            flex-direction: column;
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

            overflow: hidden;
            background: white;
        }

        .history-item summary {
            list-style: none;
            cursor: pointer;
            padding: 12px 16px;
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 12px;

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

        .history-item[open] summary {
            background: var(--surface-muted);
            border-bottom: 1px solid var(--border);
        }

        .entry-checkbox {
            width: 16px;
            height: 16px;
        }

        .entry-title {

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
or-history-project-lywlun
        .entry-primary {
            font-weight: 600;
            font-size: 0.95rem;
        }

        .entry-secondary {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .entry-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .entry-actions button {
            appearance: none;
            border: 1px solid var(--border);
            background: var(--surface);
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 0.75rem;
            cursor: pointer;
        }

        .entry-actions button[data-pinned="true"] {
            border-color: var(--pin);
            color: var(--pin);
        }

        .entry-source {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--accent-strong);
        }

        .history-body {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .history-body pre {
            margin: 0;
            background: var(--code-bg);
            color: #e2e8f0;
            padding: 12px;
            border-radius: 8px;
            max-height: 320px;
            overflow: auto;
            font-size: 0.85rem;
        }

        .history-body .body-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .empty-state {
            font-size: 0.9rem;
            color: var(--text-muted);
            font-style: italic;
        }

        .pinned-section {
            border: 1px dashed var(--border-strong);
            border-radius: 12px;
            padding: 12px;
            background: var(--surface-muted);
        }

        .pinned-section h4 {
            margin: 0 0 8px;
            font-size: 0.9rem;
            color: var(--pin);
        }

        .pagination {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .pagination button,
        .pagination select {
            appearance: none;
            border: 1px solid var(--border);
            background: var(--surface-muted);
            border-radius: 8px;
            padding: 6px 10px;
            font-size: 0.85rem;
            cursor: pointer;
        }

        .pagination button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .entries-indicator {
            font-size: 0.85rem;
            color: var(--text-secondary);
        }

        @media (max-width: 768px) {
            .history-item summary {
                grid-template-columns: 1fr;
                gap: 8px;
            }

            .entry-actions {
                justify-content: flex-start;

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
    return textwrap.dedent(
        """
        (function () {
          'use strict';

          var STORAGE_VIEWS_KEY = 'autofix.history.views';
          var STORAGE_PINS_KEY = 'autofix.history.pins';
          var DEFAULT_PAGE_SIZE = 50;
          var PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

          var ACTION_INFO = {
            "expand-all": { label: "Expand all", shortcut: "Shift+E" },
            "collapse-all": { label: "Collapse all", shortcut: "Shift+W" },
            "copy-summary": { label: "Copy summary", shortcut: "Shift+C" },
            "copy-run": { label: "Copy run JSON", shortcut: "Shift+J" },
            "copy-urls": { label: "Copy URLs", shortcut: "Shift+L" },
            "export-runlist": { label: "Export runlist", shortcut: "Shift+X" }
          };

          var ACTION_ORDER = [
            "expand-all",
            "collapse-all",
            "copy-summary",
            "copy-run",
            "copy-urls",
            "export-runlist"
          ];

          var shortcutMap = {};
          for (var i = 0; i < ACTION_ORDER.length; i++) {
            var actionName = ACTION_ORDER[i];
            var info = ACTION_INFO[actionName];
            if (info && info.shortcut) {
              shortcutMap[info.shortcut] = actionName;
            }
          }

          var state = {
            runs: [],
            normalizedRuns: [],
            activeRun: 0,
            statusTimer: 0,
            filters: {
              method: 'any',
              status: 'any',
              host: 'any',
              path: '',
              tag: 'any',
              source: 'any'
            },
            search: '',
            savedViews: {},
            pins: {},
            pagination: {},
            selections: {},
            visibleEntries: {},
            filterOptions: {
              methods: [],
              hosts: [],
              tags: []
            },
            focusedEntry: null
          };

          function safeArray(value) {
            return Array.isArray(value) ? value : [];
          }


def build_history_app_script() -> str:
    """Return the shared JavaScript for rendering the history viewer."""
    return textwrap.dedent(
        """
        (function () {

          function byId(id) {
            return document.getElementById(id);
          }

          function createEl(tag, className, text) {

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

              return '—';
            }
            return String(value);
          }


          function parseIndex(value, fallback) {
            var parsed = parseInt(value, 10);
            return isNaN(parsed) ? fallback : parsed;
          }

          function buildShortcut(event) {
            var parts = [];
            if (event.ctrlKey) {
              parts.push('Ctrl');
            }
            if (event.metaKey) {
              parts.push('Meta');
            }
            if (event.altKey) {
              parts.push('Alt');
            }
            if (event.shiftKey) {
              parts.push('Shift');
            }
            var key = event.key || '';
            if (key.length === 1) {
              key = key.toUpperCase();
            }
            parts.push(key);
            return parts.join('+');
          }

          function makeEntryKey(runIndex, entryId) {
            return String(runIndex) + '::' + String(entryId);
          }

          function loadSavedJson(key) {
            try {
              var raw = window.localStorage ? window.localStorage.getItem(key) : null;
              if (!raw) {
                return {};
              }
              var parsed = JSON.parse(raw);
              return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (error) {
              console.warn('Unable to load', key, error);
              return {};
            }
          }

          function persistJson(key, value) {
            try {
              if (!window.localStorage) {
                return;
              }
              window.localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
              console.warn('Unable to persist', key, error);
            }
          }

          function loadPins() {
            var pins = loadSavedJson(STORAGE_PINS_KEY);
            state.pins = pins && typeof pins === 'object' ? pins : {};
          }

          function persistPins() {
            persistJson(STORAGE_PINS_KEY, state.pins);
          }

          function loadSavedViews() {
            var views = loadSavedJson(STORAGE_VIEWS_KEY);
            state.savedViews = views && typeof views === 'object' ? views : {};
          }

          function persistSavedViews() {
            persistJson(STORAGE_VIEWS_KEY, state.savedViews);
          }

          function extractUrlParts(url) {
            if (!url) {
              return { host: '', path: '', href: '' };
            }
            var link = document.createElement('a');
            link.href = url;
            return {
              host: (link.hostname || '').toLowerCase(),
              path: link.pathname || '',
              href: link.href || url
            };
          }

          function normaliseEntry(entry, runIndex, blobs) {
            var request = entry.request || {};
            var response = entry.response || {};
            var method = (request.method || '').toUpperCase();
            var url = request.url || '';
            var urlParts = extractUrlParts(url);
            var status = response.status;
            var statusNumber = typeof status === 'number' ? status : parseInt(status || '', 10);
            var tags = Array.isArray(entry.tags) ? entry.tags.slice() : [];
            var previewBits = [method, url];
            if (request.body_preview) {
              previewBits.push(String(request.body_preview));
            }
            if (response.body_preview) {
              previewBits.push(String(response.body_preview));
            }
            if (tags.length) {
              previewBits.push(tags.join(' '));
            }
            var previewText = previewBits.join(' ').toLowerCase();
            return {
              id: entry.id !== undefined && entry.id !== null ? entry.id : makeEntryKey(runIndex, previewBits.join('-')),
              source: entry.source || 'history',
              method: method,
              url: url,
              host: urlParts.host || '',
              path: urlParts.path || '',
              href: urlParts.href || url,
              status: isNaN(statusNumber) ? null : statusNumber,
              tags: tags,
              ts: entry.ts || '',
              request: request,
              response: response,
              previewText: previewText,
              blobs: blobs
            };
          }

          function collectEntries(run, runIndex) {
            var blobs = run.blobs && typeof run.blobs === 'object' ? run.blobs : {};
            var proxy = safeArray(run.history_proxy);
            var repeater = safeArray(run.history_repeater);
            var fallback = safeArray(run.history);
            var items = [];
            for (var i = 0; i < proxy.length; i++) {
              items.push(normaliseEntry(proxy[i], runIndex, blobs));
            }
            for (var j = 0; j < repeater.length; j++) {
              items.push(normaliseEntry(repeater[j], runIndex, blobs));
            }
            for (var k = 0; k < fallback.length; k++) {
              items.push(normaliseEntry(fallback[k], runIndex, blobs));
            }
            return items;
          }

          function computeFilterOptions(normalizedRuns) {
            var methods = {};
            var hosts = {};
            var tags = {};
            for (var i = 0; i < normalizedRuns.length; i++) {
              var entries = normalizedRuns[i].entries;
              for (var j = 0; j < entries.length; j++) {
                var entry = entries[j];
                if (entry.method) {
                  methods[entry.method] = true;
                }
                if (entry.host) {
                  hosts[entry.host] = true;
                }
                if (Array.isArray(entry.tags)) {
                  for (var t = 0; t < entry.tags.length; t++) {
                    tags[entry.tags[t]] = true;
                  }
                }
              }
            }
            state.filterOptions = {
              methods: Object.keys(methods).sort(),
              hosts: Object.keys(hosts).sort(),
              tags: Object.keys(tags).sort()
            };
          }

          function loadStateFromData(data) {
            state.runs = safeArray(data.runs);
            state.normalizedRuns = [];
            for (var i = 0; i < state.runs.length; i++) {
              state.normalizedRuns.push({
                run: state.runs[i],
                entries: collectEntries(state.runs[i], i)
              });
            }
            computeFilterOptions(state.normalizedRuns);
            loadPins();
            loadSavedViews();
          }

          function showStatus(message) {
            var banner = byId('app-status');
            if (!banner) {
              return;
            }
            banner.textContent = message;
            if (message) {
              banner.setAttribute('data-visible', 'true');
            } else {
              banner.removeAttribute('data-visible');
            }
            if (state.statusTimer) {
              window.clearTimeout(state.statusTimer);
            }
            if (message) {
              state.statusTimer = window.setTimeout(function () {
                banner.textContent = '';
                banner.removeAttribute('data-visible');
              }, 4000);
            }
          }

          function getRunCard(index) {
            return document.querySelector('[data-run-card="' + String(index) + '"]');
          }

          function getRunData(index) {
            return index >= 0 && index < state.normalizedRuns.length ? state.normalizedRuns[index] : null;
          }

          function getPaginationState(runIndex) {
            if (!state.pagination[runIndex]) {
              state.pagination[runIndex] = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
            }
            return state.pagination[runIndex];
          }

          function resetPagination(runIndex) {
            var page = getPaginationState(runIndex);
            page.page = 1;
          }

          function getSelectionState(runIndex) {
            if (!state.selections[runIndex]) {
              state.selections[runIndex] = {};
            }
            return state.selections[runIndex];
          }

          function isPinned(runIndex, entryId) {
            var key = makeEntryKey(runIndex, entryId);
            return !!state.pins[key];
          }

          function setPinned(runIndex, entryId, pinned) {
            var key = makeEntryKey(runIndex, entryId);
            if (pinned) {
              state.pins[key] = true;
            } else {
              delete state.pins[key];
            }
            persistPins();
          }

          function saveView(name) {
            if (!name) {
              showStatus('View name is required');
              return;
            }
            state.savedViews[name] = {
              filters: JSON.parse(JSON.stringify(state.filters)),
              search: state.search
            };
            persistSavedViews();
            renderSavedViews();
            showStatus('View "' + name + '" saved');
          }

          function applyView(name) {
            var view = state.savedViews[name];
            if (!view) {
              showStatus('View not found');
              return;
            }
            state.filters = JSON.parse(JSON.stringify(view.filters || state.filters));
            state.search = view.search || '';
            state.pagination = {};
            renderFilterInputs();
            renderAllRuns();
            showStatus('View "' + name + '" applied');
          }

          function deleteView(name) {
            if (state.savedViews[name]) {
              delete state.savedViews[name];
              persistSavedViews();
              renderSavedViews();
              showStatus('View removed');
            }
          }

          function renderSavedViews() {
            var container = document.querySelector('[data-saved-views]');
            if (!container) {
              return;
            }
            container.innerHTML = '';
            var names = Object.keys(state.savedViews).sort();
            if (!names.length) {
              container.appendChild(createEl('span', 'empty-state', 'No saved views yet.'));
              return;
            }
            for (var i = 0; i < names.length; i++) {
              var name = names[i];
              var wrapper = createEl('span', '');
              var applyBtn = document.createElement('button');
              applyBtn.type = 'button';
              applyBtn.textContent = name;
              applyBtn.setAttribute('data-action', 'load-view');
              applyBtn.setAttribute('data-view-name', name);
              wrapper.appendChild(applyBtn);
              var removeBtn = document.createElement('button');
              removeBtn.type = 'button';
              removeBtn.textContent = '×';
              removeBtn.title = 'Delete view';
              removeBtn.setAttribute('data-action', 'delete-view');
              removeBtn.setAttribute('data-view-name', name);
              wrapper.appendChild(removeBtn);
              container.appendChild(wrapper);
            }
          }

          function renderFilterInputs() {
            var methodSelect = document.querySelector('[data-filter-input="method"]');
            var statusSelect = document.querySelector('[data-filter-input="status"]');
            var hostSelect = document.querySelector('[data-filter-input="host"]');
            var tagSelect = document.querySelector('[data-filter-input="tag"]');
            var sourceSelect = document.querySelector('[data-filter-input="source"]');
            var pathInput = document.querySelector('[data-filter-input="path"]');
            var searchInput = document.querySelector('[data-search-input="preview"]');

            function populateOptions(select, options, placeholder) {
              if (!select) {
                return;
              }
              var current = select.value;
              var frag = document.createDocumentFragment();
              var option = document.createElement('option');
              option.value = 'any';
              option.textContent = placeholder;
              frag.appendChild(option);
              for (var i = 0; i < options.length; i++) {
                var opt = document.createElement('option');
                opt.value = options[i];
                opt.textContent = options[i];
                frag.appendChild(opt);
              }
              select.innerHTML = '';
              select.appendChild(frag);
              if (current && current !== 'any') {
                select.value = current;
              }
            }

            populateOptions(methodSelect, state.filterOptions.methods, 'Any method');
            populateOptions(hostSelect, state.filterOptions.hosts, 'Any host');
            populateOptions(tagSelect, state.filterOptions.tags, 'Any tag');

            if (methodSelect) {
              methodSelect.value = state.filters.method || 'any';
            }
            if (statusSelect) {
              statusSelect.value = state.filters.status || 'any';
            }
            if (hostSelect) {
              hostSelect.value = state.filters.host || 'any';
            }
            if (tagSelect) {
              tagSelect.value = state.filters.tag || 'any';
            }
            if (sourceSelect) {
              sourceSelect.value = state.filters.source || 'any';
            }
            if (pathInput) {
              pathInput.value = state.filters.path || '';
            }
            if (searchInput) {
              searchInput.value = state.search || '';
            }
          }

          function matchesFilters(entry) {
            if (state.filters.method !== 'any' && entry.method !== state.filters.method) {
              return false;
            }
            if (state.filters.status !== 'any') {
              var status = entry.status || 0;
              var bucket = Math.floor(status / 100) + 'xx';
              if (!status || bucket !== state.filters.status) {
                return false;
              }
            }
            if (state.filters.host !== 'any' && entry.host !== state.filters.host) {
              return false;
            }
            if (state.filters.tag !== 'any') {
              var hasTag = false;
              for (var i = 0; i < entry.tags.length; i++) {
                if (entry.tags[i] === state.filters.tag) {
                  hasTag = true;
                  break;
                }
              }
              if (!hasTag) {
                return false;
              }
            }
            if (state.filters.source !== 'any' && entry.source !== state.filters.source) {
              return false;
            }
            if (state.filters.path) {
              var path = (entry.path || '').toLowerCase();
              if (path.indexOf(state.filters.path.toLowerCase()) === -1) {
                return false;
              }
            }
            if (state.search) {
              if (entry.previewText.indexOf(state.search) === -1) {
                return false;
              }
            }
            return true;
          }

          function gatherEntriesForRun(runIndex) {
            var run = getRunData(runIndex);
            if (!run) {
              return { pinned: [], entries: [], total: 0 };
            }
            var entries = run.entries;
            var filtered = [];
            for (var i = 0; i < entries.length; i++) {
              if (matchesFilters(entries[i])) {
                filtered.push(entries[i]);
              }
            }
            var pinned = [];
            var remaining = [];
            for (var j = 0; j < filtered.length; j++) {
              var entry = filtered[j];
              if (isPinned(runIndex, entry.id)) {
                pinned.push(entry);
              } else {
                remaining.push(entry);
              }
            }
            return { pinned: pinned, entries: remaining, total: filtered.length };
          }
          function renderEntryDetails(entry, runIndex, selectionState) {
            var details = document.createElement('details');
            details.className = 'history-item';
            details.setAttribute('data-entry-id', String(entry.id));
            details.setAttribute('data-entry-key', makeEntryKey(runIndex, entry.id));
            details.setAttribute('data-run-index', String(runIndex));

            var summary = document.createElement('summary');
            var checkboxWrap = createEl('div', '');
            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'entry-checkbox';
            checkbox.setAttribute('data-entry-select', 'true');
            checkbox.setAttribute('data-run-index', String(runIndex));
            checkbox.setAttribute('data-entry-id', String(entry.id));
            checkbox.setAttribute('data-request-url', entry.url || '');
            checkbox.setAttribute('data-request-method', entry.method || '');
            checkbox.setAttribute('data-source', entry.source || '');
            checkbox.checked = !!selectionState[entry.id];
            checkboxWrap.appendChild(checkbox);
            summary.appendChild(checkboxWrap);

            var title = createEl('div', 'entry-title', '');
            var primary = createEl('div', 'entry-primary', '');
            primary.innerHTML = '<span class="entry-source">' + entry.source.toUpperCase() + '</span> · [' + (entry.method || '—') + '] ' + (entry.url || '');
            var secondaryText = [];
            if (entry.status) {
              secondaryText.push('Status ' + entry.status);
            }
            if (entry.host) {
              secondaryText.push(entry.host);
            }
            if (entry.tags.length) {
              secondaryText.push('Tags: ' + entry.tags.join(', '));
            }
            if (entry.ts) {
              secondaryText.push(entry.ts);
            }
            title.appendChild(primary);
            title.appendChild(createEl('div', 'entry-secondary', secondaryText.join(' · ')));
            summary.appendChild(title);

            var actions = createEl('div', 'entry-actions', '');
            var pinBtn = document.createElement('button');
            pinBtn.type = 'button';
            pinBtn.textContent = isPinned(runIndex, entry.id) ? 'Unpin' : 'Pin';
            pinBtn.setAttribute('data-action', 'pin');
            pinBtn.setAttribute('data-run-index', String(runIndex));
            pinBtn.setAttribute('data-entry-id', String(entry.id));
            if (isPinned(runIndex, entry.id)) {
              pinBtn.setAttribute('data-pinned', 'true');
            }
            actions.appendChild(pinBtn);

            var copyRequest = document.createElement('button');
            copyRequest.type = 'button';
            copyRequest.textContent = 'Copy request';
            copyRequest.setAttribute('data-action', 'copy');
            copyRequest.setAttribute('data-field', 'request');
            copyRequest.setAttribute('data-run-index', String(runIndex));
            copyRequest.setAttribute('data-entry-id', String(entry.id));
            actions.appendChild(copyRequest);

            var copyResponse = document.createElement('button');
            copyResponse.type = 'button';
            copyResponse.textContent = 'Copy response';
            copyResponse.setAttribute('data-action', 'copy');
            copyResponse.setAttribute('data-field', 'response');
            copyResponse.setAttribute('data-run-index', String(runIndex));
            copyResponse.setAttribute('data-entry-id', String(entry.id));
            actions.appendChild(copyResponse);

            summary.appendChild(actions);
            details.appendChild(summary);

            var body = createEl('div', 'history-body', '');
            body.appendChild(createKeyValue('Timestamp', entry.ts || ''));
            body.appendChild(createKeyValue('Host', entry.host || ''));
            body.appendChild(createKeyValue('Path', entry.path || ''));
            if (entry.tags.length) {
              body.appendChild(createKeyValue('Tags', entry.tags.join(', ')));
            }

            var requestSection = document.createElement('div');
            requestSection.appendChild(createKeyValue('Request method', entry.method || ''));
            requestSection.appendChild(createKeyValue('Request URL', entry.url || ''));
            if (entry.request.headers) {
              requestSection.appendChild(createPre('Request headers', formatHeaders(entry.request.headers)));
            }
            if (entry.request.body_preview) {
              requestSection.appendChild(createPre('Request preview', String(entry.request.body_preview)));
            }
            if (entry.request.body_blob) {
              var requestActions = createEl('div', 'body-actions', '');
              var showRequest = document.createElement('button');
              showRequest.type = 'button';
              showRequest.textContent = 'Show full request';
              showRequest.setAttribute('data-action', 'show-full');
              showRequest.setAttribute('data-field', 'request');
              showRequest.setAttribute('data-run-index', String(runIndex));
              showRequest.setAttribute('data-entry-id', String(entry.id));
              requestActions.appendChild(showRequest);
              requestSection.appendChild(requestActions);
            }
            body.appendChild(requestSection);

            var responseSection = document.createElement('div');
            responseSection.appendChild(createKeyValue('Status', entry.status || ''));
            if (entry.response.headers) {
              responseSection.appendChild(createPre('Response headers', formatHeaders(entry.response.headers)));
            }
            if (entry.response.body_preview) {
              responseSection.appendChild(createPre('Response preview', String(entry.response.body_preview)));
            }
            if (entry.response.body_blob) {
              var responseActions = createEl('div', 'body-actions', '');
              var showResponse = document.createElement('button');
              showResponse.type = 'button';
              showResponse.textContent = 'Show full response';
              showResponse.setAttribute('data-action', 'show-full');
              showResponse.setAttribute('data-field', 'response');
              showResponse.setAttribute('data-run-index', String(runIndex));
              showResponse.setAttribute('data-entry-id', String(entry.id));
              responseActions.appendChild(showResponse);
              responseSection.appendChild(responseActions);
            }
            body.appendChild(responseSection);

            details.appendChild(body);
            return details;
          }

          function createKeyValue(label, value) {
            var wrapper = createEl('div', 'key-value');
            wrapper.appendChild(createEl('strong', '', label));
            wrapper.appendChild(createEl('span', '', formatValue(value)));
            return wrapper;
          }

          function createPre(label, value) {
            var wrapper = createEl('div', 'key-value');
            wrapper.appendChild(createEl('strong', '', label));
            var pre = document.createElement('pre');
            pre.textContent = value;
            wrapper.appendChild(pre);
            return wrapper;
          }

          function formatHeaders(headers) {
            if (!headers) {
              return '';
            }
            if (Array.isArray(headers)) {
              var lines = [];
              for (var i = 0; i < headers.length; i++) {
                var pair = headers[i];
                if (Array.isArray(pair) && pair.length >= 2) {
                  lines.push(pair[0] + ': ' + pair[1]);
                } else if (pair && typeof pair === 'object' && 'key' in pair) {
                  var value = pair.value === undefined || pair.value === null ? '' : pair.value;
                  lines.push(pair.key + ': ' + value);
                } else {
                  lines.push(String(pair));
                }
              }
              return lines.join('\n');
            }
            if (typeof headers === 'object') {
              var result = [];
              for (var key in headers) {
                if (Object.prototype.hasOwnProperty.call(headers, key)) {
                  result.push(key + ': ' + headers[key]);
                }
              }
              return result.join('\n');
            }
            return String(headers);
          }

          function renderEntriesForRun(runIndex) {
            var card = getRunCard(runIndex);
            if (!card) {
              return;
            }
            var sections = gatherEntriesForRun(runIndex);
            var selectionState = getSelectionState(runIndex);
            var pagination = getPaginationState(runIndex);
            var totalEntries = sections.entries.length;
            var pageCount = Math.max(1, Math.ceil(totalEntries / pagination.pageSize));
            if (pagination.page > pageCount) {
              pagination.page = pageCount;
            }
            var start = (pagination.page - 1) * pagination.pageSize;
            var pagedEntries = sections.entries.slice(start, start + pagination.pageSize);

            state.visibleEntries[runIndex] = [];

            var pinnedContainer = card.querySelector('[data-pinned-container]');
            if (pinnedContainer) {
              pinnedContainer.innerHTML = '';
              if (sections.pinned.length) {
                pinnedContainer.appendChild(createEl('h4', '', 'Pinned entries'));
                for (var p = 0; p < sections.pinned.length; p++) {
                  var pinnedEntry = renderEntryDetails(sections.pinned[p], runIndex, selectionState);
                  pinnedEntry.setAttribute('open', 'true');
                  pinnedContainer.appendChild(pinnedEntry);
                  state.visibleEntries[runIndex].push(String(sections.pinned[p].id));
                }
              } else {
                pinnedContainer.appendChild(createEl('p', 'empty-state', 'Pin entries to keep them handy.'));
              }
            }

            var listContainer = card.querySelector('[data-entry-container]');
            if (listContainer) {
              listContainer.innerHTML = '';
              if (!pagedEntries.length) {
                listContainer.appendChild(createEl('p', 'empty-state', 'No entries match the current filters.'));
              } else {
                for (var i = 0; i < pagedEntries.length; i++) {
                  var entryDetails = renderEntryDetails(pagedEntries[i], runIndex, selectionState);
                  listContainer.appendChild(entryDetails);
                  state.visibleEntries[runIndex].push(String(pagedEntries[i].id));
                }
              }
            }

            var indicator = card.querySelector('[data-entries-count]');
            if (indicator) {
              var pinnedLabel = sections.pinned.length ? ' · ' + sections.pinned.length + ' pinned' : '';
              indicator.textContent = 'Showing ' + pagedEntries.length + ' of ' + sections.total + ' entries' + pinnedLabel;
            }

            var pageInfo = card.querySelector('[data-page-info]');
            if (pageInfo) {
              pageInfo.textContent = 'Page ' + pagination.page + ' of ' + pageCount;
            }

            var prevBtn = card.querySelector('[data-action="page"][data-direction="prev"]');
            var nextBtn = card.querySelector('[data-action="page"][data-direction="next"]');
            if (prevBtn) {
              prevBtn.disabled = pagination.page <= 1;
            }
            if (nextBtn) {
              nextBtn.disabled = pagination.page >= pageCount;
            }

            var sizeSelect = card.querySelector('[data-page-size]');
            if (sizeSelect) {
              sizeSelect.value = String(pagination.pageSize);
            }

            if (!state.focusedEntry && state.visibleEntries[runIndex].length) {
              focusEntry(runIndex, state.visibleEntries[runIndex][0]);
            }
          }

          function focusEntry(runIndex, entryId) {
            state.focusedEntry = { run: runIndex, entry: entryId };
            var selector = '[data-run-card="' + runIndex + '"] [data-entry-id="' + entryId + '"] summary';
            var summary = document.querySelector(selector);
            if (summary) {
              summary.focus({ preventScroll: false });
            }
          }

          function moveFocus(delta) {
            if (!state.visibleEntries[state.activeRun]) {
              return;
            }
            var entries = state.visibleEntries[state.activeRun];
            if (!entries.length) {
              return;
            }
            var currentIndex = 0;
            if (state.focusedEntry && state.focusedEntry.run === state.activeRun) {
              currentIndex = entries.indexOf(String(state.focusedEntry.entry));
              if (currentIndex === -1) {
                currentIndex = 0;
              }
            }
            var nextIndex = currentIndex + delta;
            if (nextIndex < 0) {
              var page = getPaginationState(state.activeRun);
              if (page.page > 1) {
                page.page -= 1;
                renderEntriesForRun(state.activeRun);
                entries = state.visibleEntries[state.activeRun];
                nextIndex = entries.length - 1;
              } else {
                nextIndex = 0;
              }
            } else if (nextIndex >= entries.length) {
              var pagination = getPaginationState(state.activeRun);
              var sections = gatherEntriesForRun(state.activeRun);
              var totalPages = Math.max(1, Math.ceil(sections.entries.length / pagination.pageSize));
              if (pagination.page < totalPages) {
                pagination.page += 1;
                renderEntriesForRun(state.activeRun);
                entries = state.visibleEntries[state.activeRun];
                nextIndex = 0;
              } else {
                nextIndex = entries.length - 1;
              }
            }
            var entryId = entries[nextIndex];
            focusEntry(state.activeRun, entryId);
          }

          function toggleFocusedEntry(open) {
            if (!state.focusedEntry) {
              return;
            }
            var selector = '[data-run-card="' + state.focusedEntry.run + '"] [data-entry-id="' + state.focusedEntry.entry + '"]';
            var details = document.querySelector(selector);
            if (details && details.tagName === 'DETAILS') {
              if (open === undefined) {
                details.open = !details.open;
              } else {
                details.open = open;
              }
            }
          }

          function renderPaginationControls(card, runIndex) {
            var pagination = getPaginationState(runIndex);
            var footer = createEl('div', 'pagination', '');
            var info = createEl('div', 'entries-indicator', '');
            info.setAttribute('data-entries-count', '');
            footer.appendChild(info);

            var controls = createEl('div', '', '');
            var prev = document.createElement('button');
            prev.type = 'button';
            prev.textContent = 'Prev';
            prev.setAttribute('data-action', 'page');
            prev.setAttribute('data-direction', 'prev');
            prev.setAttribute('data-run-index', String(runIndex));
            controls.appendChild(prev);

            var next = document.createElement('button');
            next.type = 'button';
            next.textContent = 'Next';
            next.setAttribute('data-action', 'page');
            next.setAttribute('data-direction', 'next');
            next.setAttribute('data-run-index', String(runIndex));
            controls.appendChild(next);

            var sizeLabel = document.createElement('label');
            sizeLabel.textContent = 'Per page';
            sizeLabel.style.marginLeft = '8px';
            var select = document.createElement('select');
            select.setAttribute('data-page-size', 'true');
            select.setAttribute('data-run-index', String(runIndex));
            for (var i = 0; i < PAGE_SIZE_OPTIONS.length; i++) {
              var opt = document.createElement('option');
              opt.value = String(PAGE_SIZE_OPTIONS[i]);
              opt.textContent = String(PAGE_SIZE_OPTIONS[i]);
              select.appendChild(opt);
            }
            select.value = String(pagination.pageSize);
            sizeLabel.appendChild(select);
            controls.appendChild(sizeLabel);

            var pageInfo = createEl('div', '', '');
            pageInfo.setAttribute('data-page-info', '');
            controls.appendChild(pageInfo);

            footer.appendChild(controls);
            card.appendChild(footer);
          }

          function buildRunSummary(run) {
            var summary = run && run.summary ? run.summary : {};
            var proxyCount = safeArray(run && run.history_proxy).length;
            var repeaterCount = safeArray(run && run.history_repeater).length;
            var fallbackCount = safeArray(run && run.history).length;
            var historyTotal = proxyCount + repeaterCount;
            if (!historyTotal && fallbackCount) {
              historyTotal = fallbackCount;
            }
            var issuesCount = safeArray(run && run.issues).length;
            return [
              ['Targets', summary.targets],
              ['Issues found', summary.issues_found],
              ['Duration (sec)', summary.duration_sec],
              ['Proxy entries', proxyCount],
              ['Repeater entries', repeaterCount],
              ['History entries', historyTotal],
              ['Issues tracked', issuesCount]
            ];
          }

          function gatherSummaryText(run, index) {
            var runId = run && run.run_id ? String(run.run_id) : String(index + 1);
            var summaryLines = ['Run ' + runId];
            var summaryPairs = buildRunSummary(run);
            for (var i = 0; i < summaryPairs.length; i++) {
              var pair = summaryPairs[i];
              summaryLines.push(pair[0] + ': ' + formatValue(pair[1]));
            }
            return summaryLines.join('\n');
          }

          function renderRunCard(run, index) {
            var card = createEl('section', 'history-card', '');
            card.setAttribute('data-run-card', String(index));
            card.setAttribute('tabindex', '0');

            var runId = run && run.run_id ? String(run.run_id) : String(index + 1);
            card.appendChild(createEl('h2', 'run-title', 'Run ' + runId));

            var actions = createEl('div', 'run-actions', '');
            for (var i = 0; i < ACTION_ORDER.length; i++) {
              var action = ACTION_ORDER[i];
              var info = ACTION_INFO[action] || { label: action };
              var button = document.createElement('button');
              button.type = 'button';
              button.className = 'action-button';
              button.setAttribute('data-action', 'run');
              button.setAttribute('data-run-action', action);
              button.setAttribute('data-run-index', String(index));
              button.appendChild(document.createTextNode(info.label));
              if (info.shortcut) {
                var badge = createEl('span', 'shortcut-badge', info.shortcut);
                button.appendChild(badge);
              }
              actions.appendChild(button);
            }
            card.appendChild(actions);

            var summaryGrid = createEl('div', 'summary-grid', '');
            var summaryPairs = buildRunSummary(run);
            for (var j = 0; j < summaryPairs.length; j++) {
              var pair = summaryPairs[j];
              var summaryItem = createEl('div', 'summary-item', '');
              summaryItem.appendChild(createEl('span', 'summary-label', pair[0]));
              summaryItem.appendChild(createEl('span', 'summary-value', formatValue(pair[1])));
              summaryGrid.appendChild(summaryItem);
            }
            card.appendChild(summaryGrid);

            var pinnedContainer = createEl('div', 'pinned-section', '');
            pinnedContainer.setAttribute('data-pinned-container', '');
            card.appendChild(pinnedContainer);

            var listContainer = createEl('div', 'entry-list', '');
            listContainer.setAttribute('data-entry-container', '');
            card.appendChild(listContainer);

            renderPaginationControls(card, index);

            return card;
          }

          function renderFilterPanel(app) {
            var controls = createEl('section', 'view-controls', '');
            var panel = createEl('div', 'filter-panel', '');

            function createSelectField(label, datasetKey) {
              var field = createEl('div', 'filter-field', '');
              var lbl = document.createElement('label');
              lbl.textContent = label;
              field.appendChild(lbl);
              var select = document.createElement('select');
              select.setAttribute('data-filter-input', datasetKey);
              field.appendChild(select);
              panel.appendChild(field);
              return select;
            }

            createSelectField('Method', 'method');
            var statusField = createSelectField('Status bucket', 'status');
            if (statusField) {
              statusField.innerHTML = '';
              var statusOptions = ['any', '1xx', '2xx', '3xx', '4xx', '5xx'];
              for (var s = 0; s < statusOptions.length; s++) {
                var opt = document.createElement('option');
                opt.value = statusOptions[s];
                opt.textContent = statusOptions[s] === 'any' ? 'Any status' : statusOptions[s];
                statusField.appendChild(opt);
              }
            }
            createSelectField('Host', 'host');
            var pathField = createEl('div', 'filter-field', '');
            var pathLabel = document.createElement('label');
            pathLabel.textContent = 'Path contains';
            pathField.appendChild(pathLabel);
            var pathInput = document.createElement('input');
            pathInput.type = 'text';
            pathInput.placeholder = '/api';
            pathInput.setAttribute('data-filter-input', 'path');
            pathField.appendChild(pathInput);
            panel.appendChild(pathField);

            createSelectField('Tag', 'tag');
            var sourceField = createSelectField('Source', 'source');
            if (sourceField) {
              sourceField.innerHTML = '';
              var sourceOptions = ['any', 'proxy', 'repeater', 'history'];
              for (var o = 0; o < sourceOptions.length; o++) {
                var optSource = document.createElement('option');
                optSource.value = sourceOptions[o];
                optSource.textContent = sourceOptions[o] === 'any' ? 'Any source' : sourceOptions[o];
                sourceField.appendChild(optSource);
              }
            }

            var searchField = createEl('div', 'filter-field', '');
            var searchLabel = document.createElement('label');
            searchLabel.textContent = 'Search preview';
            searchField.appendChild(searchLabel);
            var searchInput = document.createElement('input');
            searchInput.type = 'search';
            searchInput.placeholder = 'Keyword in preview';
            searchInput.setAttribute('data-search-input', 'preview');
            searchField.appendChild(searchInput);
            panel.appendChild(searchField);

            var actions = createEl('div', 'filter-actions', '');
            var proxyButton = document.createElement('button');
            proxyButton.type = 'button';
            proxyButton.className = 'chip-button';
            proxyButton.textContent = 'Proxy';
            proxyButton.setAttribute('data-action', 'filter');
            proxyButton.setAttribute('data-filter', 'source:proxy');
            actions.appendChild(proxyButton);

            var repeaterButton = document.createElement('button');
            repeaterButton.type = 'button';
            repeaterButton.className = 'chip-button';
            repeaterButton.textContent = 'Repeater';
            repeaterButton.setAttribute('data-action', 'filter');
            repeaterButton.setAttribute('data-filter', 'source:repeater');
            actions.appendChild(repeaterButton);

            var statusButton = document.createElement('button');
            statusButton.type = 'button';
            statusButton.className = 'chip-button';
            statusButton.textContent = '4xx';
            statusButton.setAttribute('data-action', 'filter');
            statusButton.setAttribute('data-filter', 'status:4xx');
            actions.appendChild(statusButton);

            var clearButton = document.createElement('button');
            clearButton.type = 'button';
            clearButton.className = 'chip-button';
            clearButton.textContent = 'Clear filters';
            clearButton.setAttribute('data-action', 'clear-filters');
            actions.appendChild(clearButton);
            panel.appendChild(actions);

            controls.appendChild(panel);

            var saver = createEl('div', 'view-saver', '');
            var input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Save current filters as view';
            input.setAttribute('data-view-name', '');
            saver.appendChild(input);
            var saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.textContent = 'Save view';
            saveBtn.setAttribute('data-action', 'save-view');
            saver.appendChild(saveBtn);
            var savedViews = createEl('div', 'saved-views', '');
            savedViews.setAttribute('data-saved-views', '');
            saver.appendChild(savedViews);
            controls.appendChild(saver);

            app.appendChild(controls);
          }

          function buildKeyboardHintText() {
            var hints = [];
            for (var i = 0; i < ACTION_ORDER.length; i++) {
              var action = ACTION_ORDER[i];
              var info = ACTION_INFO[action];
              if (info && info.shortcut) {
                hints.push(info.shortcut + ' → ' + info.label);
              }
            }
            hints.push('↑/↓ → Navigate entries');
            hints.push('Enter/Space → Toggle entry');
            hints.push('Esc → Collapse entry');
            return hints.length ? 'Keyboard shortcuts: ' + hints.join(' · ') : '';
          }

          function setActiveRun(index) {
            state.activeRun = index;
            var cards = document.querySelectorAll('[data-run-card]');
            for (var i = 0; i < cards.length; i++) {
              var card = cards[i];
              if (parseInt(card.getAttribute('data-run-card'), 10) === index) {
                card.setAttribute('data-active', 'true');
              } else {
                card.removeAttribute('data-active');
              }
            }
            state.focusedEntry = null;
            renderEntriesForRun(index);
          }

          function gatherSelectedEntries(runIndex) {
            var selected = [];
            var selections = getSelectionState(runIndex);
            var run = getRunData(runIndex);
            if (!run) {
              return selected;
            }
            var entries = run.entries;
            for (var i = 0; i < entries.length; i++) {
              var entry = entries[i];
              if (selections[entry.id]) {
                selected.push({
                  id: entry.id,
                  url: entry.url || '',
                  method: entry.method || '',
                  source: entry.source || ''
                });
              }
            }
            return selected;
          }

          function gatherSampleExportEntries(runIndex) {
            var run = getRunData(runIndex);
            if (!run) {
              return [];
            }
            var entries = run.entries.slice(0, 10);
            var exports = [];
            for (var i = 0; i < entries.length; i++) {
              exports.push({
                id: entries[i].id,
                url: entries[i].url || '',
                method: entries[i].method || '',
                source: entries[i].source || ''
              });
            }
            return exports;
          }

          function fallbackCopy(text) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', 'readonly');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
              document.execCommand('copy');
            } catch (error) {
              console.error('Copy failed', error);
            }
            document.body.removeChild(textarea);
            return true;
          }

          function copyText(text) {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
              return navigator.clipboard.writeText(text).catch(function () {
                fallbackCopy(text);
              });
            }
            fallbackCopy(text);
            return Promise.resolve();
          }

          function downloadJson(filename, payload) {
            try {
              var jsonText = JSON.stringify(payload, null, 2);
              var blob = new Blob([jsonText], { type: 'application/json' });
              var link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              window.setTimeout(function () {
                URL.revokeObjectURL(link.href);
                document.body.removeChild(link);
              }, 0);
            } catch (error) {
              console.error('Export failed', error);
            }
          }

          var RUN_ACTION_HANDLERS = {
            'expand-all': function (runIndex) {
              var card = getRunCard(runIndex);
              if (!card) {
                showStatus('Nothing to expand');
                return;
              }
              var groups = card.querySelectorAll('details');
              for (var i = 0; i < groups.length; i++) {
                groups[i].open = true;
              }
              showStatus('Expanded all entries');
            },
            'collapse-all': function (runIndex) {
              var card = getRunCard(runIndex);
              if (!card) {
                showStatus('Nothing to collapse');
                return;
              }
              var groups = card.querySelectorAll('details');
              for (var i = 0; i < groups.length; i++) {
                groups[i].open = false;
              }
              showStatus('Collapsed all entries');
            },
            'copy-summary': function (runIndex) {
              var run = state.runs[runIndex];
              if (!run) {
                showStatus('Summary unavailable');
                return;
              }
              var text = gatherSummaryText(run, runIndex);
              copyText(text).then(function () {
                showStatus('Summary copied to clipboard');
              });
            },
            'copy-run': function (runIndex) {
              var run = state.runs[runIndex];
              if (!run) {
                showStatus('Run unavailable');
                return;
              }
              var jsonText;
              try {
                jsonText = JSON.stringify(run, null, 2);
              } catch (error) {
                jsonText = String(run);
              }
              copyText(jsonText).then(function () {
                showStatus('Run JSON copied to clipboard');
              });
            },
            'copy-urls': function (runIndex) {
              var selections = gatherSelectedEntries(runIndex);
              if (!selections.length) {
                showStatus('Select at least one entry to copy URLs');
                return;
              }
              var text = selections.map(function (item) {
                return '[' + (item.method || '—') + '] ' + item.url;
              }).join('\n');
              copyText(text).then(function () {
                showStatus('URLs copied to clipboard');
              });
            },
            'export-runlist': function (runIndex) {
              var selections = gatherSelectedEntries(runIndex);
              if (!selections.length) {
                selections = gatherSampleExportEntries(runIndex);
              }
              if (!selections.length) {
                showStatus('No entries available for export');
                return;
              }
              downloadJson('runlist.json', selections);
              showStatus('Exported runlist.json');
            }
          };

          var ACTION_HANDLERS = {
            filter: function (el) {
              var value = el.getAttribute('data-filter') || '';
              var parts = value.split(':');
              if (parts.length !== 2) {
                return;
              }
              state.filters[parts[0]] = parts[1];
              state.pagination = {};
              renderFilterInputs();
              renderAllRuns();
            },
            'clear-filters': function () {
              state.filters = {
                method: 'any',
                status: 'any',
                host: 'any',
                path: '',
                tag: 'any',
                source: 'any'
              };
              state.search = '';
              state.pagination = {};
              renderFilterInputs();
              renderAllRuns();
              showStatus('Filters cleared');
            },
            copy: function (el) {
              var field = el.getAttribute('data-field');
              var runIndex = parseIndex(el.getAttribute('data-run-index'), state.activeRun);
              if (field === 'request' || field === 'response') {
                var entryId = el.getAttribute('data-entry-id');
                var run = getRunData(runIndex);
                if (!run) {
                  return;
                }
                for (var i = 0; i < run.entries.length; i++) {
                  var entry = run.entries[i];
                  if (String(entry.id) === String(entryId)) {
                    var payload = field === 'request' ? entry.request : entry.response;
                    var preview = payload.body_preview || '';
                    copyText(String(preview)).then(function () {
                      showStatus('Copied ' + field + ' preview');
                    });
                    break;
                  }
                }
                return;
              }
              if (field === 'urls') {
                RUN_ACTION_HANDLERS['copy-urls'](runIndex);
              } else {
                RUN_ACTION_HANDLERS['copy-summary'](runIndex);
              }
            },
            export: function (el) {
              var kind = el.getAttribute('data-kind');
              if (kind === 'runlist') {
                var runIndex = parseIndex(el.getAttribute('data-run-index'), state.activeRun);
                RUN_ACTION_HANDLERS['export-runlist'](runIndex);
              }
            },
            pin: function (el) {
              var runIndex = parseIndex(el.getAttribute('data-run-index'), state.activeRun);
              var entryId = el.getAttribute('data-entry-id');
              var pinned = isPinned(runIndex, entryId);
              setPinned(runIndex, entryId, !pinned);
              renderEntriesForRun(runIndex);
            },
            'show-full': function (el) {
              var runIndex = parseIndex(el.getAttribute('data-run-index'), state.activeRun);
              var entryId = el.getAttribute('data-entry-id');
              var field = el.getAttribute('data-field');
              var run = getRunData(runIndex);
              if (!run) {
                return;
              }
              for (var i = 0; i < run.entries.length; i++) {
                var entry = run.entries[i];
                if (String(entry.id) === String(entryId)) {
                  var payload = field === 'request' ? entry.request : entry.response;
                  if (!payload.body_blob) {
                    showStatus('No full payload available');
                    return;
                  }
                  var blobId = payload.body_blob;
                  var body = entry.blobs && entry.blobs[blobId];
                  if (!body) {
                    showStatus('Full payload missing');
                    return;
                  }
                  var selector = '[data-run-card="' + runIndex + '"] [data-entry-id="' + entryId + '"]';
                  var container = document.querySelector(selector);
                  if (!container) {
                    return;
                  }
                  var pre = createPre(field === 'request' ? 'Request body' : 'Response body', String(body));
                  var targetSection = el.parentNode && el.parentNode.parentNode ? el.parentNode.parentNode : null;
                  if (targetSection) {
                    targetSection.appendChild(pre);
                  }
                  el.remove();
                  showStatus('Full payload inserted');
                  break;
                }
              }
            },
            'save-view': function (el) {
              var container = el.closest('.view-saver');
              if (!container) {
                return;
              }
              var input = container.querySelector('[data-view-name]');
              var name = input ? input.value.trim() : '';
              saveView(name);
              if (input) {
                input.value = '';
              }
            },
            'load-view': function (el) {
              var name = el.getAttribute('data-view-name');
              applyView(name);
            },
            'delete-view': function (el) {
              var name = el.getAttribute('data-view-name');
              deleteView(name);
            },
            page: function (el) {
              var direction = el.getAttribute('data-direction');
              var runIndex = parseIndex(el.getAttribute('data-run-index'), state.activeRun);
              var pagination = getPaginationState(runIndex);
              if (direction === 'prev' && pagination.page > 1) {
                pagination.page -= 1;
              } else if (direction === 'next') {
                pagination.page += 1;
              }
              renderEntriesForRun(runIndex);
            },
            run: function (el) {
              var action = el.getAttribute('data-run-action');
              var runIndex = parseIndex(el.getAttribute('data-run-index'), state.activeRun);
              var handler = RUN_ACTION_HANDLERS[action];
              if (handler) {
                handler(runIndex);
              }
            }
          };

          function handleSelectChange(select) {
            var key = select.getAttribute('data-filter-input');
            if (!key) {
              return;
            }
            if (key === 'path') {
              state.filters.path = select.value || '';
            } else {
              state.filters[key] = select.value || 'any';
            }
            state.pagination = {};
            renderAllRuns();
          }

          function handleSearchInput(input) {
            state.search = (input.value || '').toLowerCase();
            state.pagination = {};
            renderAllRuns();
          }

          function handleCheckboxChange(box) {
            var runIndex = parseIndex(box.getAttribute('data-run-index'), state.activeRun);
            var entryId = box.getAttribute('data-entry-id');
            var selections = getSelectionState(runIndex);
            if (box.checked) {
              selections[entryId] = true;
            } else {
              delete selections[entryId];
            }
          }

          function renderAllRuns() {
            for (var i = 0; i < state.normalizedRuns.length; i++) {
              renderEntriesForRun(i);
            }
          }

          function ensureListeners() {
            if (ensureListeners._bound) {
              return;
            }
            ensureListeners._bound = true;

            document.addEventListener('click', function (event) {
              var el = event.target && event.target.closest('[data-action]');
              if (!el) {
                var card = event.target && event.target.closest('[data-run-card]');
                if (card) {
                  setActiveRun(parseIndex(card.getAttribute('data-run-card'), state.activeRun));
                }
                return;
              }
              event.preventDefault();
              if (el.disabled) {
                return;
              }
              var action = el.getAttribute('data-action');
              var handler = ACTION_HANDLERS[action];
              if (!handler) {
                console.warn('Unknown action', action);
                return;
              }
              el.disabled = true;
              try {
                var result = handler(el);
                if (result && typeof result.then === 'function') {
                  result.then(function () {
                    el.disabled = false;
                  }, function (error) {
                    console.error(error);
                    el.disabled = false;
                  });
                } else {
                  el.disabled = false;
                }
              } catch (error) {
                console.error(error);
                showStatus('Error executing action');
                el.disabled = false;
              }
            });

            document.addEventListener('change', function (event) {
              var target = event.target;
              if (!target) {
                return;
              }
              if (target.matches('[data-filter-input]')) {
                handleSelectChange(target);
                return;
              }
              if (target.matches('[data-page-size]')) {
                var runIndex = parseIndex(target.getAttribute('data-run-index'), state.activeRun);
                var pagination = getPaginationState(runIndex);
                pagination.pageSize = parseInt(target.value, 10) || DEFAULT_PAGE_SIZE;
                pagination.page = 1;
                renderEntriesForRun(runIndex);
                return;
              }
              if (target.matches('[data-entry-select="true"]')) {
                handleCheckboxChange(target);
              }
            });

            document.addEventListener('input', function (event) {
              var target = event.target;
              if (!target) {
                return;
              }
              if (target.matches('[data-search-input]')) {
                handleSearchInput(target);
                return;
              }
              if (target.matches('input[data-filter-input="path"]')) {
                state.filters.path = target.value || '';
                state.pagination = {};
                renderAllRuns();
              }
            });

            document.addEventListener('keydown', function (event) {
              var target = event.target;
              if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                return;
              }
              var combo = buildShortcut(event);
              var action = shortcutMap[combo];
              if (action) {
                event.preventDefault();
                RUN_ACTION_HANDLERS[action](state.activeRun);
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                moveFocus(1);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveFocus(-1);
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleFocusedEntry();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                toggleFocusedEntry(false);
              }
            });
          }

          function renderHistoryApp() {
            var app = byId('app');
            if (!app) {
              return;
            }
            var data = window.HISTORY_DATA || {};
            loadStateFromData(data);

            app.innerHTML = '';

            var header = createEl('header', 'app-header', '');
            var project = data.project && typeof data.project === 'object' ? data.project : {};
            var projectName = project.name || 'Autofix History';
            header.appendChild(createEl('h1', 'app-title', projectName));
            if (project.created_at) {
              header.appendChild(createEl('p', 'app-subtitle', 'Created at: ' + project.created_at));
            }

            var metaPairs = [];
            if (data.schema_version) {
              metaPairs.push(['Schema version', data.schema_version]);
            }
            var runMetadata = data.run_metadata && typeof data.run_metadata === 'object' ? data.run_metadata : {};
            if (runMetadata.branch) {
              metaPairs.push(['Branch', runMetadata.branch]);
            }
            if (runMetadata.commit) {
              metaPairs.push(['Commit', runMetadata.commit]);
            }
            var toolVersions = runMetadata.tool_versions && typeof runMetadata.tool_versions === 'object' ? runMetadata.tool_versions : {};
            for (var tool in toolVersions) {
              if (Object.prototype.hasOwnProperty.call(toolVersions, tool)) {
                metaPairs.push([tool + ' version', toolVersions[tool]]);
              }
            }
            if (metaPairs.length) {
              var metaGrid = createEl('div', 'app-meta', '');
              for (var i = 0; i < metaPairs.length; i++) {
                var pair = metaPairs[i];
                metaGrid.appendChild(createKeyValue(pair[0], pair[1]));
              }
              header.appendChild(metaGrid);
            }

            var runsArray = safeArray(data.runs);
            header.appendChild(createEl('p', 'app-subtitle', 'Runs: ' + runsArray.length));
            app.appendChild(header);

            var status = createEl('div', 'status-banner', '');
            status.id = 'app-status';
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            app.appendChild(status);

            if (!runsArray.length) {
              app.appendChild(createEl('p', 'empty-state', 'No runs recorded yet.'));
              ensureListeners();
              return;
            }

            renderFilterPanel(app);
            renderFilterInputs();
            renderSavedViews();

            var keyboardHint = buildKeyboardHintText();
            if (keyboardHint) {
              app.appendChild(createEl('p', 'keyboard-hint', keyboardHint));
            }

            for (var r = 0; r < runsArray.length; r++) {
              var card = renderRunCard(runsArray[r], r);
              app.appendChild(card);
            }

            ensureListeners();
            renderAllRuns();
            setActiveRun(0);

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

    payload = prepare_history_payload(data)
    styles = build_history_styles()
    script = build_history_app_script()
    data_json = _safe_json_dumps(payload)

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

    _ensure_parent(output_path)
    html = render_single_file_html(data)
    output_path.write_text(html, encoding="utf-8")
    return output_path


def write_static_bundle(data: Any, output_dir: Path) -> Path:

    output_dir.mkdir(parents=True, exist_ok=True)
    payload = prepare_history_payload(data)
    styles = build_history_styles()
    script = build_history_app_script()
    data_json = _safe_json_dumps(payload)


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

