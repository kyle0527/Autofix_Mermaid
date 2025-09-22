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
    """Collect large payloads for lazy rendering in the UI."""

    def __init__(self) -> None:
        self._values: dict[str, str] = {}
        self._counter = 0

    def add(self, text: str | None) -> str | None:
        if not text:
            return None
        trimmed = text[:MAX_BLOB_SIZE]
        if not trimmed:
            return None
        self._counter += 1
        name = f"blob-{self._counter}"
        self._values[name] = trimmed
        return name

    def as_dict(self) -> dict[str, str]:
        return dict(self._values)


def _clone_data(data: Any) -> Any:
    try:
        return copy.deepcopy(data)
    except Exception:  # pragma: no cover - defensive
        return data


def _ensure_mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _looks_like_token(value: str | None) -> bool:
    if not value:
        return False
    if TOKEN_VALUE_PATTERN.search(value):
        return True
    compact = WHITESPACE_RE.sub("", value)
    return bool(compact and len(compact) >= 16 and LONG_TOKEN_PATTERN.match(compact))


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
                sanitized.append({"key": key, "value": _redact_value(key, item.get("value"))})
            elif isinstance(item, (list, tuple)) and item:
                key = item[0]
                sanitized.append([key, _redact_value(key, item[1] if len(item) > 1 else "")])
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
    query_pairs = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if _is_sensitive_key(key) or _looks_like_token(value):
            query_pairs.append((key, REDACTED_VALUE))
        else:
            query_pairs.append((key, value))
    safe_path = [REDACTED_VALUE if _looks_like_token(part) else part for part in parsed.path.split("/")]
    sanitised = parsed._replace(path="/".join(safe_path), query=urlencode(query_pairs, doseq=True))
    return urlunsplit(sanitised)


def _prepare_body_fields(body: Any, preview: Any, blobs: BlobStore) -> tuple[str | None, str | None, bool]:
    body_text = "" if body is None else str(body)
    preview_text = "" if preview is None else str(preview)
    if not preview_text:
        preview_text = body_text[:PREVIEW_LIMIT]
    else:
        preview_text = preview_text[:PREVIEW_LIMIT]
    blob_id = None
    truncated = False
    if body_text and body_text != preview_text:
        blob_id = blobs.add(body_text)
        truncated = bool(blob_id)
    return preview_text or None, blob_id, truncated


def _sanitize_message(data: Any, blobs: BlobStore, *, include_method: bool = False) -> MutableMapping[str, Any]:
    result: MutableMapping[str, Any] = {}  # type: ignore[assignment]
    mapping = _ensure_mapping(data)
    if include_method:
        method = mapping.get("method")
        result["method"] = str(method).upper() if method else ""
    url = mapping.get("url")
    sanitized_url = _sanitize_url(url)
    if sanitized_url:
        result["url"] = sanitized_url
    headers = mapping.get("headers")
    sanitized_headers = _sanitize_headers(headers)
    if sanitized_headers is not None:
        result["headers"] = sanitized_headers
    for field in ("status", "reason"):
        if field in mapping:
            result[field] = mapping[field]
    preview, blob_id, truncated = _prepare_body_fields(mapping.get("body"), mapping.get("body_preview"), blobs)
    if preview is not None:
        result["body_preview"] = preview
    if blob_id:
        result["body_blob"] = blob_id
    if truncated:
        result["body_truncated"] = True
    return result


def _sanitize_history_entry(entry: Any, blobs: BlobStore, source: str) -> MutableMapping[str, Any]:
    mapping = _ensure_mapping(entry)
    result: MutableMapping[str, Any] = {}  # type: ignore[assignment]
    for key in ("id", "ts"):
        if key in mapping:
            result[key] = mapping[key]
    tags = mapping.get("tags")
    if isinstance(tags, Iterable) and not isinstance(tags, (str, bytes, bytearray)):
        result["tags"] = [str(tag) for tag in tags]
    result["request"] = _sanitize_message(mapping.get("request"), blobs, include_method=True)
    result["response"] = _sanitize_message(mapping.get("response"), blobs)
    result["source"] = source
    return result


