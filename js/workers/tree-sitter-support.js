(function (global) {
  'use strict';

  const STATE = {
    modulePromise: null,
  };

  function resolveRuntimeModule(scope) {
    return scope?.TreeSitter || scope?.webTreeSitter || scope?.WebTreeSitter || null;
  }

  function toAbsoluteUrl(scope, relative) {
    try {
      const base = scope?.location?.href;
      if (typeof base === 'string' && base) {
        return new URL(relative, base).toString();
      }
    } catch (error) {
      console.warn('web-tree-sitter absoluteUrl failed:', error);
    }
    return relative;
  }

  function hasPythonFiles(files) {
    if (!files || typeof files !== 'object') return false;
    for (const key of Object.keys(files)) {
      if (typeof key === 'string' && /\.(py|pyw|pyi)$/i.test(key)) {
        return true;
      }
    }
    return false;
  }

  function importRuntime(scope) {
    if (typeof scope.importScripts === 'function') {
      try {
        scope.importScripts('vendor/web-tree-sitter.js');
        return resolveRuntimeModule(scope);
      } catch (error) {
        console.warn('web-tree-sitter importScripts failed:', error);
      }
    }
    return null;
  }

  async function evaluateRuntime(scope) {
    if (typeof fetch !== 'function') return null;
    const url = toAbsoluteUrl(scope, 'vendor/web-tree-sitter.js');
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const source = await response.text();
      // eslint-disable-next-line no-eval
      (0, eval)(`${source}\n//# sourceURL=${url}`);
      return resolveRuntimeModule(scope);
    } catch (error) {
      console.warn('web-tree-sitter fetch/eval failed:', error);
      return null;
    }
  }

  function ensureModule(scope) {
    if (!STATE.modulePromise) {
      STATE.modulePromise = (async () => {
        const existing = resolveRuntimeModule(scope);
        if (existing) return existing;
        const viaImport = importRuntime(scope);
        if (viaImport) return viaImport;
        return await evaluateRuntime(scope);
      })().catch((error) => {
        console.warn('web-tree-sitter load failed:', error);
        return null;
      });
    }
    return STATE.modulePromise;
  }

  async function prepareConfig(scope, files) {
    if (!hasPythonFiles(files)) return null;
    const module = await ensureModule(scope);
    if (!module) return null;
    const runtimeUrl = toAbsoluteUrl(scope, 'wasm/tree-sitter.wasm');
    const pythonUrl = toAbsoluteUrl(scope, 'wasm/tree-sitter-python.wasm');
    const locateFile = (scriptName, scriptDirectory) => {
      if (scriptName === 'tree-sitter.wasm') {
        return runtimeUrl;
      }
      if (scriptDirectory) {
        return `${scriptDirectory}${scriptName}`;
      }
      return scriptName;
    };
    return {
      module,
      runtimeUrl,
      locateFile,
      languages: {
        python: pythonUrl,
      },
    };
  }

  global.WebTreeSitterSupport = global.WebTreeSitterSupport || {};
  global.WebTreeSitterSupport.prepareConfig = prepareConfig;
})(typeof self !== 'undefined' ? self : globalThis);
