/* eslint-env worker */

importScripts(
  'workers/tree-sitter-support.js',
  'workers/classic-utils.js',
  'workers/classic-renderer.js',
  'workers/classic-engine.js',
  'workers/classic-test-runner.js'
);

const WORKER_VERSION = 'classic-2024-10-08';

const ClassicRenderer = self.ClassicRenderer;
const ClassicEngine = self.ClassicEngine;
const ClassicTestRunner = self.ClassicTestRunner;
const workerUtils = self.ClassicWorkerUtils;

function getEngineMeta() {
  if (typeof ClassicEngine.getLoadMeta === 'function') {
    const meta = ClassicEngine.getLoadMeta() || {};
    return {
      source: meta.source || null,
      attempts: Array.isArray(meta.attempts) ? meta.attempts : [],
    };
  }
  return { source: null, attempts: [] };
}

function formatEngineAttempts(attempts = []) {
  if (!Array.isArray(attempts) || !attempts.length) return '';
  return attempts.map((item) => {
    const status = item && item.ok ? 'ok' : 'fail';
    const src = item?.source || 'unknown';
    const detail = item?.error?.message ? ` (${item.error.message})` : '';
    return `${status}@${src}${detail}`;
  }).join('; ');
}

if (!ClassicRenderer || !ClassicEngine || !ClassicTestRunner || !workerUtils) {
  throw new Error('Classic worker modules failed to load via importScripts');
}

const { guessDiagram, buildFallbackDiagram, composeWorkerLog, toErrorMessage, resolveLocale, localize } = workerUtils;

const engineLoadResult = ClassicEngine.loadEngine(['engine.browser.js', 'engine.js']) || {};
const engineLoadError = engineLoadResult.error || null;

function buildAnalysisLog(resultLog, meta = {}, locale) {
  return composeWorkerLog(resultLog, {
    ...meta,
    engineLoaded: ClassicEngine.isAvailable(),
  }, locale);
}

function directRenderFallback(files = {}, options = {}, dtype, locale) {
  const code = typeof files.mermaid === 'string' ? files.mermaid : '';
  const message = engineLoadError
    ? localize('engine.loadFailed', locale, { error: toErrorMessage(engineLoadError) })
    : localize('engine.unavailable', locale);
  const note = localize('log.noteEngineUnavailable', locale);

  const engineMeta = getEngineMeta();
  return {
    code,
    errors: [
      {
        message,
        stack: engineLoadError instanceof Error ? engineLoadError.stack || '' : '',
      },
    ],
    log: buildAnalysisLog([], {
      mode: options?.mode || 'rules',
      version: WORKER_VERSION,
      note,
      error: message,
    }, locale),
    dtype,
    trace: [],
    fragments: [],
    links: [],
    notes: [],
    rawCode: code,
    detection: null,
    plugin: null,
    engine: {
      source: engineMeta.source,
      attempts: engineMeta.attempts,
      error: message,
    },
  };
}

async function handleRunIssueCases(payload = {}) {
  const { testDocs = [], opts = {} } = payload;
  const { results, suggestions } = await ClassicTestRunner.runIssueCases(testDocs, opts, {
    renderMermaid: ClassicRenderer.renderMermaid,
    normalizeSvg: ClassicRenderer.normalizeSvg,
  });

  for (const suggestion of suggestions) {
    self.postMessage({ type: 'suggestRule', ...suggestion });
  }

  self.postMessage({ type: 'issueCasesDone', results });
}

async function handleAnalysisMessage(data = {}) {
  const { files = {}, options = {}, mode } = data;
  const dtype = guessDiagram(files, options);
  const startTs = Date.now();
  const locale = resolveLocale(options?.locale || options?.language || data?.locale);

  const baseParserOptions = { ...(options?.parserOptions || {}), runtime: 'browser' };
  let pipelineOptions = { ...options, parserOptions: baseParserOptions };
  try {
    if (typeof self.WebTreeSitterSupport?.prepareConfig === 'function') {
      const webConfig = await self.WebTreeSitterSupport.prepareConfig(self, files);
      if (webConfig) {
        const preferTreeSitter = pipelineOptions.parserOptions?.preferTreeSitter !== false;
        pipelineOptions = {
          ...pipelineOptions,
          parserOptions: {
            ...pipelineOptions.parserOptions,
            webTreeSitter: webConfig,
            preferTreeSitter,
          },
        };
      }
    }
  } catch (error) {
    console.warn('web-tree-sitter configuration failed:', error);
  }

  if (!ClassicEngine.isAvailable()) {
    const fallbackResponse = directRenderFallback(files, options, dtype, locale);
    self.postMessage(fallbackResponse);
    return;
  }

  try {
    const result = await ClassicEngine.runPipeline(files, pipelineOptions);
    const engineMeta = getEngineMeta();
    const engineInfo = {
      source: result?.engine?.source || engineMeta.source || null,
      version: result?.engine?.version || null,
      attempts: Array.isArray(result?.engine?.attempts) ? result.engine.attempts : engineMeta.attempts,
    };
    const baseLog = Array.isArray(result?.log) ? [...result.log] : [];
    if (engineInfo.source) {
      baseLog.push({ rule: 'worker.engineSource', msg: `engine: ${engineInfo.source}` });
    }
    if (engineInfo.version) {
      baseLog.push({ rule: 'worker.engineVersion', msg: `engine version: ${engineInfo.version}` });
    }
    const attemptSummary = formatEngineAttempts(engineInfo.attempts);
    if (attemptSummary) {
      baseLog.push({ rule: 'worker.engineAttempts', msg: attemptSummary });
    }
    const log = buildAnalysisLog(baseLog, {
      mode: mode || 'rules',
      version: WORKER_VERSION,
      duration: Date.now() - startTs,
    }, locale);

    self.postMessage({
      code: result?.code ?? '',
      errors: Array.isArray(result?.errors) ? result.errors : [],
      log,
      dtype: result?.dtype || dtype,
      trace: Array.isArray(result?.trace) ? result.trace : [],
      fragments: Array.isArray(result?.fragments) ? result.fragments : [],
      links: Array.isArray(result?.links) ? result.links : [],
      notes: Array.isArray(result?.notes) ? result.notes : [],
      detection: result?.detection ?? null,
      plugin: result?.plugin ?? null,
      rawCode: typeof result?.rawCode === 'string' ? result.rawCode : '',
      engine: {
        source: engineInfo.source,
        version: engineInfo.version,
        attempts: engineInfo.attempts,
      },
      ir: result?.ir || null,
    });
  } catch (error) {
    const errorDetails = toErrorMessage(error);
    const message = localize('pipeline.error', locale, { error: errorDetails });
    const fallbackDiagram = buildFallbackDiagram(message, dtype, locale);
    const log = buildAnalysisLog([], {
      mode: mode || 'rules',
      version: WORKER_VERSION,
      error: message,
    }, locale);

    const engineMeta = getEngineMeta();
    self.postMessage({
      code: fallbackDiagram,
      errors: [
        {
          message,
          stack: error instanceof Error ? error.stack || '' : '',
        },
      ],
      log,
      dtype,
      trace: [],
      fragments: [],
      links: [],
      notes: [],
      rawCode: '',
      detection: null,
      plugin: null,
      engine: {
        source: engineMeta.source,
        attempts: engineMeta.attempts,
        error: message,
      },
      ir: null,
    });
  }
}

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};
  if (type === 'runIssueCases') {
    await handleRunIssueCases(payload || {});
    return;
  }

  await handleAnalysisMessage(event.data || {});
};
