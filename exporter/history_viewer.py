"""Helpers to build static history viewer assets."""

from __future__ import annotations

import json
import textwrap
from html import escape
from pathlib import Path
from string import Template
from typing import Any, Dict

DEFAULT_TITLE = "AutoFix History Viewer"

_CSS = textwrap.dedent(
    """
    :root {
      color-scheme: light dark;
      --app-bg: #f7f9fc;
      --card-bg: #ffffff;
      --border-color: #d9e2f3;
      --accent: #1f6feb;
      --accent-soft: #e8f0fe;
      --text-primary: #0b1f33;
      --text-muted: #58687a;
      --shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
      --radius: 12px;
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
    }

    body {
      margin: 0;
      background: var(--app-bg);
      color: var(--text-primary);
      min-height: 100vh;
    }

    .app {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding: 24px;
      gap: 24px;
    }

    .app-header {
      background: var(--card-bg);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .app-header h1 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 600;
    }

    .subtitle {
      margin: 0;
      color: var(--text-muted);
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .toolbar input[type="search"] {
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      min-width: 220px;
      font-size: 0.95rem;
    }

    .toolbar button {
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 0.9rem;
      background: var(--accent);
      color: #fff;
      cursor: pointer;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }

    .toolbar button.secondary {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }

    .toolbar button:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(31, 111, 235, 0.25);
    }

    .status {
      min-height: 1.2rem;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .status.status-success {
      color: #0f7b3d;
    }

    .status.status-warning {
      color: #a06000;
    }

    .status.status-error {
      color: #b42318;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
      gap: 20px;
      flex: 1;
    }

    .summary-panel {
      background: var(--card-bg);
      border-radius: var(--radius);
      padding: 20px;
      box-shadow: var(--shadow);
      overflow: auto;
    }

    .summary-panel h2 {
      margin-top: 0;
      font-size: 1.2rem;
    }

    .summary-panel dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 6px 16px;
      margin: 0;
    }

    .summary-panel dt {
      color: var(--text-muted);
      font-weight: 500;
    }

    .summary-panel dd {
      margin: 0;
      font-weight: 600;
    }

    .type-counts {
      list-style: none;
      padding: 0;
      margin: 12px 0 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .type-counts li {
      background: var(--accent-soft);
      color: var(--accent);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.85rem;
    }

    .history-panel {
      display: grid;
      grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
      gap: 16px;
      align-items: flex-start;
    }

    .history-list {
      background: var(--card-bg);
      border-radius: var(--radius);
      padding: 16px 0;
      box-shadow: var(--shadow);
      max-height: 70vh;
      overflow: auto;
    }

    .history-list details {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .history-list details:last-child {
      border-bottom: none;
    }

    .history-list summary {
      cursor: pointer;
      font-weight: 600;
      outline: none;
    }

    .history-list details.is-active {
      background: var(--accent-soft);
    }

    .history-list pre {
      background: #0b1220;
      color: #e5edff;
      padding: 12px;
      border-radius: 8px;
      font-size: 0.85rem;
      overflow-x: auto;
    }

    .details-card {
      background: var(--card-bg);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 24px;
      min-height: 320px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .details-card h2 {
      margin: 0;
      font-size: 1.4rem;
    }

    .detail-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 8px 16px;
      margin: 0;
    }

    .detail-meta dt {
      font-weight: 500;
      color: var(--text-muted);
    }

    .detail-meta dd {
      margin: 0;
      font-weight: 600;
    }

    .json-view {
      background: #111827;
      color: #d1d5db;
      padding: 16px;
      border-radius: 10px;
      font-size: 0.85rem;
      overflow-x: auto;
    }

    .mermaid-container {
      background: #f4f7ff;
      border-radius: 10px;
      padding: 16px;
      border: 1px dashed var(--accent);
    }

    .mermaid-container h3 {
      margin-top: 0;
      font-size: 1.05rem;
    }

    .mermaid-rendered svg {
      max-width: 100%;
    }

    .empty {
      color: var(--text-muted);
      font-style: italic;
      margin: 0;
      padding: 16px;
    }

    dialog {
      border: none;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 24px;
      max-width: 520px;
      width: min(520px, 90vw);
    }

    dialog::backdrop {
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(3px);
    }

    @media (max-width: 960px) {
      .layout {
        grid-template-columns: 1fr;
      }

      .history-panel {
        grid-template-columns: 1fr;
      }

      .history-list {
        max-height: none;
      }
    }
    """
).strip()

