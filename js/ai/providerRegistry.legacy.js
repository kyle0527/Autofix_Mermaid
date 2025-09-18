/* Legacy provider registry for classic workers (importScripts)
 * This file intentionally avoids ESM syntax and attaches the registry to the worker global (self).
 */
(function(scope){
  'use strict';
  const REGISTRY_KEY = '__AI_PROVIDER_REGISTRY__';
  if (scope[REGISTRY_KEY]) return; // idempotent

  const providers = new Map();

  function validate(name, impl){
    if (!name || typeof name !== 'string') throw new Error('AI provider must have a string name');
    if (!impl || typeof impl.analyze !== 'function') throw new Error('AI provider must implement analyze(files, options)');
  }

  const registry = {
    version: '1.0.0-legacy',
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

  scope[REGISTRY_KEY] = registry;
  scope.AIRegistry = registry;
  scope.registerAIProvider = function(name, impl){ return registry.register(name, impl); };
  scope.listAIProviders = function(){ return registry.list(); };
  scope.AI_CORE_VERSION = registry.version;
})(self);
