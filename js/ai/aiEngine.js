/* AI Engine (pluggable providers)
 * Loads a provider registry and registers built-in providers (none, ollama, webllm).
 * Exposes:
 *   - self.aiAnalyze(files, options)
 *   - self.registerAIProvider(name, impl)
 *   - self.listAIProviders()
 *   - self.AI_CORE_VERSION
 */

// Load registry and built-ins (classic worker compatible)
// Use the legacy registry implementation for importScripts environments
try { importScripts('js/ai/providerRegistry.legacy.js'); } catch (e) {}
try { importScripts('js/ai/providers/none.js'); } catch (e) {}
try { importScripts('js/ai/providers/ollama.js'); } catch (e) {}
try { importScripts('js/ai/providers/webllm.js'); } catch (e) {}

self.aiAnalyze = async function aiAnalyze(files, options = {}) {
  const reg = self.AIRegistry;
  const providerName = (options.provider || 'none');
  const dtype = options.diagram || 'flowchart';
  const logBase = [{ rule: 'ai.core', msg: `core=${self.AI_CORE_VERSION||'unknown'}` }];

  try {
    const p = reg && reg.get(providerName);
    if (p) {
      const res = await p.analyze(files, options);
      res.log = (res.log || []).concat(logBase);
      return res;
    }
  } catch (e) {
    // fall through to none
  }

  // Fallback to built-in 'none' provider
  try {
    const none = reg && reg.get('none');
    if (none) {
      const res = await none.analyze(files, options);
      res.log = (res.log || []).concat(logBase, [{ rule: 'ai.fallback', msg: `provider=${providerName}` }]);
      return res;
    }
  } catch (e) {}

  // Last resort
  return { code: 'graph TD\nA[AI]-->B[Fallback]', errors: [], log: logBase.concat([{ rule: 'ai.fallback', msg: 'no providers available' }]), dtype };
};