_UI_JS = textwrap.dedent(
    """
    (function () {
      'use strict';

      var historyData = typeof window !== 'undefined' ? window.HISTORY_DATA : null;
      if (!historyData) {
        historyData = {};
      }

      var appTitleEl = document.getElementById('appTitle');
      if (appTitleEl && historyData && typeof historyData === 'object') {
        if (typeof historyData.title === 'string' && historyData.title.trim()) {
          appTitleEl.textContent = historyData.title.trim();
          document.title = historyData.title.trim();
        } else if (historyData.meta && typeof historyData.meta === 'object' && typeof historyData.meta.title === 'string') {
          appTitleEl.textContent = historyData.meta.title;
          document.title = historyData.meta.title;
        }
      }

      var summaryContainer = document.getElementById('summaryContent');
      var listContainer = document.getElementById('historyList');
      var detailContainer = document.getElementById('detailContent');
      var filterInput = document.getElementById('filterInput');
      var statusBanner = document.getElementById('statusBanner');
      var helpDialog = document.getElementById('helpDialog');

      var state = {
        entries: [],
        entriesKey: null,
        filtered: [],
        activeIndex: -1,
        activeEntry: null,
        searchTokens: [],
      };

      var searchCache = typeof WeakMap === 'function' ? new WeakMap() : null;
      var debounceTimer = null;
      var isBulkToggle = false;

      function normaliseEntries(payload) {
        var result = { entries: [], key: null };
        if (!payload) {
          return result;
        }
        if (Array.isArray(payload)) {
          result.entries = payload.slice();
          return result;
        }
        if (typeof payload !== 'object') {
          return result;
        }
        var candidateKeys = ['entries', 'items', 'events', 'history', 'runs', 'records', 'logs', 'log', 'requests', 'actions', 'steps'];
        for (var i = 0; i < candidateKeys.length; i += 1) {
          var key = candidateKeys[i];
          if (Array.isArray(payload[key])) {
            result.entries = payload[key].slice();
            result.key = key;
            return result;
          }
        }
        var fallbackKey = null;
        var fallbackEntries = null;
        Object.keys(payload).forEach(function (key) {
          var value = payload[key];
          if (!fallbackEntries && Array.isArray(value) && value.length && typeof value[0] === 'object') {
            fallbackEntries = value.slice();
            fallbackKey = key;
          }
        });
        if (fallbackEntries) {
          result.entries = fallbackEntries;
          result.key = fallbackKey;
        }
        return result;
      }

      function valueToText(value) {
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'string') {
          return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }
        if (Array.isArray(value)) {
          return value.map(valueToText).filter(Boolean).join(', ');
        }
        if (typeof value === 'object') {
          if (typeof value.id === 'string') {
            return value.id;
          }
          if (typeof value.name === 'string') {
            return value.name;
          }
        }
        return '';
      }

      function entryToSearchText(entry) {
        if (entry === null || entry === undefined) {
          return '';
        }
        if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
          return String(entry).toLowerCase();
        }
        if (searchCache && searchCache.has(entry)) {
          return searchCache.get(entry);
        }
        var text = '';
        if (Array.isArray(entry)) {
          text = entry.map(entryToSearchText).join(' ');
        } else if (typeof entry === 'object') {
          var parts = [];
          Object.keys(entry).forEach(function (key) {
            var val = entry[key];
            parts.push(key.toLowerCase());
            parts.push(entryToSearchText(val));
          });
          text = parts.join(' ');
        }
        text = text.toLowerCase();
        if (searchCache && typeof entry === 'object') {
          searchCache.set(entry, text);
        }
        return text;
      }

      function matchesQuery(entry, tokens) {
        if (!tokens.length) {
          return true;
        }
        var haystack = entryToSearchText(entry);
        for (var i = 0; i < tokens.length; i += 1) {
          if (haystack.indexOf(tokens[i]) === -1) {
            return false;
          }
        }
        return true;
      }

      function buildLabel(entry, index) {
        var parts = [];
        if (entry && typeof entry === 'object') {
          var id = entry.id || entry.requestId || (entry.request && entry.request.id) || entry.name;
          if (id) {
            parts.push(String(id));
          }
          var type = entry.type || entry.kind || entry.category;
          if (!type && entry.request && typeof entry.request.method === 'string') {
            type = entry.request.method;
          }
          if (type) {
            parts.push('[' + String(type) + ']');
          }
          var title = entry.title || entry.summary || entry.description || entry.url;
          if (title) {
            parts.push(String(title));
          }
          var status = entry.status || entry.result || entry.outcome;
          if (status) {
            parts.push('— ' + String(status));
          }
        }
        if (!parts.length) {
          parts.push('Entry #' + (index + 1));
        }
        return parts.join(' ');
      }

      function extractMermaid(entry) {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        if (typeof entry.mermaid === 'string') {
          return entry.mermaid;
        }
        if (typeof entry.mermaid_code === 'string') {
          return entry.mermaid_code;
        }
        if (entry.diagram && typeof entry.diagram === 'object') {
          if (typeof entry.diagram.code === 'string') {
            return entry.diagram.code;
          }
          if (typeof entry.diagram.mermaid === 'string') {
            return entry.diagram.mermaid;
          }
        }
        var keys = Object.keys(entry);
        for (var i = 0; i < keys.length; i += 1) {
          var key = keys[i];
          if (typeof entry[key] === 'string' && key.toLowerCase().indexOf('mermaid') !== -1) {
            return entry[key];
          }
        }
        return null;
      }

      function renderMermaid(code) {
        if (!detailContainer) {
          return;
        }
        var wrapper = document.createElement('div');
        wrapper.className = 'mermaid-container';
        var heading = document.createElement('h3');
        heading.textContent = 'Mermaid preview';
        wrapper.appendChild(heading);
        var pre = document.createElement('pre');
        pre.className = 'mermaid-snippet';
        pre.textContent = code;
        wrapper.appendChild(pre);
        var renderTarget = document.createElement('div');
        renderTarget.className = 'mermaid-rendered';
        wrapper.appendChild(renderTarget);
        detailContainer.appendChild(wrapper);

        if (window.mermaid && typeof window.mermaid.render === 'function') {
          try {
            var id = 'mermaid-' + Date.now() + '-' + Math.random().toString(16).slice(2);
            var result = window.mermaid.render(id, code);
            if (result && typeof result.then === 'function') {
              result.then(function (payload) {
                if (payload && typeof payload.svg === 'string') {
                  renderTarget.innerHTML = payload.svg;
                }
              }).catch(function (error) {
                console.warn('Mermaid render failed', error);
              });
            } else if (typeof result === 'string') {
              renderTarget.innerHTML = result;
            } else if (result && typeof result.svg === 'string') {
              renderTarget.innerHTML = result.svg;
            }
          } catch (error) {
            console.warn('Mermaid render failed', error);
          }
        }
      }

      function renderDetail(entry, index) {
        if (!detailContainer) {
          return;
        }
        detailContainer.innerHTML = '';
        if (!entry) {
          var empty = document.createElement('p');
          empty.className = 'empty';
          empty.textContent = 'Select an entry to inspect.';
          detailContainer.appendChild(empty);
          return;
        }

        var card = document.createElement('div');
        card.className = 'details-card';

        var heading = document.createElement('h2');
        heading.textContent = buildLabel(entry, index >= 0 ? index : 0);
        card.appendChild(heading);

        if (entry && typeof entry === 'object') {
          var keys = ['id', 'type', 'status', 'method', 'url', 'rule', 'severity', 'source', 'timestamp', 'time', 'duration_ms', 'durationMs'];
          var meta = [];
          for (var i = 0; i < keys.length; i += 1) {
            var key = keys[i];
            if (Object.prototype.hasOwnProperty.call(entry, key)) {
              meta.push([key, entry[key]]);
            }
          }
          if (meta.length) {
            var dl = document.createElement('dl');
            dl.className = 'detail-meta';
            meta.forEach(function (pair) {
              var dt = document.createElement('dt');
              dt.textContent = pair[0];
              var dd = document.createElement('dd');
              dd.textContent = valueToText(pair[1]) || JSON.stringify(pair[1]);
              dl.appendChild(dt);
              dl.appendChild(dd);
            });
            card.appendChild(dl);
          }
        }

        var jsonPre = document.createElement('pre');
        jsonPre.className = 'json-view';
        try {
          jsonPre.textContent = JSON.stringify(entry, null, 2);
        } catch (error) {
          jsonPre.textContent = String(entry);
        }
        card.appendChild(jsonPre);

        var mermaidCode = extractMermaid(entry);
        if (mermaidCode) {
          renderMermaid(mermaidCode);
        }

        detailContainer.appendChild(card);
      }

      function highlightActive() {
        if (!listContainer) {
          return;
        }
        var items = listContainer.querySelectorAll('details');
        items.forEach(function (detailsEl) {
          var idx = Number(detailsEl.getAttribute('data-index'));
          var isActive = idx === state.activeIndex;
          detailsEl.classList.toggle('is-active', isActive);
          if (isActive && !detailsEl.open) {
            detailsEl.open = true;
          }
        });
      }

      function setActive(index) {
        if (index < 0 || index >= state.filtered.length) {
          state.activeIndex = -1;
          state.activeEntry = null;
          renderDetail(null, -1);
          highlightActive();
          return;
        }
        state.activeIndex = index;
        state.activeEntry = state.filtered[index];
        highlightActive();
        renderDetail(state.activeEntry, index);
      }

      function createListItem(entry, index) {
        var detailsEl = document.createElement('details');
        detailsEl.setAttribute('data-index', String(index));
        var summaryEl = document.createElement('summary');
        summaryEl.textContent = buildLabel(entry, index);
        detailsEl.appendChild(summaryEl);
        var preview = document.createElement('pre');
        try {
          preview.textContent = JSON.stringify(entry, null, 2);
        } catch (error) {
          preview.textContent = String(entry);
        }
        detailsEl.appendChild(preview);

        summaryEl.addEventListener('click', function (event) {
          event.preventDefault();
          var shouldOpen = !detailsEl.open;
          if (!isBulkToggle) {
            var siblings = listContainer.querySelectorAll('details');
            siblings.forEach(function (sibling) {
              if (sibling !== detailsEl) {
                sibling.open = false;
                sibling.classList.remove('is-active');
              }
            });
          }
          detailsEl.open = shouldOpen;
          if (shouldOpen) {
            setActive(index);
          } else if (state.activeIndex === index) {
            setActive(-1);
          }
        });

        return detailsEl;
      }

      function renderList() {
        if (!listContainer) {
          return;
        }
        listContainer.innerHTML = '';
        if (!state.filtered.length) {
          var empty = document.createElement('p');
          empty.className = 'empty';
          empty.textContent = 'No records match the current filter.';
          listContainer.appendChild(empty);
          return;
        }
        state.filtered.forEach(function (entry, index) {
          var item = createListItem(entry, index);
          listContainer.appendChild(item);
        });
        highlightActive();
      }

      function countByType(entries) {
        var counts = {};
        entries.forEach(function (entry) {
          var type = 'entry';
          if (entry && typeof entry === 'object') {
            if (typeof entry.type === 'string') {
              type = entry.type;
            } else if (typeof entry.kind === 'string') {
              type = entry.kind;
            } else if (typeof entry.category === 'string') {
              type = entry.category;
            } else if (entry.request && typeof entry.request.method === 'string') {
              type = entry.request.method;
            }
          }
          if (!counts[type]) {
            counts[type] = 0;
          }
          counts[type] += 1;
        });
        return counts;
      }

      function renderDefinitionList(obj) {
        var wrapper = document.createElement('div');
        var dl = document.createElement('dl');
        dl.className = 'summary-meta';
        var keys = Object.keys(obj).slice(0, 20);
        keys.forEach(function (key) {
          var dt = document.createElement('dt');
          dt.textContent = key;
          var dd = document.createElement('dd');
          dd.textContent = valueToText(obj[key]) || JSON.stringify(obj[key]);
          dl.appendChild(dt);
          dl.appendChild(dd);
        });
        wrapper.appendChild(dl);
        return wrapper;
      }

      function renderSummary() {
        if (!summaryContainer) {
          return;
        }
        summaryContainer.innerHTML = '';
        var countsText = document.createElement('p');
        countsText.innerHTML = '<strong>' + state.filtered.length + '</strong> of <strong>' + state.entries.length + '</strong> entries shown.';
        summaryContainer.appendChild(countsText);

        var typeCounts = countByType(state.entries);
        var typeKeys = Object.keys(typeCounts);
        if (typeKeys.length) {
          var list = document.createElement('ul');
          list.className = 'type-counts';
          typeKeys.sort().forEach(function (key) {
            var li = document.createElement('li');
            li.textContent = key + ': ' + typeCounts[key];
            list.appendChild(li);
          });
          summaryContainer.appendChild(list);
        }

        if (historyData && typeof historyData === 'object') {
          if (historyData.summary && typeof historyData.summary === 'object') {
            summaryContainer.appendChild(renderDefinitionList(historyData.summary));
          } else if (historyData.meta && typeof historyData.meta === 'object') {
            summaryContainer.appendChild(renderDefinitionList(historyData.meta));
          }
        }
      }

      function setStatus(message, tone) {
        if (!statusBanner) {
          return;
        }
        statusBanner.textContent = message || '';
        var className = 'status';
        if (tone) {
          className += ' status-' + tone;
        }
        statusBanner.className = className;
      }

      function applyFilter() {
        var query = filterInput ? filterInput.value.trim().toLowerCase() : '';
        state.searchTokens = query ? query.split(/\\s+/).filter(Boolean) : [];
        if (!state.searchTokens.length) {
          state.filtered = state.entries.slice();
        } else {
          state.filtered = state.entries.filter(function (entry) {
            return matchesQuery(entry, state.searchTokens);
          });
        }
        state.activeIndex = state.filtered.length ? 0 : -1;
        renderList();
        renderSummary();
        if (state.activeIndex >= 0) {
          setActive(state.activeIndex);
        } else {
          setActive(-1);
        }
        setStatus(state.filtered.length + ' entries shown', 'info');
      }

      function scheduleFilter() {
        if (debounceTimer) {
          window.clearTimeout(debounceTimer);
        }
        debounceTimer = window.setTimeout(applyFilter, 120);
      }

      function copyActive() {
        if (!state.activeEntry) {
          setStatus('No entry selected to copy.', 'warning');
          return;
        }
        var payload = JSON.stringify(state.activeEntry, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(payload).then(function () {
            setStatus('Copied selection to clipboard.', 'success');
          }).catch(function () {
            fallbackCopy(payload);
          });
        } else {
          fallbackCopy(payload);
        }
      }

      function fallbackCopy(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
          document.execCommand('copy');
          setStatus('Copied selection to clipboard.', 'success');
        } catch (error) {
          setStatus('Clipboard copy failed.', 'error');
        }
        document.body.removeChild(textarea);
      }

      function buildExportPayload() {
        if (Array.isArray(historyData)) {
          return state.filtered;
        }
        if (historyData && typeof historyData === 'object') {
          var clone = {};
          Object.keys(historyData).forEach(function (key) {
            clone[key] = historyData[key];
          });
          if (state.entriesKey && Array.isArray(clone[state.entriesKey])) {
            clone[state.entriesKey] = state.filtered;
          } else if (Array.isArray(clone.entries)) {
            clone.entries = state.filtered;
          } else {
            clone.filtered = state.filtered;
          }
          return clone;
        }
        return state.filtered;
      }

      function exportFiltered() {
        if (!state.filtered.length) {
          setStatus('No entries to export.', 'warning');
          return;
        }
        var payload = buildExportPayload();
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'runlist.json';
        document.body.appendChild(link);
        link.click();
        window.setTimeout(function () {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 0);
        setStatus('Exported runlist.json', 'success');
      }

      function toggleDetails(open) {
        if (!listContainer) {
          return;
        }
        isBulkToggle = true;
        var items = listContainer.querySelectorAll('details');
        items.forEach(function (detailsEl) {
          detailsEl.open = open;
          if (!open) {
            detailsEl.classList.remove('is-active');
          }
        });
        isBulkToggle = false;
        if (!open) {
          setActive(-1);
        } else if (state.filtered.length) {
          setActive(0);
        }
      }

      function bindControls() {
        var clearBtn = document.getElementById('btnClear');
        var expandBtn = document.getElementById('btnExpand');
        var collapseBtn = document.getElementById('btnCollapse');
        var copyBtn = document.getElementById('btnCopy');
        var exportBtn = document.getElementById('btnExport');
        var helpBtn = document.getElementById('btnHelp');
        var helpClose = document.getElementById('helpClose');

        if (filterInput) {
          filterInput.addEventListener('input', scheduleFilter);
        }

        if (clearBtn) {
          clearBtn.addEventListener('click', function () {
            if (filterInput) {
              filterInput.value = '';
            }
            applyFilter();
            setStatus('Filter cleared.', 'info');
          });
        }

        if (expandBtn) {
          expandBtn.addEventListener('click', function () {
            toggleDetails(true);
            setStatus('Expanded all entries.', 'info');
          });
        }

        if (collapseBtn) {
          collapseBtn.addEventListener('click', function () {
            toggleDetails(false);
            setStatus('Collapsed all entries.', 'info');
          });
        }

        if (copyBtn) {
          copyBtn.addEventListener('click', copyActive);
        }

        if (exportBtn) {
          exportBtn.addEventListener('click', exportFiltered);
        }

        function toggleHelp() {
          if (!helpDialog || typeof helpDialog.showModal !== 'function') {
            window.alert('Keyboard shortcuts:\nCtrl/Cmd + F: focus filter\nCtrl/Cmd + /: toggle help\nCtrl/Cmd + Shift + E: export runlist');
            return;
          }
          if (helpDialog.open) {
            helpDialog.close();
          } else {
            helpDialog.showModal();
          }
        }

        if (helpBtn) {
          helpBtn.addEventListener('click', toggleHelp);
        }

        if (helpClose && helpDialog) {
          helpClose.addEventListener('click', function () {
            helpDialog.close();
          });
        }

        document.addEventListener('keydown', function (event) {
          var key = event.key || '';
          var lower = key.toLowerCase();
          if ((event.ctrlKey || event.metaKey) && lower === 'f') {
            if (filterInput) {
              event.preventDefault();
              filterInput.focus();
            }
          }
          if ((event.ctrlKey || event.metaKey) && event.shiftKey && lower === 'e') {
            event.preventDefault();
            exportFiltered();
          }
          if ((event.ctrlKey || event.metaKey) && key === '/') {
            event.preventDefault();
            toggleHelp();
          }
          if (key === 'Escape' && helpDialog && helpDialog.open) {
            helpDialog.close();
          }
        });
      }

      function initialise() {
        var normalised = normaliseEntries(historyData);
        state.entries = normalised.entries;
        state.entriesKey = normalised.key;
        state.filtered = normalised.entries.slice();
        renderSummary();
        renderList();
        if (state.filtered.length) {
          setActive(0);
        } else {
          setStatus('No history entries found in dataset.', 'warning');
        }
        bindControls();
      }

      initialise();
    })();
    """
).strip()

