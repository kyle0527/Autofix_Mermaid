/* eslint-env worker */

importScripts(
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

if (!ClassicRenderer || !ClassicEngine || !ClassicTestRunner || !workerUtils) {
  throw new Error('Classic worker modules failed to load via importScripts');
}

const { guessDiagram, buildFallbackDiagram, composeWorkerLog, toErrorMessage, resolveLocale, localize } = workerUtils;

const { error: engineLoadError } = ClassicEngine.loadEngine('engine.js') || {};

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

  if (!ClassicEngine.isAvailable()) {
    const fallbackResponse = directRenderFallback(files, options, dtype, locale);
    self.postMessage(fallbackResponse);
    return;
  }

  try {
    const result = await ClassicEngine.runPipeline(files, options);
    const log = buildAnalysisLog(result?.log, {
      mode: mode || 'rules',
      version: WORKER_VERSION,
      duration: Date.now() - startTs,
    }, locale);

    self.postMessage({
      code: result?.code ?? '',
      errors: result?.errors ?? [],
      log,
      dtype: result?.dtype || dtype,
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
