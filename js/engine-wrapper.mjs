// ESM wrapper adapter for legacy global DiagramMenderCore
// Provides small safe exports so ESM modules can call the existing global API
// without requiring a full source conversion of js/engine.js.

function ensureCore() {
  if (globalThis.DiagramMenderCore && typeof globalThis.DiagramMenderCore.runPipeline === 'function') {
    return globalThis.DiagramMenderCore;
  }

  // Try to dynamically load the legacy engine script in environments where fetch+eval are allowed
  // This allows module workers to still use the legacy IIFE engine without converting it to ESM.
  if (typeof fetch === 'function' && typeof Function === 'function') {
    try {
      // attempt synchronous-seeming fetch + eval
      const url = new URL('js/engine.js', location && location.href || './').toString();
      // fetch text and evaluate in global scope
      // Note: this must be allowed by CSP and same-origin rules.
      // We return a Promise-like resolution by performing a blocking fetch via then; but this function
      // is used by callers that await runPipeline, so we keep ensureCore sync but allow caller to retry.
      // Instead, throw an informative error and let caller decide. We'll attempt a best-effort eval now.
      fetch(url).then(r => r.text()).then(src => {
        try {
          // Evaluate in global scope
          (0, eval)(src);
        } catch (e) {
          console.warn('Failed to eval legacy engine.js:', e);
        }
      }).catch(err => {
        console.warn('Failed to fetch legacy engine.js:', err);
      });
    } catch (e) {
      console.warn('engine-wrapper dynamic load attempt failed:', e);
    }
  }

  if (globalThis.DiagramMenderCore && typeof globalThis.DiagramMenderCore.runPipeline === 'function') {
    return globalThis.DiagramMenderCore;
  }

  throw new Error('DiagramMenderCore is not available on globalThis. Ensure js/engine.js is loaded (e.g. via <script>, importScripts in workers, or allow fetch+eval).');
}

export async function runPipeline(files, opts) {
  const core = ensureCore();
  // runPipeline may be sync or async in the original implementation
  return await core.runPipeline(files, opts);
}

export async function runPipelineIR(ir, opts) {
  const core = ensureCore();
  return await core.runPipelineIR(ir, opts);
}

export default { runPipeline, runPipelineIR };
