// Compatibility shim: when run in ESM environment (module worker), dynamically import ESM providers
// When run as a classic script (importScripts), this file can be loaded as-is and will fallback to existing provider scripts.
// Usage (module worker): import './ai/compat.mjs'; await compat.registerAll(self);

export async function registerAll(scope = self) {
  const base = new URL('.', import.meta.url).pathname.replace(/\/js\/ai\/$/, '/js/ai/');
  // Try dynamic import of ESM providers
  try {
    // Note: browsers resolve import specifier relative to module URL
    const modNone = await import('./providers-esm/none.mjs'); modNone.register(scope);
    const modOllama = await import('./providers-esm/ollama.mjs'); modOllama.register(scope);
    const modWebllm = await import('./providers-esm/webllm.mjs'); modWebllm.register(scope);
    return true;
  } catch (e) {
    // If dynamic import fails (older environment), do nothing here - classic worker should import existing providers via importScripts
    return false;
  }
}

// For classic importScripts consumers, provide a small UMD wrapper to load legacy provider files
// This file can be loaded by importScripts as 'js/ai/compat.mjs' but importScripts may not understand module syntax.
// To accommodate both, also ship a plain JS companion `compat.js` for importScripts.
