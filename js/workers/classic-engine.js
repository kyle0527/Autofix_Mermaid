/* eslint-env worker */
(function (global) {
  'use strict';

  let engineLoaded = false;
  let loadError = null;

  function loadEngine(scriptPath = 'engine.js') {
    if (engineLoaded || loadError) {
      return { available: engineLoaded, error: loadError };
    }

    try {
      importScripts(scriptPath);
    } catch (error) {
      loadError = error instanceof Error ? error : new Error(String(error));
      return { available: false, error: loadError };
    }

    const engine = global.DiagramMenderCore;
    if (engine && typeof engine.runPipeline === 'function') {
      engineLoaded = true;
      return { available: true, error: null };
    }

    loadError = new Error('DiagramMenderCore.runPipeline 未提供或無法存取');
    return { available: false, error: loadError };
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

  global.ClassicEngine = Object.freeze({
    loadEngine,
    isAvailable,
    runPipeline,
    getEngine,
    getLoadError,
  });
})(self);
