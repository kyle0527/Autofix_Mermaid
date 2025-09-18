// Import ESM provider registry and built-in providers for module workers
import './providerRegistry.mjs';
try {
  // register default providers (best-effort)
  const none = await import('./providers-esm/none.mjs'); if (none && typeof none.register === 'function') none.register(self);
  const ollama = await import('./providers-esm/ollama.mjs'); if (ollama && typeof ollama.register === 'function') ollama.register(self);
  const webllm = await import('./providers-esm/webllm.mjs'); if (webllm && typeof webllm.register === 'function') webllm.register(self);
} catch (e) {
  // swallow errors to avoid breaking worker startup
  console.warn('providers-loader: some providers failed to load', e);
}

export default true;