_SINGLE_FILE_TEMPLATE = Template(
    """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>$title</title>
    <style>
$css
    </style>
  </head>
  <body>
    <div class="app" id="app">
      <header class="app-header">
        <div>
          <h1 id="appTitle">$title</h1>
          <p class="subtitle">Offline history viewer generated by AutoFix exporter.</p>
        </div>
        <div class="toolbar">
          <input id="filterInput" type="search" placeholder="Filter entries (supports text search)" />
          <button id="btnClear" class="secondary" type="button">Clear</button>
          <button id="btnExpand" class="secondary" type="button">Expand</button>
          <button id="btnCollapse" class="secondary" type="button">Collapse</button>
          <button id="btnCopy" type="button">Copy</button>
          <button id="btnExport" type="button">Export</button>
          <button id="btnHelp" class="secondary" type="button">Help</button>
        </div>
        <div id="statusBanner" class="status" role="status" aria-live="polite"></div>
      </header>
      <main class="layout">
        <section class="summary-panel">
          <h2>Summary</h2>
          <div id="summaryContent"></div>
        </section>
        <section class="history-panel">
          <div class="history-list" id="historyList"></div>
          <div class="details-card" id="detailContent"></div>
        </section>
      </main>
    </div>
    <dialog id="helpDialog">
      <article>
        <header>
          <h2>Keyboard shortcuts</h2>
        </header>
        <ul>
          <li><strong>Ctrl/Cmd + F</strong> — Focus filter input</li>
          <li><strong>Ctrl/Cmd + /</strong> — Toggle this help</li>
          <li><strong>Ctrl/Cmd + Shift + E</strong> — Export filtered runlist</li>
        </ul>
        <footer>
          <button id="helpClose" type="button">Close</button>
        </footer>
      </article>
    </dialog>
    <script>
$data_script
    </script>
    <script>
$ui_script
    </script>
  </body>
</html>
"""
)