def _sanitize_history_collection(entries: Any, blobs: BlobStore, source: str) -> list[MutableMapping[str, Any]]:
    if not entries:
        return []
    if isinstance(entries, Iterable) and not isinstance(entries, (str, bytes, bytearray)):
        return [_sanitize_history_entry(item, blobs, source) for item in entries]
    return []


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
    fallback = mapping.get("history")
    if fallback and not result.get("history"):
        result["history"] = _sanitize_history_collection(fallback, blobs, "history")
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
    project.setdefault("name", "Autofix Project")
    run_metadata = payload.setdefault("run_metadata", {})
    tool_versions = run_metadata.setdefault("tool_versions", {})
    tool_versions.setdefault("autofix", tool_versions.get("autofix", "unknown"))
    tool_versions.setdefault("mermaid", tool_versions.get("mermaid", "unknown"))
    tool_versions["ui"] = UI_VERSION
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

        .history-app {
            max-width: 1080px;
            margin: 0 auto;
            padding: 32px 20px 96px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .app-header {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .app-title {
            margin: 0;
            font-size: 1.8rem;
        }

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
            font-size: 0.8rem;
            cursor: pointer;
            transition: background 0.2s ease;
        }

        .chip-button:hover {
            background: var(--accent-muted);
        }

        .view-saver {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
        }

        .saved-views {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .saved-views .saved-view {
            display: inline-flex;
            gap: 4px;
            align-items: center;
            background: var(--surface-muted);
            border-radius: 999px;
            padding: 2px 8px;
        }

        .history-card {
            background: var(--surface);
            border-radius: 16px;
            border: 1px solid var(--border);
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .history-card[data-active="true"] {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-muted);
        }

        .run-title {
            margin: 0;
            font-size: 1.4rem;
        }

        .run-actions {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
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

        .entry-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
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
            align-items: center;
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
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

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
            }
        }
        """
    ).strip()


def build_history_app_script() -> str:
    return textwrap.dedent(
        """
        (function () {
          var STORAGE_PINS_KEY = 'autofix.history.pins';
          var STORAGE_VIEWS_KEY = 'autofix.history.views';
          var PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
          var DEFAULT_PAGE_SIZE = 50;
          var ACTION_ORDER = ['expand-all', 'collapse-all', 'copy-summary', 'copy-run', 'copy-urls', 'export-runlist'];
          var ACTION_INFO = {
            'expand-all': { label: 'Expand all', shortcut: 'Shift+E' },
            'collapse-all': { label: 'Collapse all', shortcut: 'Shift+W' },
            'copy-summary': { label: 'Copy summary', shortcut: 'Shift+C' },
            'copy-run': { label: 'Copy run JSON', shortcut: 'Shift+J' },
            'copy-urls': { label: 'Copy URLs', shortcut: 'Shift+L' },
            'export-runlist': { label: 'Export runlist', shortcut: 'Shift+X' }
          };
          var shortcutMap = {
            'Shift+E': 'expand-all',
            'Shift+W': 'collapse-all',
            'Shift+C': 'copy-summary',
            'Shift+J': 'copy-run',
            'Shift+L': 'copy-urls',
            'Shift+X': 'export-runlist'
          };

          var state = {
            runs: [],
            normalizedRuns: [],
            filterOptions: { methods: [], hosts: [], tags: [] },
            filters: { method: 'any', status: 'any', host: 'any', tag: 'any', source: 'any', path: '' },
            search: '',
            pagination: {},
            pins: {},
            savedViews: {},
            selections: {},
            activeRun: 0,
            visibleEntries: {},
            focusedEntry: null,
            statusTimer: null
          };

          function safeArray(value) {
            return Array.isArray(value) ? value.slice() : [];
          }

          function byId(id) {
            return document.getElementById(id);
          }

          function createEl(tag, className, text) {
            var el = document.createElement(tag);
            if (className) {
              el.className = className;
            }
            if (typeof text === 'string') {
              el.textContent = text;
            }
            return el;
          }

          function createKeyValue(label, value) {
            var wrapper = createEl('div', 'key-value', '');
            wrapper.appendChild(createEl('div', 'summary-label', label));
            wrapper.appendChild(createEl('div', 'summary-value', value));
            return wrapper;
          }

          function createPre(label, text) {
            var wrapper = document.createElement('div');
            wrapper.appendChild(createEl('div', 'summary-label', label));
            var pre = document.createElement('pre');
            pre.textContent = text;
            wrapper.appendChild(pre);
            return wrapper;
          }

          function formatValue(value) {
            if (value === undefined || value === null || value === '') {
              return '—';
            }
            if (typeof value === 'number' && !(Number.isFinite ? Number.isFinite(value) : isFinite(value))) {
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
            if (event.ctrlKey) { parts.push('Ctrl'); }
            if (event.metaKey) { parts.push('Meta'); }
            if (event.altKey) { parts.push('Alt'); }
            if (event.shiftKey) { parts.push('Shift'); }
            var key = event.key || '';
            if (key.length === 1) { key = key.toUpperCase(); }
            parts.push(key);
            return parts.join('+');
          }

          function makeEntryKey(runIndex, entryId) {
            return String(runIndex) + '::' + String(entryId);
          }

          function loadJson(key) {
            try {
              var raw = window.localStorage ? window.localStorage.getItem(key) : null;
              if (!raw) { return {}; }
              var parsed = JSON.parse(raw);
              return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (err) {
              console.warn('Unable to load', key, err);
              return {};
            }
          }

          function saveJson(key, value) {
            try {
              if (!window.localStorage) { return; }
              window.localStorage.setItem(key, JSON.stringify(value));
            } catch (err) {
              console.warn('Unable to persist', key, err);
            }
          }

          function loadPins() {
            state.pins = loadJson(STORAGE_PINS_KEY);
          }

          function persistPins() {
            saveJson(STORAGE_PINS_KEY, state.pins);
          }

          function loadSavedViews() {
            state.savedViews = loadJson(STORAGE_VIEWS_KEY);
          }

          function persistSavedViews() {
            saveJson(STORAGE_VIEWS_KEY, state.savedViews);
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

          function normaliseEntry(entry, runIndex, source, blobs) {
            var request = entry.request || {};
            var response = entry.response || {};
            var method = (request.method || '').toUpperCase();
            var url = request.url || '';
            var parts = extractUrlParts(url);
            var status = response.status;
            var statusNumber = typeof status === 'number' ? status : parseInt(status || '', 10);
            var tags = Array.isArray(entry.tags) ? entry.tags.slice() : [];
            var previewBits = [method, url];
            if (request.body_preview) { previewBits.push(String(request.body_preview)); }
            if (response.body_preview) { previewBits.push(String(response.body_preview)); }
            if (tags.length) { previewBits.push(tags.join(' ')); }
            return {
              id: entry.id !== undefined && entry.id !== null ? entry.id : makeEntryKey(runIndex, previewBits.join('-')),
              source: source,
              method: method,
              url: url,
              host: parts.host,
              path: parts.path,
              href: parts.href,
              status: isNaN(statusNumber) ? null : statusNumber,
              tags: tags,
              ts: entry.ts || '',
              request: request,
              response: response,
              previewText: previewBits.join(' ').toLowerCase(),
              blobs: blobs
            };
          }

          function collectEntries(run, runIndex) {
            var blobs = run.blobs && typeof run.blobs === 'object' ? run.blobs : {};
            var items = [];
            var proxy = safeArray(run.history_proxy);
            for (var i = 0; i < proxy.length; i++) {
              items.push(normaliseEntry(proxy[i], runIndex, 'proxy', blobs));
            }
            var repeater = safeArray(run.history_repeater);
            for (var j = 0; j < repeater.length; j++) {
              items.push(normaliseEntry(repeater[j], runIndex, 'repeater', blobs));
            }
            var fallback = safeArray(run.history);
            for (var k = 0; k < fallback.length; k++) {
              items.push(normaliseEntry(fallback[k], runIndex, 'history', blobs));
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
                if (entry.method) { methods[entry.method] = true; }
                if (entry.host) { hosts[entry.host] = true; }
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
            var pagination = getPaginationState(runIndex);
            pagination.page = 1;
          }

          function getSelectionState(runIndex) {
            if (!state.selections[runIndex]) {
              state.selections[runIndex] = {};
            }
            return state.selections[runIndex];
          }

          function isPinned(runIndex, entryId) {
            var key = makeEntryKey(runIndex, entryId);
            return !!(state.pins[key]);
          }

          function setPinned(runIndex, entryId, value) {
            var key = makeEntryKey(runIndex, entryId);
            if (value) {
              state.pins[key] = true;
            } else {
              delete state.pins[key];
            }
            persistPins();
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
            var filtered = [];
            var entries = run.entries;
            for (var i = 0; i < entries.length; i++) {
              if (matchesFilters(entries[i])) {
                filtered.push(entries[i]);
              }
            }
            var pinned = [];
            var remainder = [];
            for (var j = 0; j < filtered.length; j++) {
              var entry = filtered[j];
              if (isPinned(runIndex, entry.id)) {
                pinned.push(entry);
              } else {
                remainder.push(entry);
              }
            }
            return { pinned: pinned, entries: remainder, total: filtered.length };
          }

          function renderEntry(entry, runIndex, selectionState) {
            var details = document.createElement('details');
            details.className = 'history-item';
            details.setAttribute('data-entry-id', String(entry.id));
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
            title.appendChild(primary);
            var secondaryBits = [];
            if (entry.status) { secondaryBits.push('Status ' + entry.status); }
            if (entry.host) { secondaryBits.push(entry.host); }
            if (entry.tags.length) { secondaryBits.push('Tags: ' + entry.tags.join(', ')); }
            if (entry.ts) { secondaryBits.push(entry.ts); }
            title.appendChild(createEl('div', 'entry-secondary', secondaryBits.join(' · ')));
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
              requestSection.appendChild(createPre('Request headers', JSON.stringify(entry.request.headers, null, 2)));
            }
            if (entry.request.body_preview) {
              requestSection.appendChild(createPre('Request preview', String(entry.request.body_preview)));
            }
            if (entry.request.body_blob) {
              var reqActions = createEl('div', 'body-actions', '');
              var showRequest = document.createElement('button');
              showRequest.type = 'button';
              showRequest.textContent = 'Show full request';
              showRequest.setAttribute('data-action', 'show-full');
              showRequest.setAttribute('data-field', 'request');
              showRequest.setAttribute('data-run-index', String(runIndex));
              showRequest.setAttribute('data-entry-id', String(entry.id));
              reqActions.appendChild(showRequest);
              requestSection.appendChild(reqActions);
            }
            body.appendChild(requestSection);

            var responseSection = document.createElement('div');
            responseSection.appendChild(createKeyValue('Status', entry.status || ''));
            if (entry.response.headers) {
              responseSection.appendChild(createPre('Response headers', JSON.stringify(entry.response.headers, null, 2)));
            }
            if (entry.response.body_preview) {
              responseSection.appendChild(createPre('Response preview', String(entry.response.body_preview)));
            }
            if (entry.response.body_blob) {
              var resActions = createEl('div', 'body-actions', '');
              var showResponse = document.createElement('button');
              showResponse.type = 'button';
              showResponse.textContent = 'Show full response';
              showResponse.setAttribute('data-action', 'show-full');
              showResponse.setAttribute('data-field', 'response');
              showResponse.setAttribute('data-run-index', String(runIndex));
              showResponse.setAttribute('data-entry-id', String(entry.id));
              resActions.appendChild(showResponse);
              responseSection.appendChild(resActions);
            }
            body.appendChild(responseSection);

            details.appendChild(body);
            return details;
          }

          function renderEntriesForRun(runIndex) {
            var card = getRunCard(runIndex);
            if (!card) {
              return;
            }
            var sections = gatherEntriesForRun(runIndex);
            var selectionState = getSelectionState(runIndex);
            var pagination = getPaginationState(runIndex);
            var total = sections.entries.length;
            var pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));
            if (pagination.page > pageCount) {
              pagination.page = pageCount;
            }
            var start = (pagination.page - 1) * pagination.pageSize;
            var pageEntries = sections.entries.slice(start, start + pagination.pageSize);

            state.visibleEntries[runIndex] = [];

            var pinnedContainer = card.querySelector('[data-pinned-container]');
            if (pinnedContainer) {
              pinnedContainer.innerHTML = '';
              if (sections.pinned.length) {
                pinnedContainer.appendChild(createEl('h4', '', 'Pinned entries'));
                for (var i = 0; i < sections.pinned.length; i++) {
                  var pinnedEntry = renderEntry(sections.pinned[i], runIndex, selectionState);
                  pinnedEntry.setAttribute('open', 'true');
                  pinnedContainer.appendChild(pinnedEntry);
                  state.visibleEntries[runIndex].push(String(sections.pinned[i].id));
                }
              } else {
                pinnedContainer.appendChild(createEl('p', 'empty-state', 'Pin entries to keep them handy.'));
              }
            }

            var listContainer = card.querySelector('[data-entry-container]');
            if (listContainer) {
              listContainer.innerHTML = '';
              if (!pageEntries.length) {
                listContainer.appendChild(createEl('p', 'empty-state', 'No entries match the current filters.'));
              } else {
                for (var j = 0; j < pageEntries.length; j++) {
                  var entryDetails = renderEntry(pageEntries[j], runIndex, selectionState);
                  listContainer.appendChild(entryDetails);
                  state.visibleEntries[runIndex].push(String(pageEntries[j].id));
                }
              }
            }

            var indicator = card.querySelector('[data-entries-count]');
            if (indicator) {
              var pinnedLabel = sections.pinned.length ? ' · ' + sections.pinned.length + ' pinned' : '';
              indicator.textContent = 'Showing ' + pageEntries.length + ' of ' + sections.total + ' entries' + pinnedLabel;
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

          function renderAllRuns() {
            for (var i = 0; i < state.normalizedRuns.length; i++) {
              renderEntriesForRun(i);
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
            var entries = state.visibleEntries[state.activeRun] || [];
            if (!entries.length) {
              return;
            }
            var currentIndex = 0;
            if (state.focusedEntry && state.focusedEntry.run === state.activeRun) {
              currentIndex = entries.indexOf(String(state.focusedEntry.entry));
              if (currentIndex === -1) { currentIndex = 0; }
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
            focusEntry(state.activeRun, entries[nextIndex]);
          }

          function toggleFocusedEntry(open) {
            if (!state.focusedEntry) {
              return;
            }
            var selector = '[data-run-card="' + state.focusedEntry.run + '"] [data-entry-id="' + state.focusedEntry.entry + '"]';
            var details = document.querySelector(selector);
            if (!details || details.tagName !== 'DETAILS') {
              return;
            }
            if (open === undefined) {
              details.open = !details.open;
            } else {
              details.open = open;
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
            var lines = ['Run ' + runId];
            var pairs = buildRunSummary(run);
            for (var i = 0; i < pairs.length; i++) {
              lines.push(pairs[i][0] + ': ' + formatValue(pairs[i][1]));
            }
            return lines.join('\n');
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
              var info = ACTION_INFO[action];
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
              var item = createEl('div', 'summary-item', '');
              item.appendChild(createEl('div', 'summary-label', pair[0]));
              item.appendChild(createEl('div', 'summary-value', formatValue(pair[1])));
              summaryGrid.appendChild(item);
            }
            card.appendChild(summaryGrid);

            var pinnedSection = createEl('div', 'pinned-section', '');
            pinnedSection.setAttribute('data-pinned-container', '');
            card.appendChild(pinnedSection);

            var listContainer = createEl('div', 'entry-list', '');
            listContainer.setAttribute('data-entry-container', '');
            card.appendChild(listContainer);

            renderPaginationControls(card, index);
            return card;
          }

          function populateSelect(select, options, placeholder) {
            if (!select) {
              return;
            }
            var current = select.value;
            var frag = document.createDocumentFragment();
            var placeholderOption = document.createElement('option');
            placeholderOption.value = 'any';
            placeholderOption.textContent = placeholder;
            frag.appendChild(placeholderOption);
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

          function renderFilterInputs() {
            var methodSelect = document.querySelector('[data-filter-input="method"]');
            var statusSelect = document.querySelector('[data-filter-input="status"]');
            var hostSelect = document.querySelector('[data-filter-input="host"]');
            var tagSelect = document.querySelector('[data-filter-input="tag"]');
            var sourceSelect = document.querySelector('[data-filter-input="source"]');
            var pathInput = document.querySelector('[data-filter-input="path"]');
            var searchInput = document.querySelector('[data-search-input="preview"]');

            populateSelect(methodSelect, state.filterOptions.methods, 'Any method');
            populateSelect(hostSelect, state.filterOptions.hosts, 'Any host');
            populateSelect(tagSelect, state.filterOptions.tags, 'Any tag');

            if (methodSelect) { methodSelect.value = state.filters.method || 'any'; }
            if (statusSelect) { statusSelect.value = state.filters.status || 'any'; }
            if (hostSelect) { hostSelect.value = state.filters.host || 'any'; }
            if (tagSelect) { tagSelect.value = state.filters.tag || 'any'; }
            if (sourceSelect) { sourceSelect.value = state.filters.source || 'any'; }
            if (pathInput) { pathInput.value = state.filters.path || ''; }
            if (searchInput) { searchInput.value = state.search || ''; }
          }

          function renderSavedViews() {
            var container = document.querySelector('[data-saved-views]');
            if (!container) {
              return;
            }
            container.innerHTML = '';
            var names = Object.keys(state.savedViews).sort();
            for (var i = 0; i < names.length; i++) {
              var name = names[i];
              var wrapper = createEl('div', 'saved-view', '');
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

          function renderFilterPanel(app) {
            var controls = createEl('section', 'view-controls', '');
            var panel = createEl('div', 'filter-panel', '');

            function addSelect(label, key, options, placeholder) {
              var field = createEl('div', 'filter-field', '');
              var fieldLabel = document.createElement('label');
              fieldLabel.textContent = label;
              field.appendChild(fieldLabel);
              var select = document.createElement('select');
              select.setAttribute('data-filter-input', key);
              for (var i = 0; i < options.length; i++) {
                var opt = document.createElement('option');
                opt.value = options[i];
                opt.textContent = options[i];
                select.appendChild(opt);
              }
              if (placeholder) {
                select.value = placeholder;
              }
              field.appendChild(select);
              panel.appendChild(field);
              return select;
            }

            addSelect('Method', 'method', ['any'], 'any');
            var statusField = addSelect('Status', 'status', ['any', '2xx', '3xx', '4xx', '5xx'], 'any');
            statusField.setAttribute('data-filter-input', 'status');
            addSelect('Host', 'host', ['any'], 'any');
            addSelect('Tag', 'tag', ['any'], 'any');
            var sourceField = addSelect('Source', 'source', ['any', 'proxy', 'repeater', 'history'], 'any');
            sourceField.setAttribute('data-filter-input', 'source');

            var pathField = createEl('div', 'filter-field', '');
            var pathLabel = document.createElement('label');
            pathLabel.textContent = 'Path contains';
            pathField.appendChild(pathLabel);
            var pathInput = document.createElement('input');
            pathInput.type = 'text';
            pathInput.placeholder = '/admin';
            pathInput.setAttribute('data-filter-input', 'path');
            pathField.appendChild(pathInput);
            panel.appendChild(pathField);

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

          function buildKeyboardHint() {
            var hints = [];
            for (var i = 0; i < ACTION_ORDER.length; i++) {
              var info = ACTION_INFO[ACTION_ORDER[i]];
              if (info && info.shortcut) {
                hints.push(info.shortcut + ' → ' + info.label);
              }
            }
            hints.push('↑/↓ → Navigate entries');
            hints.push('Enter/Space → Toggle entry');
            hints.push('Esc → Collapse entry');
            return hints.length ? 'Keyboard shortcuts: ' + hints.join(' · ') : '';
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
            } catch (err) {
              console.error('Copy failed', err);
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
            } catch (err) {
              console.error('Export failed', err);
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
              } catch (err) {
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
                return item.method + ' ' + item.url + ' #' + item.source;
              }).join('\n');
              copyText(text).then(function () {
                showStatus('URLs copied to clipboard');
              });
            },
            'export-runlist': function (runIndex) {
              var selections = gatherSelectedEntries(runIndex);
              var payload = selections.length ? selections : gatherSampleExportEntries(runIndex);
              if (!payload.length) {
                showStatus('No entries to export');
                return;
              }
              downloadJson('runlist.json', { requests: payload });
              showStatus('runlist.json downloaded');
            }
          };

          var ACTION_HANDLERS = {
            filter: function (el) {
              var filter = el.getAttribute('data-filter') || '';
              var parts = filter.split(':');
              if (parts.length === 2) {
                state.filters[parts[0]] = parts[1];
                if (parts[0] !== 'path') {
                  renderFilterInputs();
                }
              }
              state.pagination = {};
              renderAllRuns();
            },
            'clear-filters': function () {
              state.filters = { method: 'any', status: 'any', host: 'any', tag: 'any', source: 'any', path: '' };
              state.search = '';
              state.pagination = {};
              renderFilterInputs();
              renderAllRuns();
            },
            toggle: function (el) {
              var target = el.getAttribute('data-target');
              if (!target) { return; }
              var details = document.querySelector(target);
              if (details && details.tagName === 'DETAILS') {
                details.open = !details.open;
              }
            },
            copy: function (el) {
              var runIndex = parseIndex(el.getAttribute('data-run-index'), state.activeRun);
              var entryId = el.getAttribute('data-entry-id');
              var field = el.getAttribute('data-field');
              var run = getRunData(runIndex);
              if (!run) {
                showStatus('Entry unavailable');
                return;
              }
              for (var i = 0; i < run.entries.length; i++) {
                var entry = run.entries[i];
                if (String(entry.id) === String(entryId)) {
                  var payload = field === 'response' ? entry.response : entry.request;
                  var text;
                  try {
                    text = JSON.stringify(payload, null, 2);
                  } catch (err) {
                    text = String(payload);
                  }
                  return copyText(text).then(function () {
                    showStatus('Copied ' + field);
                  });
                }
              }
              showStatus('Entry not found');
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
                  var body = entry.blobs && entry.blobs[payload.body_blob];
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
                  var parent = el.parentNode && el.parentNode.parentNode ? el.parentNode.parentNode : null;
                  if (parent) {
                    parent.appendChild(pre);
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
              if (!name) {
                showStatus('Name required to save view');
                return;
              }
              state.savedViews[name] = {
                filters: JSON.parse(JSON.stringify(state.filters)),
                search: state.search
              };
              persistSavedViews();
              renderSavedViews();
              if (input) {
                input.value = '';
              }
              showStatus('View saved');
            },
            'load-view': function (el) {
              var name = el.getAttribute('data-view-name');
              var view = state.savedViews[name];
              if (!view) {
                showStatus('View not found');
                return;
              }
              state.filters = JSON.parse(JSON.stringify(view.filters));
              state.search = view.search || '';
              state.pagination = {};
              renderFilterInputs();
              renderAllRuns();
              showStatus('View applied');
            },
            'delete-view': function (el) {
              var name = el.getAttribute('data-view-name');
              if (name && state.savedViews[name]) {
                delete state.savedViews[name];
                persistSavedViews();
                renderSavedViews();
                showStatus('View deleted');
              }
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

          function saveView(name) {
            if (!name) {
              showStatus('Name required to save view');
              return;
            }
            state.savedViews[name] = {
              filters: JSON.parse(JSON.stringify(state.filters)),
              search: state.search
            };
            persistSavedViews();
            renderSavedViews();
            showStatus('View saved');
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

            var header = createEl('section', 'app-header', '');
            header.appendChild(createEl('h1', 'app-title', data.project && data.project.name ? data.project.name + ' · History' : 'Autofix History'));
            header.appendChild(createEl('p', 'app-subtitle', 'Browse the most recent Autofix run completely offline.'));

            var meta = createEl('div', 'app-meta', '');
            if (data.project) {
              if (data.project.name) {
                meta.appendChild(createKeyValue('Project', data.project.name));
              }
              if (data.project.created_at) {
                meta.appendChild(createKeyValue('Created', data.project.created_at));
              }
            }
            if (data.run_metadata) {
              if (data.run_metadata.branch) {
                meta.appendChild(createKeyValue('Branch', data.run_metadata.branch));
              }
              if (data.run_metadata.commit) {
                meta.appendChild(createKeyValue('Commit', data.run_metadata.commit));
              }
              if (data.run_metadata.tool_versions) {
                meta.appendChild(createKeyValue('Tool versions', JSON.stringify(data.run_metadata.tool_versions, null, 2)));
              }
            }
            header.appendChild(meta);
            app.appendChild(header);

            var status = createEl('div', 'status-banner', '');
            status.id = 'app-status';
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            app.appendChild(status);

            if (!state.normalizedRuns.length) {
              app.appendChild(createEl('p', 'empty-state', 'No runs recorded yet.'));
              ensureListeners();
              return;
            }

            renderFilterPanel(app);
            renderFilterInputs();
            renderSavedViews();

            var keyboardHint = buildKeyboardHint();
            if (keyboardHint) {
              app.appendChild(createEl('p', 'keyboard-hint', keyboardHint));
            }

            for (var r = 0; r < state.normalizedRuns.length; r++) {
              var card = renderRunCard(state.normalizedRuns[r].run, r);
              app.appendChild(card);
            }

            ensureListeners();
            renderAllRuns();
            setActiveRun(0);
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

