import { t, onLocaleChange, getLocale } from './i18n/index.js';
import { applyLayoutSelection } from './layout.js';


/**
 * 建立 worker 實例，依 engineMode 切換 classic/AI
 * @param {string} engineMode - 'rules' | 'ai'
 * @returns {Worker} worker 實例
 */
function cacheBustedUrl(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  url.searchParams.set('v', Date.now().toString());
  return url;
}

function createWorker(engineMode) {
  if (engineMode === 'ai') {
    return new Worker(cacheBustedUrl('./worker.mjs'), { type: 'module' });
  }
  // 預設 classic/rules
  return new Worker(cacheBustedUrl('./worker.js'), { type: 'classic' });
}
/**
 * UI Controller Module
 * @fileoverview Handles user interface interactions and worker communication
 */

/**
 * DOM element selector utility
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} DOM element or null
 */
const $ = (id) => document.getElementById(id);

/**
 * Mermaid diagram detection patterns
 */
const MERMAID_PATTERNS = {
  INIT_DIRECTIVE: /^(%%\{.*\}%%)/m,
  DIAGRAM_TYPES: /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|journey|gitGraph|timeline|mindmap|sankey|xychart(?:-beta)?|block|packetDiagram)\b/,
  DIAGRAM_SYNTAX: /(-->|\-\->|==>|o\-\-|subgraph\s+|end\s*$|\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})/m,
};