_ASSET_INDEX_TEMPLATE = Template(
    """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>$title</title>
    <style>
$css
    </style>
  </head>
  <body>
    <div class="app" id="app">
      <header class="app-header">
        <div>
          <h1 id="appTitle">$title</h1>
          <p class="subtitle">Offline history viewer generated by AutoFix exporter.</p>
        </div>
        <div class="toolbar">
          <input id="filterInput" type="search" placeholder="Filter entries (supports text search)" />
          <button id="btnClear" class="secondary" type="button">Clear</button>
          <button id="btnExpand" class="secondary" type="button">Expand</button>
          <button id="btnCollapse" class="secondary" type="button">Collapse</button>
          <button id="btnCopy" type="button">Copy</button>
          <button id="btnExport" type="button">Export</button>
          <button id="btnHelp" class="secondary" type="button">Help</button>
        </div>
        <div id="statusBanner" class="status" role="status" aria-live="polite"></div>
      </header>
      <main class="layout">
        <section class="summary-panel">
          <h2>Summary</h2>
          <div id="summaryContent"></div>
        </section>
        <section class="history-panel">
          <div class="history-list" id="historyList"></div>
          <div class="details-card" id="detailContent"></div>
        </section>
      </main>
    </div>
    <dialog id="helpDialog">
      <article>
        <header>
          <h2>Keyboard shortcuts</h2>
        </header>
        <ul>
          <li><strong>Ctrl/Cmd + F</strong> — Focus filter input</li>
          <li><strong>Ctrl/Cmd + /</strong> — Toggle this help</li>
          <li><strong>Ctrl/Cmd + Shift + E</strong> — Export filtered runlist</li>
        </ul>
        <footer>
          <button id="helpClose" type="button">Close</button>
        </footer>
      </article>
    </dialog>
    <script src="data.js"></script>
    <script src="ui.js"></script>
  </body>
</html>
"""
)


