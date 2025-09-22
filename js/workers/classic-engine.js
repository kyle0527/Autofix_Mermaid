/* eslint-env worker */
(function (global) {
  'use strict';

  const ENGINE_CANDIDATES = ['engine.browser.js', 'engine.js'];

  let engineLoaded = false;
  let loadError = null;
  let engineMeta = { source: null, attempts: [] };

  function toErrorInfo(error) {
    if (!error) {
      return { message: 'Unknown error' };
    }
    if (error instanceof Error) {
      return { message: error.message || error.name || 'Error', stack: error.stack || '' };
    }
    return { message: String(error) };
  }

  function loadEngine(scriptPaths = ENGINE_CANDIDATES) {
    if (engineLoaded) {
      return { available: true, error: null, source: engineMeta.source, attempts: engineMeta.attempts.slice() };
    }

    engineMeta = { source: null, attempts: [] };
    loadError = null;

    const candidates = Array.isArray(scriptPaths) ? scriptPaths : [scriptPaths];

    for (const candidate of candidates) {
      try {
        importScripts(candidate);
      } catch (error) {
        engineMeta.attempts.push({ source: candidate, ok: false, error: toErrorInfo(error) });
        continue;
      }

      const engine = global.DiagramMenderCore;
      if (engine && typeof engine.runPipeline === 'function') {
        engineLoaded = true;
        engineMeta.source = candidate;
        engineMeta.attempts.push({ source: candidate, ok: true });
        loadError = null;
        return { available: true, error: null, source: candidate, attempts: engineMeta.attempts.slice() };
      }

      engineMeta.attempts.push({
        source: candidate,
        ok: false,
        error: { message: 'DiagramMenderCore.runPipeline not available' },
      });
    }

    engineLoaded = false;
    const lastAttempt = engineMeta.attempts[engineMeta.attempts.length - 1];
    const reason = lastAttempt?.error?.message || 'Unable to load any engine candidate';
    loadError = new Error(reason);
    return { available: false, error: loadError, attempts: engineMeta.attempts.slice() };
  }

  function isAvailable() {
    return engineLoaded;
  }

  async function runPipeline(files, options = {}) {
    const engine = global.DiagramMenderCore;
    if (!engine || typeof engine.runPipeline !== 'function') {
      throw loadError ?? new Error('規則引擎尚未載入');
    }
    return await engine.runPipeline(files, options);
  }

  function getEngine() {
    return engineLoaded ? global.DiagramMenderCore : null;
  }

  function getLoadError() {
    return loadError;
  }

  function getLoadMeta() {
    return {
      source: engineMeta.source,
      attempts: engineMeta.attempts.slice(),
    };
  }

  global.ClassicEngine = Object.freeze({
    loadEngine,
    isAvailable,
    runPipeline,
    getEngine,
    getLoadError,
    getLoadMeta,
  });
})(self);
