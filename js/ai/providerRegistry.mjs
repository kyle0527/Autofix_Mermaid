// ESM-compatible provider registry for module workers
// Creates a stable registry and also exposes compatibility aliases on self/globalThis
const REGISTRY_KEY = '__AI_PROVIDER_REGISTRY__';
if (!globalThis[REGISTRY_KEY]) {
  const providers = new Map();

  function validate(name, impl){
    if (!name || typeof name !== 'string') throw new Error('AI provider must have a string name');
    if (!impl || typeof impl.analyze !== 'function') throw new Error('AI provider must implement analyze(files, options)');
  }

  const registry = {
    version: '1.0.0-esm',
    register(name, impl){
      validate(name, impl);
      providers.set(name.toLowerCase(), { name, version: impl.version || '0.0.0', analyze: impl.analyze });
      return true;
    },
    get(name){
      if (!name) return null;
      return providers.get(String(name).toLowerCase()) || null;
    },
    list(){
      return Array.from(providers.values()).map(p => ({ name: p.name, version: p.version }));
    }
  };

  // Expose for compatibility
  globalThis[REGISTRY_KEY] = registry;
  globalThis.AIRegistry = registry;
  globalThis.registerAIProvider = (name, impl) => registry.register(name, impl);
  globalThis.listAIProviders = () => registry.list();
  globalThis.AI_CORE_VERSION = registry.version;
}

export const AIRegistry = globalThis[REGISTRY_KEY];
export const registerAIProvider = globalThis.registerAIProvider;
export const listAIProviders = globalThis.listAIProviders;