def load_history_data(path: Path | str) -> Any:
    """Load and validate a JSON history file."""
    json_path = Path(path)
    if not json_path.exists():
        raise ValueError(f"History JSON not found: {json_path}")
    try:
        raw = json_path.read_text(encoding="utf-8")
    except OSError as exc:  # pragma: no cover - surfaced to CLI
        raise ValueError(f"Unable to read {json_path}: {exc}") from exc
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {json_path}: {exc}") from exc
    if not isinstance(data, (dict, list)):
        raise ValueError("History data must be a JSON object or array.")
    return data


def _json_to_js_literal(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def _make_data_assignment(data: Any) -> str:
    literal = _json_to_js_literal(data)
    safe_literal = literal.replace('</', '<\\/')
    return f"window.HISTORY_DATA = {safe_literal};"


def generate_single_file_html(data: Any, *, title: str = DEFAULT_TITLE) -> str:
    """Return an HTML document containing the embedded history viewer."""
    final_title = title or DEFAULT_TITLE
    css_block = textwrap.indent(_CSS, "      ")
    data_script = textwrap.indent(_make_data_assignment(data), "      ")
    ui_script = textwrap.indent(_UI_JS, "      ")
    return _SINGLE_FILE_TEMPLATE.substitute(
        title=escape(final_title),
        css=css_block,
        data_script=data_script,
        ui_script=ui_script,
    )


def generate_asset_bundle(data: Any, *, title: str = DEFAULT_TITLE) -> Dict[str, str]:
    """Build the static bundle (index.html, ui.js, data.js)."""
    final_title = title or DEFAULT_TITLE
    css_block = textwrap.indent(_CSS, "      ")
    index_html = _ASSET_INDEX_TEMPLATE.substitute(title=escape(final_title), css=css_block)
    data_js = _make_data_assignment(data) + "\n"
    ui_js = _UI_JS + "\n"
    return {
        "index.html": index_html,
        "data.js": data_js,
        "ui.js": ui_js,
    }
