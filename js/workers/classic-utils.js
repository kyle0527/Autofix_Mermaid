/* eslint-env worker */
(function (global) {
  'use strict';

  const DEFAULT_LOCALE = 'zh-Hant';
  const LOCALE_STRINGS = {
    'zh-Hant': {
      'engine.unavailable': '規則引擎不可用',
      'engine.loadFailed': '規則引擎無法載入：{error}',
      'log.noteEngineUnavailable': '引擎不可用，已返回原始程式碼',
      'log.mode': '模式：{mode}',
      'log.version': '版本：{version}',
      'log.duration': '耗時 {duration} ms',
      'log.engineLoaded': '引擎可用：{value}',
      'log.error': '錯誤：{message}',
      'fallback.sequenceNote': '失敗通知',
      'fallback.flowchartNode': '分析失敗',
      'fallback.flowchartEdge': '原因',
      'pipeline.error': '規則分析失敗：{error}',
    },
    en: {
      'engine.unavailable': 'Rules engine unavailable',
      'engine.loadFailed': 'Failed to load rules engine: {error}',
      'log.noteEngineUnavailable': 'Engine unavailable, returned original code',
      'log.mode': 'Mode: {mode}',
      'log.version': 'Version: {version}',
      'log.duration': 'Duration {duration} ms',
      'log.engineLoaded': 'Engine available: {value}',
      'log.error': 'Error: {message}',
      'fallback.sequenceNote': 'Failure notice',
      'fallback.flowchartNode': 'Analysis failed',
      'fallback.flowchartEdge': 'Reason',
      'pipeline.error': 'Rules analysis failed: {error}',
    },
  };

  function resolveLocale(locale) {
    if (locale && LOCALE_STRINGS[locale]) {
      return locale;
    }
    if (typeof locale === 'string') {
      const normalized = locale.toLowerCase();
      const match = Object.keys(LOCALE_STRINGS).find((key) => {
        const lower = key.toLowerCase();
        return normalized === lower || normalized.startsWith(lower);
      });
      if (match) return match;
    }
    return DEFAULT_LOCALE;
  }

  function getStrings(locale) {
    const resolved = resolveLocale(locale);
    return LOCALE_STRINGS[resolved] || LOCALE_STRINGS[DEFAULT_LOCALE];
  }

  function formatMessage(template, params) {
    return template.replace(/\{(\w+)\}/g, (match, token) => {
      if (Object.prototype.hasOwnProperty.call(params, token)) {
        return String(params[token]);
      }
      return match;
    });
  }

  function localize(key, locale, params = {}) {
    if (!key) return '';
    const strings = getStrings(locale);
    const template = strings[key] ?? key;
    if (typeof template !== 'string') {
      return key;
    }
    return formatMessage(template, params);
  }

  function guessDiagram(files = {}, options = {}) {
    if (options && typeof options.diagram === 'string') {
      return options.diagram;
    }

    const mermaidSource = typeof files.mermaid === 'string' ? files.mermaid : '';
    const trimmed = mermaidSource.trim();

    if (/^sequenceDiagram\b/m.test(trimmed)) return 'sequenceDiagram';
    if (/^classDiagram\b/m.test(trimmed)) return 'classDiagram';
    if (/^stateDiagram\b/m.test(trimmed)) return 'stateDiagram';
    if (/^erDiagram\b/m.test(trimmed)) return 'erDiagram';
    if (/^gantt\b/m.test(trimmed)) return 'gantt';
    if (/^journey\b/m.test(trimmed)) return 'journey';
    if (/^(flowchart|graph)\b/m.test(trimmed)) return 'flowchart';

    return 'flowchart';
  }

  function escapeForMermaid(text) {
    return String(text ?? '')
      .replace(/`/g, '\\`')
      .replace(/\r?\n+/g, ' ')
      .slice(0, 300);
  }

  function buildFallbackDiagram(message, diagram, locale = DEFAULT_LOCALE) {
    const safe = escapeForMermaid(message || localize('fallback.flowchartNode', locale));
    const strings = getStrings(locale);
    if (diagram === 'sequenceDiagram') {
      return `sequenceDiagram\n  autonumber\n  participant W as Worker\n  participant U as UI\n  W->>U: ${strings['fallback.sequenceNote']}\n  Note over W: ${safe}`;
    }
    if (diagram === 'classDiagram') {
      return `classDiagram\n  class WorkerError {\n    +message: ${safe}\n  }`;
    }
    return `flowchart TD\n  ERR[${strings['fallback.flowchartNode']}]\n  ERR -->|${strings['fallback.flowchartEdge']}| MSG[${safe}]`;
  }

  function composeWorkerLog(baseLog = [], meta = {}, locale = DEFAULT_LOCALE) {
    const entries = Array.isArray(baseLog) ? [...baseLog] : [];

    if (meta.mode) {
      entries.push({ rule: 'worker.mode', msg: localize('log.mode', locale, { mode: meta.mode }) });
    }
    if (meta.version) {
      entries.push({ rule: 'worker.version', msg: localize('log.version', locale, { version: meta.version }) });
    }
    if (Number.isFinite(meta.duration)) {
      entries.push({ rule: 'worker.duration', msg: localize('log.duration', locale, { duration: Math.round(meta.duration) }) });
    }
    if (typeof meta.engineLoaded === 'boolean') {
      entries.push({ rule: 'worker.engineLoaded', msg: localize('log.engineLoaded', locale, { value: meta.engineLoaded }) });
    }
    if (meta.note) {
      entries.push({ rule: 'worker.note', msg: meta.note });
    }
    if (meta.error) {
      entries.push({ rule: 'worker.error', msg: meta.error });
    }

    return entries;
  }

  function toErrorMessage(error) {
    if (!error) return '';
    if (error instanceof Error) {
      return error.message || error.name || 'Error';
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch (_) {
      return String(error);
    }
  }

  global.ClassicWorkerUtils = Object.freeze({
    guessDiagram,
    buildFallbackDiagram,
    composeWorkerLog,
    toErrorMessage,
    resolveLocale,
    localize,
  });
})(self);