// Debounce to avoid excessive re-rendering while typing
function debounce(fn, delay = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Check if text appears to be Mermaid diagram code
 * @param {string} text - Text to analyze
 * @returns {boolean} True if likely Mermaid syntax
 */
function isLikelyMermaid(text) {
  const trimmedText = (text || '').trim();
  
  if (!trimmedText) {
    return false;
  }
  
  // Check for init directives
  if (MERMAID_PATTERNS.INIT_DIRECTIVE.test(trimmedText)) {
    return true;
  }
  
  // Check for diagram type headers
  if (MERMAID_PATTERNS.DIAGRAM_TYPES.test(trimmedText)) {
    return true;
  }
  
  // Check for common Mermaid syntax patterns
  if (MERMAID_PATTERNS.DIAGRAM_SYNTAX.test(trimmedText)) {
    return true;
  }
  
  return false;
}

/**
 * Normalize Mermaid header to ensure single, correct header format
 * @param {string} text - Input text
 * @returns {string} Normalized text with proper header
 */
function normalizeHeader(text) {
  let content = String(text || '').replace(/^\uFEFF/, '');
  
  // Fix glued headers like: "flowchart TDflowchart TB ..."
  content = content.replace(/\b(TD|TB|LR|RL)\s*(?=(?:flowchart|graph)\b)/ig, '$1\n');
  
  const lines = content.split(/\r?\n/);
  const initLines = [];
  let currentIndex = 0;
  
  // Collect leading init/comment/blank lines (keep them)
  while (currentIndex < lines.length) {
    const line = lines[currentIndex].trim();
    // keep blanks, init directive lines, and regular %% comments
    if (
      line === '' ||
      /^%%\{.*\}%%$/.test(line) ||
      /^%%(?!\{)/.test(line)
    ) {
      initLines.push(lines[currentIndex]);
      currentIndex += 1;
      continue;
    }
    break;
  }
  
  const headerRegex = /^(?:flowchart|graph)\s+[A-Za-z]{2}\b/i;
  const classSeqRegex = /^(classDiagram|sequenceDiagram)\b/i;
  let detectedType = '';
  let restIndex = currentIndex;
  
  // Remove all consecutive headers (and blanks) after init section
  while (restIndex < lines.length) {
    const line = lines[restIndex].trim();
    if (line === '') {
      restIndex += 1;
      continue;
    }
    
    if (headerRegex.test(line)) {
      if (!detectedType) detectedType = 'flowchart';
      restIndex += 1;
      continue;
    }
    
    const classSeqMatch = line.match(classSeqRegex);
    if (classSeqMatch) {
      if (!detectedType) detectedType = classSeqMatch[1];
      restIndex += 1;
      continue;
    }
    
    break;
  }
  
  const remainingLines = lines.slice(restIndex);
  
  // If the first few lines in rest still start with a header, strip only the header prefix
  const stripHeaderPrefix = (line) => 
    line.replace(/^\s*(?:flowchart|graph)\s+[A-Za-z]{2}\b\s*/i, '')
        .replace(/^\s*(?:classDiagram|sequenceDiagram)\b\s*/i, '');
  
  for (let index = 0; index < Math.min(remainingLines.length, 5); index += 1) {
    const line = remainingLines[index].trim();
    if (/^(?:flowchart|graph)\s+[A-Za-z]{2}\b/i.test(line) || 
        /^(?:classDiagram|sequenceDiagram)\b/i.test(line)) {
      remainingLines[index] = stripHeaderPrefix(remainingLines[index]);
    } else {
      // Stop early once we hit a normal content line
      break;
    }
  }

  // Build normalized output
  const output = [];
  if (initLines.length) output.push(...initLines);
  
  if (detectedType === 'classDiagram' || detectedType === 'sequenceDiagram') {
    output.push(detectedType);
  } else {
    output.push('flowchart TD');
  }
  
  return output.join('\n') + '\n' + remainingLines.join('\n');
}

/**
 * Initialize UI components and event handlers
 * @param {Function} renderMermaid - Mermaid rendering function
 * @param {Function} svgToPNG - SVG to PNG conversion function  
 * @param {Function} initMermaid - Mermaid initialization function
 */
function initializeUI(renderMermaid, svgToPNG, initMermaid) {
  const initialLastResult = {
    code: '',
    svg: '',
    errors: [],
    log: [],
    dtype: '',
    trace: [],
    fragments: [],
    links: [],
    notes: [],
    detection: null,
    plugin: null,
    rawCode: '',
    engine: { source: null, version: null, attempts: [] },
    ir: null,
    debugText: '',
    debugMeta: { reason: null, error: null },
  };
  let lastResult = { ...initialLastResult };
  const STORAGE_KEY = 'autofix_mermaid_ui_v1';
  let noticeTimer = null;

  /**
   * Set application status
   * @param {boolean} isOk - Whether operation was successful
   * @param {string} message - Status message
   */
  const statusState = {
    isOk: true,
    key: null,
    params: {},
    message: '',
  };

  function applyStatusLocale() {
    const statusElement = $('status');
    const messageElement = $('statusMsg');
    if (statusElement) {
      statusElement.textContent = statusState.isOk ? t('status.okShort') : t('status.workingShort');
    }
    if (messageElement) {
      const text = statusState.key ? t(statusState.key, statusState.params) : statusState.message;
      messageElement.textContent = text || '';
    }
  }

  function setStatus(isOk, messageOrOptions, maybeParams = {}) {
    statusState.isOk = !!isOk;
    statusState.key = null;
    statusState.params = {};
    statusState.message = '';

    if (typeof messageOrOptions === 'string') {
      if (messageOrOptions.includes('.')) {
        statusState.key = messageOrOptions;
        statusState.params = maybeParams || {};
      } else {
        statusState.message = messageOrOptions;
      }
    } else if (messageOrOptions && typeof messageOrOptions === 'object') {
      statusState.key = messageOrOptions.key || null;
      statusState.params = messageOrOptions.params || {};
      statusState.message = messageOrOptions.message || '';
    }

    applyStatusLocale();
  }

  onLocaleChange(() => {
    applyStatusLocale();
    updateDebugPanel(lastResult);
    updateAnalysisPanel(lastResult);
  });

  // mark helper as used to avoid lint warning
  /* eslint-disable no-unused-vars */
  void ensureMermaidInit;

  /**
   * Show user notification
   * @param {string} message - Notification message
   */
  function showNotice(message) {
    const noticeElement = $('notice');
    if (!noticeElement) return;

    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }

    noticeElement.textContent = message || '';
    noticeElement.style.display = message ? 'block' : 'none';
  }

  function showTransientNotice(message, duration = 4000) {
    showNotice(message);
    if (!message || duration <= 0) return;
    noticeTimer = setTimeout(() => {
      try {
        showNotice('');
      } catch (error) {
        console.warn('Failed to clear transient notice:', error);
      }
    }, duration);
  }

  function resetAnalysisPanel() {
    const panel = $('analysisPanel');
    if (panel) panel.setAttribute('data-has-data', 'false');

    const summaryElement = $('analysisSummary');
    if (summaryElement) {
      summaryElement.textContent = t('panel.analysis.empty');
    }

    const detectionElement = $('analysisDetection');
    if (detectionElement) {
      detectionElement.textContent = '';
    }

    const fragmentsContainer = $('analysisFragments');
    if (fragmentsContainer) {
      fragmentsContainer.innerHTML = '';
      const placeholder = document.createElement('p');
      placeholder.textContent = t('panel.analysis.fragmentsEmpty');
      fragmentsContainer.appendChild(placeholder);
    }

    const linksContainer = $('analysisLinks');
    if (linksContainer) {
      linksContainer.innerHTML = '';
      const placeholder = document.createElement('p');
      placeholder.textContent = t('panel.analysis.linksEmpty');
      linksContainer.appendChild(placeholder);
    }

    const combined = $('analysisCombined');
    if (combined instanceof HTMLTextAreaElement) {
      combined.value = '';
    }
  }

  function updateAnalysisPanel(result = lastResult) {
    const panel = $('analysisPanel');
    if (!panel) return;

    const fragments = Array.isArray(result?.fragments) ? result.fragments : [];
    const links = Array.isArray(result?.links) ? result.links : [];
    const notes = Array.isArray(result?.notes) ? result.notes : [];
    const dtype = typeof result?.dtype === 'string' ? result.dtype : '';
    let hasData = false;

    const summaryElement = $('analysisSummary');
    if (summaryElement) {
      if (!fragments.length && !links.length && !notes.length && !result?.code) {
        summaryElement.textContent = t('panel.analysis.empty');
      } else {
        hasData = true;
        const parts = [];
        if (dtype) parts.push(t('panel.analysis.summary.diagram', { value: dtype }));
        parts.push(t('panel.analysis.summary.fragments', { count: fragments.length }));
        parts.push(t('panel.analysis.summary.links', { count: links.length }));
        if (notes.length) parts.push(t('panel.analysis.summary.notes', { count: notes.length }));
        if (result?.engine?.source) {
          parts.push(t('panel.analysis.summary.engine', { source: result.engine.source }));
        }
        if (result?.engine?.version) {
          parts.push(t('panel.analysis.summary.version', { value: result.engine.version }));
        }
        summaryElement.textContent = parts.filter(Boolean).join(' • ');
      }
    }

    const detectionElement = $('analysisDetection');
    if (detectionElement) {
      const detection = result?.detection;
      if (detection && typeof detection === 'object' && detection.lang) {
        hasData = true;
        const confidence = typeof detection.confidence === 'number'
          ? detection.confidence.toFixed(2)
          : detection.confidence ?? t('debug.value.na');
        detectionElement.textContent = t('panel.analysis.detection', {
          lang: detection.lang,
          confidence,
        });
      } else {
        detectionElement.textContent = '';
      }
    }

    const fragmentsContainer = $('analysisFragments');
    if (fragmentsContainer) {
      fragmentsContainer.innerHTML = '';
      if (!fragments.length) {
        const placeholder = document.createElement('p');
        placeholder.textContent = t('panel.analysis.fragmentsEmpty');
        fragmentsContainer.appendChild(placeholder);
      } else {
        hasData = true;
        const list = document.createElement('ul');
        fragments.forEach((fragment, index) => {
          const item = document.createElement('li');
          item.className = 'analysis-fragment';

          const header = document.createElement('div');
          header.className = 'analysis-fragment__header';

          const titleSpan = document.createElement('span');
          const displayTitle = fragment?.title || fragment?.id || t('panel.analysis.fragment.untitled');
          titleSpan.textContent = `${index + 1}. ${displayTitle}`;
          header.appendChild(titleSpan);

          if (fragment?.code) {
            const copyButton = document.createElement('button');
            copyButton.type = 'button';
            copyButton.className = 'btn-ghost analysis-fragment__copy';
            copyButton.textContent = t('panel.analysis.fragment.copy');
            copyButton.dataset.fragmentIndex = String(index);
            header.appendChild(copyButton);
          }

          item.appendChild(header);

          const metaParts = [];
          if (fragment?.id) metaParts.push(`#${fragment.id}`);
          const moduleName = fragment?.source?.module;
          if (moduleName) metaParts.push(t('panel.analysis.fragment.module', { module: moduleName }));
          const className = fragment?.source?.class;
          if (className) metaParts.push(t('panel.analysis.fragment.class', { name: className }));
          const functionName = fragment?.source?.function || fragment?.source?.method;
          if (functionName) metaParts.push(t('panel.analysis.fragment.function', { name: functionName }));
          const pathName = fragment?.source?.path;
          if (pathName) metaParts.push(pathName);
          if (metaParts.length) {
            const meta = document.createElement('div');
            meta.className = 'analysis-fragment__meta';
            meta.textContent = metaParts.join(' • ');
            item.appendChild(meta);
          }

          if (fragment?.anchors?.entry || fragment?.anchors?.exit) {
            const anchors = document.createElement('div');
            anchors.className = 'analysis-fragment__anchors';
            anchors.textContent = t('panel.analysis.fragment.anchors', {
              entry: fragment?.anchors?.entry || t('panel.analysis.fragment.noAnchor'),
              exit: fragment?.anchors?.exit || t('panel.analysis.fragment.noAnchor'),
            });
            item.appendChild(anchors);
          }

          list.appendChild(item);
        });
        fragmentsContainer.appendChild(list);
      }
    }

    const linksContainer = $('analysisLinks');
    if (linksContainer) {
      linksContainer.innerHTML = '';
      if (!links.length) {
        const placeholder = document.createElement('p');
        placeholder.textContent = t('panel.analysis.linksEmpty');
        linksContainer.appendChild(placeholder);
      } else {
        hasData = true;
        const list = document.createElement('div');
        list.className = 'analysis-links';
        links.forEach((link) => {
          const entry = document.createElement('div');
          entry.className = 'analysis-link';
          const fromAnchor = link?.fromAnchor ? `:${link.fromAnchor}` : '';
          const toAnchor = link?.toAnchor ? `:${link.toAnchor}` : '';
          const label = link?.label ? ` (${link.label})` : '';
          entry.textContent = t('panel.analysis.link.entry', {
            from: `${link?.fromFragment || '?' }${fromAnchor}`,
            to: `${link?.toFragment || '?' }${toAnchor}`,
            label,
          });
          list.appendChild(entry);
        });
        linksContainer.appendChild(list);
      }
    }

    const combined = $('analysisCombined');
    if (combined instanceof HTMLTextAreaElement) {
      const code = typeof result?.code === 'string' ? result.code : '';
      combined.value = code;
      if (code && code.trim()) {
        hasData = true;
      }
    }

    panel.setAttribute('data-has-data', hasData ? 'true' : 'false');
  }

  function clearDebugPanel() {
    lastResult = { ...initialLastResult };
    updateDebugPanel(lastResult, { reason: null, error: null });
    resetAnalysisPanel();
  }

  function formatLogEntry(entry) {
    if (!entry) return '';
    if (typeof entry === 'string') {
      return entry;
    }
    const rule = entry.rule || 'log';
    const message = entry.msg || entry.message || '';
    const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
    return `${t('debug.log.entry', { rule, message })}${meta}`;
  }

  function buildDebugText(result = {}, context = {}) {
    const target = result || {};
    const reason = context?.reason || null;
    const errorMessage = context?.error ? String(context.error) : '';
    const hasData = Boolean(
      (target.code && String(target.code).trim()) ||
      (Array.isArray(target.errors) && target.errors.length) ||
      (Array.isArray(target.log) && target.log.length) ||
      (Array.isArray(target.trace) && target.trace.length) ||
      (Array.isArray(target.fragments) && target.fragments.length) ||
      (Array.isArray(target.links) && target.links.length) ||
      (Array.isArray(target.notes) && target.notes.length) ||
      target.detection ||
      target.plugin
    );

    if (!hasData && !reason && !errorMessage) {
      return t('debug.empty');
    }

    const lines = [];
    if (reason === 'direct') {
      lines.push(t('debug.directRender'));
    } else if (reason === 'worker') {
      lines.push(t('debug.workerRender'));
    }
    if (errorMessage) {
      lines.push(t('debug.error', { message: errorMessage }));
    }

    const engine = target.engine || {};
    lines.push(`${t('debug.section.engine')}:`);
    lines.push(`  ${t('debug.engine.source', { value: engine.source || t('debug.value.na') })}`);
    if (engine.version) {
      lines.push(`  ${t('debug.engine.version', { value: engine.version })}`);
    }
    if (engine.error) {
      lines.push(`  ${t('debug.engine.error', { value: engine.error })}`);
    }
    const attempts = Array.isArray(engine.attempts) ? engine.attempts : [];
    if (attempts.length) {
      lines.push(`  ${t('debug.engine.attempts')}`);
      attempts.slice(0, 10).forEach((attempt) => {
        const key = attempt?.ok ? 'debug.engine.attempt.ok' : 'debug.engine.attempt.fail';
        const detail = attempt?.error?.message ? ` ${t('debug.engine.attempt.detail', { message: attempt.error.message })}` : '';
        lines.push(`    ${t(key, { source: attempt?.source || t('debug.value.unknown') })}${detail}`);
      });
      if (attempts.length > 10) {
        lines.push(`    ${t('debug.value.more', { count: attempts.length - 10 })}`);
      }
    }

    const detection = target.detection;
    if (detection && typeof detection === 'object') {
      const confidence = typeof detection.confidence === 'number'
        ? detection.confidence.toFixed(2)
        : detection.confidence || t('debug.value.na');
      lines.push('');
      lines.push(`${t('debug.section.detection')}: ${t('debug.detection.summary', { lang: detection.lang || t('debug.value.unknown'), confidence })}`);
      if (Array.isArray(detection.matchedFiles) && detection.matchedFiles.length) {
        lines.push(`  ${t('debug.detection.files', { value: detection.matchedFiles.join(', ') })}`);
      }
    }

    const plugin = target.plugin;
    if (plugin && typeof plugin === 'object') {
      lines.push('');
      lines.push(`${t('debug.section.plugin')}: ${t('debug.plugin.summary', { lang: plugin.lang || t('debug.value.unknown'), version: plugin.version || t('debug.value.na') })}`);
      if (Array.isArray(plugin.aliases) && plugin.aliases.length) {
        lines.push(`  ${t('debug.plugin.aliases', { value: plugin.aliases.join(', ') })}`);
      }
      if (plugin.treeSitterModule) {
        lines.push(`  ${t('debug.plugin.treeSitter', { value: plugin.treeSitterModule })}`);
      }
    }

    const specs = [
      {
        title: `${t('debug.section.trace')}:`,
        values: Array.isArray(target.trace) ? target.trace : [],
        limit: 12,
        formatter: (entry) => {
          if (!entry) return '';
          const duration = Number.isFinite(entry.durationMs) ? Math.round(entry.durationMs) : t('debug.value.na');
          const details = entry.details ? ` - ${entry.details}` : '';
          return `  ${t('debug.trace.entry', { stage: entry.stage || t('debug.value.unknown'), duration, details })}`;
        },
      },
      {
        title: `${t('debug.section.notes')}:`,
        values: Array.isArray(target.notes) ? target.notes : [],
        limit: 10,
        formatter: (note) => (note ? `  ${t('debug.note.entry', { note })}` : ''),
      },
      {
        title: `${t('debug.section.fragments')}:`,
        values: Array.isArray(target.fragments) ? target.fragments : [],
        limit: 8,
        formatter: (fragment) => `  ${t('debug.fragment.entry', { id: fragment?.id || t('debug.value.unknown'), diagram: fragment?.diagram || t('debug.value.unknown'), title: fragment?.title || t('debug.value.na') })}`,
      },
      {
        title: `${t('debug.section.links')}:`,
        values: Array.isArray(target.links) ? target.links : [],
        limit: 8,
        formatter: (link) => {
          const label = link?.label ? ` [${link.label}]` : '';
          return `  ${t('debug.link.entry', { from: link?.fromFragment || t('debug.value.unknown'), to: link?.toFragment || t('debug.value.unknown') })}${label}`;
        },
      },
      {
        title: `${t('debug.section.errors')}:`,
        values: Array.isArray(target.errors) ? target.errors : [],
        limit: 5,
        formatter: (err) => {
          const stack = err?.stack ? `\n    ${err.stack}` : '';
          return `  ${t('debug.errors.entry', { message: err?.message || t('debug.value.unknown') })}${stack}`;
        },
      },
      {
        title: `${t('debug.section.log')}:`,
        values: Array.isArray(target.log) ? target.log : [],
        limit: 12,
        formatter: (entry) => {
          const formatted = formatLogEntry(entry);
          return formatted ? `  ${formatted}` : '';
        },
      },
    ];

    specs.forEach(({ title, values, limit, formatter }) => {
      if (!values.length) return;
      lines.push('');
      lines.push(title);
      values.slice(0, limit).forEach((value, index) => {
        const formatted = formatter(value, index);
        if (formatted) {
          lines.push(formatted);
        }
      });
      if (values.length > limit) {
        lines.push(`  ${t('debug.value.more', { count: values.length - limit })}`);
      }
    });

    const raw = typeof target.rawCode === 'string' ? target.rawCode : '';
    lines.push('');
    lines.push(`${t('debug.section.raw')}:`);
    lines.push(`  ${t('debug.raw.length', { value: raw ? raw.length : 0 })}`);

    return lines.filter(Boolean).join('\n') || t('debug.empty');
  }

  function updateDebugPanel(result = lastResult, options = {}) {
    const target = result && typeof result === 'object' ? result : lastResult;
    const context = { ...(target?.debugMeta || {}), ...options };
    const text = buildDebugText(target, context);

    if (target && typeof target === 'object') {
      target.debugText = text;
      target.debugMeta = context;
    }
    if (lastResult && typeof lastResult === 'object' && lastResult !== target) {
      lastResult.debugText = text;
      lastResult.debugMeta = context;
    }

    const debugElement = $('debugLog');
    if (debugElement) {
      debugElement.textContent = text;
      const panel = $('debugPanel');
      if (panel) {
        const computed = typeof window !== 'undefined'
          ? window.getComputedStyle(panel)
          : { display: panel.style.display || 'block' };
        if (computed.display !== 'none') {
          debugElement.scrollTop = debugElement.scrollHeight;
        }
      }
    }
    return text;
  }

  // Persist a snapshot of current UI settings
  function saveSettingsSnapshot() {
    try {
      const sourceMode = (document.querySelector('input[name="sourceMode"]:checked') || { value: 'auto' }).value;
      let existing = {};
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            existing = parsed;
          }
        }
      } catch {}

      const docSelect = document.getElementById('docSelect') || document.getElementById('doc-select');
      const docsPanel = document.getElementById('docsPanel');
      const configPanel = document.getElementById('configPanel');

      existing.src = $('src')?.value || '';
      existing.svgW = $('svgW')?.value || '';
      existing.svgH = $('svgH')?.value || '';
      existing.pngBG = $('pngBG')?.value || 'transparent';
      existing.diagramType = $('diagramType')?.value || 'flowchart';
      existing.secLevel = $('secLevel')?.value || 'strict';
      existing.engineSelect = $('engineSelect')?.value || 'rules';
      existing.aiProvider = $('aiProvider')?.value || 'none';
      existing.autoRender = !!$('autoRender')?.checked;
      existing.sourceMode = sourceMode;
      existing.rulesVersion = getRuleConfig()?.version || null;

      if (docSelect instanceof HTMLSelectElement) {
        existing.docsSelection = docSelect.value || '';
      }
      if (docsPanel) {
        existing.docsVisible = docsPanel.style.display !== 'none';
      }
      if (configPanel) {
        existing.configVisible = configPanel.style.display !== 'none';
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch {}
  }

  const runAnalysis = (requestReason = 'render') => {
    saveSettingsSnapshot();
    return processInput({ reason: requestReason });
  };

  async function copyToClipboard(text) {
    if (typeof text !== 'string' || !text) {
      return false;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      console.warn('navigator.clipboard.writeText failed:', error);
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch (error) {
      console.warn('Fallback clipboard copy failed:', error);
      return false;
    }
  }

  /**
   * Download file to user's computer
   * @param {string} fileName - Name for downloaded file
   * @param {string|Blob} data - File data
   * @param {string} mimeType - MIME type
   */
  function downloadFile(fileName, data, mimeType = 'text/plain') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    
    setTimeout(() => URL.revokeObjectURL(url), 300);
  }

  /**
   * Ensure Mermaid is initialized with current settings
   */
  function ensureMermaidInit() {
    const securityLevel = $('secLevel')?.value || 'strict';
    
    try {
      initMermaid?.({ 
        securityLevel, 
        logLevel: 'fatal' 
      });
    } catch (error) {
      console.warn('Mermaid initialization skipped/failed:', error);
    }
  }

  /**
   * Enable export buttons after successful rendering
   */
  function enableExportButtons() {
    const exportButtons = ['btnExportImage', 'btnExportMMD', 'btnExportSVG', 'btnExportPNG', 'btnExportErrors', 'btnExportFixlog'];
    exportButtons.forEach(buttonId => {
      const button = $(buttonId);
      if (button) {
        button.disabled = false;
      }
    });
  }

  /**
   * Main processing function
   * @param {boolean} autoMode - Whether in auto mode
   * @returns {Promise<Object|null>} Processing result
   */
  async function processInput({ reason = 'render' } = {}) {
    try {
      const svgContainer = $('svg');
      const logElement = $('log');

      clearDebugPanel();

      // Clear previous results safely
      if (svgContainer) {
        while (svgContainer.firstChild) {
          svgContainer.removeChild(svgContainer.firstChild);
        }
      }
      if (logElement) logElement.textContent = '';
      
      setStatus(false, 'status.analyzing');

      const diagramType = $('diagramType')?.value || 'flowchart';
      const width = parseInt($('svgW')?.value || '0', 10) || 0;
      const height = parseInt($('svgH')?.value || '0', 10) || 0;
      const layoutMode = $('layoutSelect')?.value || 'default';

      const sourceMode = (document.querySelector('input[name="sourceMode"]:checked') || { value: 'auto' }).value;
      const engineMode = $('engineSelect')?.value || 'rules'; // rules | ai
      const aiProvider = $('aiProvider')?.value || 'none';
      const inputText = $('src')?.value || '';
      const hasFiles = !!($('fileInput')?.files && $('fileInput').files.length > 0);
      const shouldForceWorker = reason === 'autofix';

      try {
        if (window?.mermaid) {
          applyLayoutSelection(window.mermaid, layoutMode);
        }
      } catch (error) {
        console.warn('Failed to apply layout selection:', error);
      }

      // Direct Mermaid rendering path
      if (!shouldForceWorker && !hasFiles && (sourceMode === 'mermaid' || (sourceMode === 'auto' && isLikelyMermaid(inputText)))) {

        let processedInput = inputText;
        try {
          processedInput = await preprocessRulepack(inputText);
        } catch (error) {
          console.warn('Rule preprocess step failed:', error);
        }
        const normalizedCode = normalizeHeader(processedInput);

        const renderResult = await renderMermaid(normalizedCode, { width, height });

        if (renderResult.error) {
          throw new Error(renderResult.error);
        }
        
        // Safe SVG insertion using DOMParser
        if (svgContainer) {
          try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(renderResult.svg, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;
            
            // Clear existing content safely
            while (svgContainer.firstChild) {
              svgContainer.removeChild(svgContainer.firstChild);
            }
            
            // Append the parsed SVG element
            svgContainer.appendChild(svgElement);
          } catch (error) {
            console.error('SVG parsing failed:', error);
            // Fallback to text content for debugging
            svgContainer.textContent = t('error.svgRenderFailed', { message: error.message });
          }
        }
        if (logElement) logElement.textContent = normalizedCode;

        enableExportButtons();
        setStatus(true, 'status.directRenderSuccess');
        const directResult = {
          code: normalizedCode,
          rawCode: inputText,
          errors: [],
          log: [],
          dtype: 'mermaid',
          trace: [],
          fragments: [],
          links: [],
          notes: [],
          detection: null,
          plugin: null,
          engine: {
            source: 'direct',
            version: window?.mermaid?.version || null,
            attempts: [],
            error: null,
          },
          svg: renderResult.svg,
          debugMeta: { reason: 'direct' },
        };
        lastResult = { ...initialLastResult, ...directResult };
        updateDebugPanel(lastResult);
        updateAnalysisPanel(lastResult);
        if (reason === 'autofix') {
          const srcElement = $('src');
          if (srcElement) {
            srcElement.value = normalizedCode;
          }
          saveSettingsSnapshot();
        }
        return lastResult;
      }

      // 根據 engineMode 建立 worker 與 payload
      const files = await collectFiles(inputText);
      const locale = getLocale();
      let postPayload = {};
      const worker = createWorker(engineMode);

      const ruleConfig = getRuleConfig();
      const rulesOptions = {};
      if (ruleConfig?.manifest_path) rulesOptions.manifest_path = ruleConfig.manifest_path;
      if (ruleConfig?.version) rulesOptions.version = ruleConfig.version;
      if (ruleConfig?.rulepack_path) rulesOptions.rulepack_path = ruleConfig.rulepack_path;
      if (ruleConfig?.promptpack_path) rulesOptions.promptpack_path = ruleConfig.promptpack_path;

      if (engineMode === 'ai') {
        // AI worker (worker.mjs)
        postPayload = {
          files,
          uiOptions: {
            mode: 'ai',
            diagram: diagramType,
            provider: aiProvider,
            mermaidConfig: { securityLevel: $('secLevel')?.value || 'strict' },
            locale,
            reason,

          }
        };
      } else {
        // classic/rules worker (worker.js)
        postPayload = {
          files,
          mode: engineMode,
          options: {
            lang: 'python',
            diagram: diagramType,
            provider: aiProvider,
            seedMermaid: undefined,
            locale,

          },
          uiMode: reason,
        };
      }

      const result = await new Promise((resolve, reject) => {
        let isSettled = false;
        const timeout = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            try { 
              worker.terminate(); 
            } catch (error) {
              console.warn('Worker termination failed:', error);
            }
            reject(new Error('Worker timeout after 90 seconds'));
          }
        }, 90000);

        worker.onmessage = async (event) => {
          if (isSettled) return;
          
          isSettled = true;
          clearTimeout(timeout);
          
          try { 
            worker.terminate(); 
          } catch (error) {
            console.warn('Worker termination failed:', error);
          }

          const {
            code,
            errors = [],
            log = [],
            dtype = '',
            trace = [],
            fragments = [],
            links = [],
            notes = [],
            detection = null,
            plugin = null,
            rawCode = '',
            engine = {},
            ir = null,
          } = event.data || {};

          // Safety: normalize worker output header
          const safeCode = normalizeHeader(code);
          const renderResult = await renderMermaid(safeCode, { width, height });
          
          if (renderResult.error) {
            throw new Error(String(renderResult.error));
          }
          
          // Safe SVG insertion using DOMParser
          if (svgContainer) {
            try {
              const parser = new DOMParser();
              const svgDoc = parser.parseFromString(renderResult.svg, 'image/svg+xml');
              const svgElement = svgDoc.documentElement;
              
              // Clear existing content safely
              while (svgContainer.firstChild) {
                svgContainer.removeChild(svgContainer.firstChild);
              }
              
              // Append the parsed SVG element
              svgContainer.appendChild(svgElement);
            } catch (error) {
              console.error('SVG parsing failed:', error);
              // Fallback to text content for debugging
              svgContainer.textContent = t('error.svgRenderFailed', { message: error.message });
            }
          }
          if (logElement) {
            const logText = Array.isArray(log) 
              ? log.map(item => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n')
              : '';
            logElement.textContent = logText + '\n\n' + safeCode;
          }
          
          enableExportButtons();
          if (dtype) {
            setStatus(true, 'status.detectedDiagram', { dtype });
          } else {
            setStatus(true, 'status.okShort');
          }
          const engineInfo = {
            source: engine?.source ?? null,
            version: engine?.version ?? null,
            attempts: Array.isArray(engine?.attempts) ? engine.attempts : [],
            error: engine?.error ?? null,
          };

          const workerResult = {
            code: safeCode,
            rawCode: typeof rawCode === 'string' && rawCode ? rawCode : safeCode,
            errors,
            log,
            dtype: dtype || '',
            trace: Array.isArray(trace) ? trace : [],
            fragments: Array.isArray(fragments) ? fragments : [],
            links: Array.isArray(links) ? links : [],
            notes: Array.isArray(notes) ? notes : [],
            detection: detection || null,
            plugin: plugin || null,
            engine: engineInfo,
            ir: ir || null,
            svg: renderResult.svg,
            debugMeta: { reason: 'worker' },
          };

          resolve(workerResult);
        };

        worker.onerror = (error) => {
          if (isSettled) return;
          
          isSettled = true;
          clearTimeout(timeout);
          
          try { 
            worker.terminate(); 
          } catch (termError) {
            console.warn('Worker termination failed:', termError);
          }
          
          const errorMessage = error instanceof Error ? error : new Error(String(error?.message || error));
          reject(errorMessage);
        };
        // Post using the payload shaped for the selected worker type
        worker.postMessage(postPayload);
      });

      lastResult = { ...initialLastResult, ...result };
      updateDebugPanel(lastResult);
      updateAnalysisPanel(lastResult);
      if (reason === 'autofix') {
        const srcElement = $('src');
        if (srcElement) {
          srcElement.value = lastResult.code;
        }
        saveSettingsSnapshot();
      }
      return lastResult;

    } catch (error) {
      console.error('Processing failed:', error);
      const message = error?.message || String(error);
      showNotice(t('notice.errorWithMessage', { message }));
      lastResult = {
        ...initialLastResult,
        errors: [{ message }],
        debugMeta: { reason: 'error', error: message },
      };
      updateDebugPanel(lastResult, { reason: 'error', error: message });
      updateAnalysisPanel(lastResult);
      setStatus(false, message);
      return null;
    }
  }

  /**
   * Collect files from input or file selection
   * @param {string} textInput - Text input content
   * @returns {Promise<Object>} Files object
   */
  async function collectFiles(textInput) {
    const fileInput = $('fileInput');
    const filesMap = {};
    
    if (fileInput?.files && fileInput.files.length > 0) {
      const readFileAsText = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsText(file);
      });

      for (const file of fileInput.files) {
        const key = file.webkitRelativePath || file.name;
        try {
          filesMap[key] = await readFileAsText(file);
        } catch (error) {
          console.warn(t('warning.fileReadFailed', { file: file.name }), error);
        }
      }
      
      return filesMap;
    }

    return { "main.py": textInput };
  }

  /**
   * Self-test function for development
   */
  async function runSelfTest() {
    const svgContainer = $('svg');
    const logElement = $('log');
    
    // Clear previous results safely
    if (svgContainer) {
      while (svgContainer.firstChild) {
        svgContainer.removeChild(svgContainer.firstChild);
      }
    }
    if (logElement) logElement.textContent = '';
    
    setStatus(false, 'status.selfTestRunning');

  // Self-test uses the ESM worker variant
  const worker = new Worker(cacheBustedUrl('./worker.mjs'), { type: 'module' });
    const testFiles = { 
      'main.py': 'def a(x):\n  return x\n\ndef b(y):\n  return a(y)\n' 
    };
    const options = { 
      lang: 'python', 
      diagram: 'sequenceDiagram', 
      mode: 'python', 
      useWTS: true, 
      wasmBase: 'js/wasm' 
    };

    const result = await new Promise((resolve, reject) => {
      let isSettled = false;
      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try { 
            worker.terminate(); 
          } catch (error) {
            console.warn('Worker termination failed:', error);
          }
          reject(new Error('Self-test timeout'));
        }
      }, 30000);

      worker.onmessage = async (event) => {
        if (isSettled) return;
        
        isSettled = true;
        clearTimeout(timeout);
        
        try { 
          worker.terminate(); 
        } catch (error) {
          console.warn('Worker termination failed:', error);
        }
        
        resolve(event.data || {});
      };

      worker.onerror = (error) => {
        if (isSettled) return;
        
        isSettled = true;
        clearTimeout(timeout);
        
        try { 
          worker.terminate(); 
        } catch (termError) {
          console.warn('Worker termination failed:', termError);
        }
        
        const errorMessage = error instanceof Error ? error : new Error(String(error?.message || error));
        reject(errorMessage);
      };

      worker.postMessage({ files: testFiles, options });
    });

    try {
      const { code, log = [] } = result;
      const renderResult = await renderMermaid(code, {});
      
      if (renderResult.error) {
        throw new Error(renderResult.error);
      }
      
      // Safe SVG insertion using DOMParser
      if (svgContainer) {
        try {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(renderResult.svg, 'image/svg+xml');
          const svgElement = svgDoc.documentElement;
          
          // Clear existing content safely
          while (svgContainer.firstChild) {
            svgContainer.removeChild(svgContainer.firstChild);
          }
          
          // Append the parsed SVG element
          svgContainer.appendChild(svgElement);
        } catch (error) {
          console.error('SVG parsing failed:', error);
          // Fallback to text content for debugging
          svgContainer.textContent = t('error.svgRenderFailed', { message: error.message });
        }
      }
      
      enableExportButtons();
      const diagnostics = log.find(item => item && item.rule === 'worker.diag');
      const webTreeSitter = log.find(item => item && item.rule === 'worker.wts');
      
      if (logElement) {
        const diagValue = diagnostics ? diagnostics.msg : t('selfTest.notAvailable');
        const diagText = t('selfTest.diagnostic', { value: diagValue });
        const parserText = webTreeSitter
          ? t('selfTest.webTreeSitterUsed')
          : t('selfTest.fallbackParser');
        logElement.textContent = `${diagText}\n${parserText}`;
      }
      
      setStatus(true, webTreeSitter ? 'status.webTreeSitterOk' : 'status.fallbackOk');
    } catch (error) {
      showNotice(t('notice.selfTestFailed', { message: error?.message || error }));
      setStatus(false, error?.message || String(error));
    }
  }

  /**
   * Bind event handlers to UI elements
   */
  function bindEventHandlers() {
    // Auto-render functionality with debounce
    const autoRenderCheckbox = $('autoRender');
    const triggerRender = debounce(() => {
      try { processInput(); } catch {}
    }, 300);
    
    if (autoRenderCheckbox) {
      autoRenderCheckbox.addEventListener('change', () => {
        saveSettingsSnapshot();
        if (autoRenderCheckbox.checked) {
          triggerRender();
        }
      });
    }

    // Input change handlers for auto-render
    const inputElements = ['src', 'svgW', 'svgH', 'pngBG', 'diagramType', 'secLevel', 'engineSelect', 'aiProvider', 'layoutSelect'];
    
    for (const elementId of inputElements) {
      const element = $(elementId);
      if (element) {
        const autoRenderHandler = () => {
          saveSettingsSnapshot();
          const autoCheckbox = $('autoRender');
          if (autoCheckbox?.checked) {
            triggerRender();
          }
        };
        if (elementId === 'engineSelect') {
          element.addEventListener('change', () => {
            runAnalysis('render');
          });
        }
        element.addEventListener('input', autoRenderHandler);
        element.addEventListener('change', autoRenderHandler);
      }
    }

    // File input handler
    const fileInput = $('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const autoCheckbox = $('autoRender');
        if (autoCheckbox?.checked) {
          triggerRender();
        }
      });
    }

    // Main action buttons
    $('btnRender')?.addEventListener('click', () => { runAnalysis('render'); });
    $('btnFixRender')?.addEventListener('click', () => { runAnalysis('autofix'); });
    $('btnSelfTest')?.addEventListener('click', runSelfTest);
    // 健康檢測：檢查模型 JSON、worker、Ollama
    $('btnHealth')?.addEventListener('click', async () => {
      setStatus(false, 'status.healthCheckRunning');
      const lines = [];
      const translateValue = (value) =>
        value && value.startsWith('health.') ? t(value) : value;
      const push = (ok, label, extra = '') => {
        const labelText = translateValue(label);
        const extraText = translateValue(extra);
        lines.push(`${ok ? '✅' : '❌'} ${labelText}${extraText ? ' - ' + extraText : ''}`);
      };
      try {
        // 1. 模型 JSON
        const modelFiles = ['rules_v1.json','knowledge_index_v1.json','qa_templates_v1.json'];
        for (const f of modelFiles) {
          try {
            const r = await fetch(`js/models/${f}`, { cache: 'no-store' });
            push(r.ok, `models/${f}`, r.ok ? '' : `HTTP ${r.status}`);
          } catch (e) {
            push(false, `models/${f}`, String(e));
          }
        }
        // 2. worker module (HEAD)
        try {
          const r = await fetch('./js/worker.mjs', { method: 'GET', cache: 'no-store' });
          push(r.ok, 'worker.mjs', r.ok ? '' : `HTTP ${r.status}`);
        } catch (e) { push(false, 'worker.mjs', String(e)); }
        // 3. worker classic
        try {
          const r = await fetch('./js/worker.js', { method: 'GET', cache: 'no-store' });
          push(r.ok, 'worker.js', r.ok ? '' : `HTTP ${r.status}`);
        } catch (e) { push(false, 'worker.js', String(e)); }
        // 4. Ollama (只在 provider=ollama 時提示)
        const providerSel = $('aiProvider')?.value || 'none';
        if (providerSel === 'ollama') {
          try {
            const ctrl = new AbortController();
            const t = setTimeout(()=>ctrl.abort(), 2500);
            const r = await fetch('http://localhost:11434/api/version', { signal: ctrl.signal });
            clearTimeout(t);
            push(r.ok, 'Ollama /api/version', r.ok ? '' : `HTTP ${r.status}`);
          } catch (e) {
            push(false, 'Ollama /api/version', String(e.name === 'AbortError' ? 'timeout' : e));
          }
        } else {
          push(true, 'health.ollamaSkipped', 'health.ollamaOptional');
        }
        // 5. 同源判斷 (避免 file://)
        push(location.protocol.startsWith('http'), 'health.protocolCheck', location.protocol);
        // 顯示結果
        const logElement = $('log');
        if (logElement) logElement.textContent = lines.join('\n');
        setStatus(true, 'status.healthCheckSuccess');
      } catch (e) {
        const logElement = $('log');
        if (logElement) {
          const message = e?.message || e;
          logElement.textContent = lines.concat([t('health.errorLine', { message })]).join('\n');
        }
        setStatus(false, 'status.healthCheckFailed');
      }
    });

    $('btnDebug')?.addEventListener('click', () => {
      const panel = $('debugPanel');
      if (!panel) return;
      const computed = typeof window !== 'undefined'
        ? window.getComputedStyle(panel)
        : { display: panel.style.display || 'none' };
      const isHidden = panel.style.display === 'none'
        || (panel.style.display === '' && computed.display === 'none');
      if (isHidden) {
        panel.style.display = 'block';
        updateDebugPanel(lastResult);
      } else {
        panel.style.display = 'none';
      }
    });

    $('btnRules')?.addEventListener('click', () => {
      const panel = $('rulesPanel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Export buttons
    $('btnExportMMD')?.addEventListener('click', () => {
      downloadFile('diagram.mmd', lastResult?.code || '');
    });

    $('btnExportSVG')?.addEventListener('click', () => {
      const svgElement = document.querySelector('#graphDiv svg') || document.querySelector('#svg svg');
      if (!svgElement) {
        alert(t('alert.noSvg'));
        return;
      }
      
      const svgString = new XMLSerializer().serializeToString(svgElement);
      downloadFile('diagram.svg', svgString, 'image/svg+xml');
    });

    $('btnExportErrors')?.addEventListener('click', () => {
      const errors = Array.isArray(lastResult?.errors) ? lastResult.errors : [];
      const exportAsText = confirm(t('alert.exportErrorsAsText'));
      if (exportAsText) {
        const context = lastResult?.debugMeta || {};
        const text = buildDebugText(lastResult, context);
        downloadFile('errors.txt', text, 'text/plain');
      } else {
        const errorData = JSON.stringify(errors, null, 2);
        downloadFile('errors.json', errorData, 'application/json');
      }
    });

    $('btnExportFixlog')?.addEventListener('click', () => {
      const logEntries = Array.isArray(lastResult?.log) ? lastResult.log : [];
      const exportAsText = confirm(t('alert.exportFixlogAsText'));
      if (exportAsText) {
        if (logEntries.length) {
          const lines = logEntries.map((entry, index) => {
            const formatted = formatLogEntry(entry) || '';
            return formatted ? `${index + 1}. ${formatted}` : `${index + 1}.`;
          });
          downloadFile('fixlog.txt', lines.join('\n'), 'text/plain');
        } else {
          downloadFile('fixlog.txt', t('debug.log.empty'), 'text/plain');
        }
      } else {
        const logData = JSON.stringify(logEntries, null, 2);
        downloadFile('fixlog.json', logData, 'application/json');
      }
    });

    // 輸出圖片按鈕 - 提供格式選擇
    $('btnExportImage')?.addEventListener('click', async () => {
      const svgElement = document.querySelector('#graphDiv svg') || document.querySelector('#svg svg');
      if (!svgElement) {
        alert(t('alert.noImage'));
        return;
      }

      // 讓用戶選擇輸出格式
      const format = confirm(t('alert.chooseFormat')) ? 'PNG' : 'SVG';
      
      if (format === 'SVG') {
        // 直接輸出 SVG
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        downloadFile('diagram.svg', svgBlob, 'image/svg+xml');
      } else {
        // 輸出 PNG
        const pngBackground = $('pngBG')?.value || 'transparent';
        let pngWidth = parseInt($('svgW')?.value || '0', 10) || 0;
        let pngHeight = parseInt($('svgH')?.value || '0', 10) || 0;
  
        if (pngWidth === 0 || pngHeight === 0) {
          const boundingRect = svgElement.getBoundingClientRect();
          pngWidth = pngWidth || Math.ceil(boundingRect.width) || 1024;
          pngHeight = pngHeight || Math.ceil(boundingRect.height) || 768;
        }

        const svgString = new XMLSerializer().serializeToString(svgElement);
        
        try {
          const pngBlob = await svgToPNG(svgString, { 
            width: pngWidth, 
            height: pngHeight, 
            background: pngBackground 
          });
          downloadFile('diagram.png', pngBlob, 'image/png');
        } catch (error) {
          const message = error?.message || error;
          console.error(t('alert.pngExportFailed', { message }), error);
          alert(t('alert.pngExportFailed', { message }));
        }
      }
    });

    $('btnExportPNG')?.addEventListener('click', async () => {
      const svgElement = document.querySelector('#graphDiv svg') || document.querySelector('#svg svg');
      if (!svgElement) {
        alert(t('alert.noSvg'));
        return;
      }

      const pngBackground = $('pngBG')?.value || 'transparent';
      let pngWidth = parseInt($('svgW')?.value || '0', 10) || 0;
      let pngHeight = parseInt($('svgH')?.value || '0', 10) || 0;

      if (pngWidth === 0 || pngHeight === 0) {
        const boundingRect = svgElement.getBoundingClientRect();
        pngWidth = pngWidth || Math.ceil(boundingRect.width) || 1024;
        pngHeight = pngHeight || Math.ceil(boundingRect.height) || 768;
      }

      const svgString = new XMLSerializer().serializeToString(svgElement);
      // 檢查 SVG 是否含外部資源（如 <image>、外部 CSS）
      const hasExternalResource = /<image\s[^>]*xlink:href=["'](http|data:)[^"']+["']/i.test(svgString) || /<link\s[^>]*href=["']http/i.test(svgString);
      if (hasExternalResource) {
        alert(t('alert.pngExportNoExternal'));
        return;
      }
      try {
        const pngBlob = await svgToPNG(svgString, { 
          width: pngWidth, 
          height: pngHeight, 
          background: pngBackground 
        });
        downloadFile('diagram.png', pngBlob, 'image/png');
      } catch (error) {
        const message = error?.message || error;
        console.error(t('alert.pngConvertFailed', { message }), error);
        alert(`${t('alert.pngConvertFailed', { message })}\n${t('alert.pngConvertReason')}`);
      }
    });

    $('analysisFragments')?.addEventListener('click', async (event) => {
      const element = event.target instanceof HTMLElement
        ? event.target.closest('button[data-fragment-index]')
        : null;
      if (!(element instanceof HTMLButtonElement)) return;

      const index = Number.parseInt(element.dataset.fragmentIndex || '', 10);
      if (!Number.isInteger(index)) return;

      const fragments = Array.isArray(lastResult?.fragments) ? lastResult.fragments : [];
      const fragment = fragments[index];
      if (!fragment || typeof fragment.code !== 'string' || !fragment.code.trim()) {
        showTransientNotice(t('panel.analysis.copyEmpty'));
        return;
      }

      const ok = await copyToClipboard(fragment.code);
      if (ok) {
        const title = fragment.title || fragment.id || t('panel.analysis.fragment.untitled');
        showTransientNotice(t('panel.analysis.fragment.copySuccess', { title }), 2400);
      } else {
        showTransientNotice(t('panel.analysis.copyFailed'), 4000);
      }
    });

    $('btnCopyCombined')?.addEventListener('click', async () => {
      const code = typeof lastResult?.code === 'string' ? lastResult.code : '';
      if (!code.trim()) {
        showTransientNotice(t('panel.analysis.copyEmpty'));
        return;
      }
      const ok = await copyToClipboard(code);
      if (ok) {
        showTransientNotice(t('panel.analysis.copyCombinedSuccess'), 2400);
      } else {
        showTransientNotice(t('panel.analysis.copyFailed'), 4000);
      }
    });
  }

  // Initialize the UI
  bindEventHandlers();
  window.addEventListener('beforeunload', saveSettingsSnapshot);
  // Restore basic settings
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if ($('src') && typeof s.src === 'string') $('src').value = s.src;
    if ($('svgW') && s.svgW) $('svgW').value = s.svgW;
    if ($('svgH') && s.svgH) $('svgH').value = s.svgH;
    if ($('pngBG') && s.pngBG) $('pngBG').value = s.pngBG;
    if ($('diagramType') && s.diagramType) $('diagramType').value = s.diagramType;
    if ($('secLevel') && s.secLevel) $('secLevel').value = s.secLevel;
    if ($('engineSelect') && s.engineSelect) $('engineSelect').value = s.engineSelect;
    if ($('aiProvider') && s.aiProvider) $('aiProvider').value = s.aiProvider;
    if ($('autoRender')) $('autoRender').checked = !!s.autoRender;
    if (s.sourceMode) {
      const radio = document.querySelector(`input[name="sourceMode"][value="${s.sourceMode}"]`);
      if (radio) radio.checked = true;
    }
  } catch {}

  // If first-time/空白輸入，給一段示例並做一次渲染，避免空白畫面
  try {
    const srcEl = $('src');
    if (srcEl && !String(srcEl.value || '').trim()) {
      srcEl.value = t('sample.flowchart');
      // 做一次直接渲染（不經 worker）
      setTimeout(() => { try { document.getElementById('btnRender')?.click(); } catch {} }, 0);
    }
  } catch {}

  resetAnalysisPanel();
  updateAnalysisPanel(lastResult);

  return { processInput, runAnalysis, saveSettingsSnapshot };
}

export { initializeUI };
/* eslint-disable no-unused-vars */
