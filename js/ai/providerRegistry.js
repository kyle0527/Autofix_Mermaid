// js/ai/providerRegistry.js
// Minimal provider registry to allow plug-and-play AI providers.
// Works in classic Worker via importScripts. Exposes a stable API on `self`.
// Provider shape: {
//   name: string,
//   version: string,
//   analyze(files: Record<string,string>, options: object): Promise<{ code, errors, log, dtype }>
// }

// ESM provider registry - intended for module workers and browser ESM
const providers = new Map();

function validate(name, impl){
  if (!name || typeof name !== 'string') throw new Error('AI provider must have a string name');
  if (!impl || typeof impl.analyze !== 'function') throw new Error('AI provider must implement analyze(files, options)');
}

export const registry = {
  version: '1.0.0',
  register(name, impl){
    validate(name, impl);
    providers.set(String(name).toLowerCase(), { name, version: impl.version || '0.0.0', analyze: impl.analyze });
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

// Convenience helpers for legacy code expecting globals
export function registerAIProvider(name, impl){ return registry.register(name, impl); }
export function listAIProviders(){ return registry.list(); }
export const AI_CORE_VERSION = registry.version;

