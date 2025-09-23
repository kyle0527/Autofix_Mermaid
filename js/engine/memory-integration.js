/**
 * Memory Management Integration
 * 
 * Integrates memory management with existing systems
 * Provides enhanced resource tracking and cleanup coordination
 */

import { memoryManager } from './memory-management.js';

/**
 * Enhanced memory integration for existing systems
 */
class MemoryIntegration {
  constructor() {
    this.integrations = new Map();
    this.monitoredComponents = new Set();
    this.cleanupHandlers = new Map();
    
    this.setupDefaultIntegrations();
    console.log('Memory integration initialized');
  }
  
  /**
   * Setup default integrations with existing systems
   */
  setupDefaultIntegrations() {
    // Integrate with rule system caches
    this.integrateWithRuleSystem();
    
    // Integrate with parser caches
    this.integrateWithParserSystem();
    
    // Integrate with WASM resources
    this.integrateWithWASMSystem();
    
    // Integrate with DOM elements (if in browser)
    if (typeof window !== 'undefined') {
      this.integrateWithDOMSystem();
    }
  }
  
  /**
   * Integrate with rule processing system
   */
  integrateWithRuleSystem() {
    // Get rule cache
    const ruleCache = memoryManager.getCache('rules', {
      maxSize: 10 * 1024 * 1024, // 10MB for rules
      ttl: 60 * 60 * 1000 // 1 hour
    });
    
    // Override existing rule caching if available
    if (typeof self !== 'undefined' && self._rulesCache) {
      // Migrate existing cache
      this.migrateExistingCache('rules', self._rulesCache);
      
      // Replace with managed cache
      Object.defineProperty(self, '_rulesCache', {
        get: () => ruleCache,
        set: (value) => {
          if (value) {
            ruleCache.set('rules-data', value);
          }
        }
      });
    }
    
    this.integrations.set('rules', {
      cache: ruleCache,
      component: 'rule-system',
      lastIntegrated: Date.now()
    });
    
    console.log('✅ Rule system integrated with memory management');
  }
  
  /**
   * Integrate with parser system
   */
  integrateWithParserSystem() {
    const parserCache = memoryManager.getCache('parsers', {
      maxSize: 20 * 1024 * 1024, // 20MB for parsers
      ttl: 30 * 60 * 1000 // 30 minutes
    });
    
    // Register parser cleanup handler
    this.registerCleanupHandler('parser', (parser) => {
      if (parser && typeof parser.delete === 'function') {
        parser.delete();
      }
    });
    
    this.integrations.set('parsers', {
      cache: parserCache,
      component: 'parser-system',
      lastIntegrated: Date.now()
    });
    
    console.log('✅ Parser system integrated with memory management');
  }
  
  /**
   * Integrate with WASM system
   */
  integrateWithWASMSystem() {
    const wasmCache = memoryManager.getCache('wasm', {
      maxSize: 50 * 1024 * 1024, // 50MB for WASM
      ttl: 2 * 60 * 60 * 1000 // 2 hours (WASM is expensive to reload)
    });
    
    // Register WASM cleanup handler
    this.registerCleanupHandler('wasm', (wasmModule) => {
      if (wasmModule) {
        // Clean up WASM memory
        if (wasmModule.memory && wasmModule.memory.buffer) {
          // Let GC handle the buffer
        }
        if (wasmModule.cleanup && typeof wasmModule.cleanup === 'function') {
          wasmModule.cleanup();
        }
      }
    });
    
    this.integrations.set('wasm', {
      cache: wasmCache,
      component: 'wasm-system',
      lastIntegrated: Date.now()
    });
    
    console.log('✅ WASM system integrated with memory management');
  }
  
  /**
   * Integrate with DOM system (browser only)
   */
  integrateWithDOMSystem() {
    // Monitor large DOM operations
    const domCache = memoryManager.getCache('dom', {
      maxSize: 5 * 1024 * 1024, // 5MB for DOM cache
      ttl: 10 * 60 * 1000 // 10 minutes
    });
    
    // Track DOM mutation observers
    this.trackDOMMutationObservers();
    
    // Track event listeners
    this.trackEventListeners();
    
    this.integrations.set('dom', {
      cache: domCache,
      component: 'dom-system',
      lastIntegrated: Date.now()
    });
    
    console.log('✅ DOM system integrated with memory management');
  }
  
  /**
   * Track DOM mutation observers to prevent leaks
   */
  trackDOMMutationObservers() {
    const originalObserver = window.MutationObserver;
    
    window.MutationObserver = class extends originalObserver {
      constructor(callback) {
        super(callback);
        
        // Register with memory manager
        const id = `mutation-observer-${Date.now()}-${Math.random()}`;
        memoryManager.registerResource(id, 'mutation-observer', this, {
          createdAt: Date.now()
        });
        
        this._memoryManagerId = id;
      }
      
      disconnect() {
        super.disconnect();
        
        // Unregister from memory manager
        if (this._memoryManagerId) {
          memoryManager.unregisterResource(this._memoryManagerId);
        }
      }
    };
  }
  
  /**
   * Track event listeners to prevent leaks
   */
  trackEventListeners() {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    
    const eventListeners = new Map(); // element -> listeners
    
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      originalAddEventListener.call(this, type, listener, options);
      
      // Track the listener
      if (!eventListeners.has(this)) {
        eventListeners.set(this, new Set());
      }
      
      const listenerInfo = { type, listener, options };
      eventListeners.get(this).add(listenerInfo);
      
      // Register with memory manager
      const id = `event-listener-${Date.now()}-${Math.random()}`;
      memoryManager.registerResource(id, 'event-listener', {
        target: this,
        event: type,
        handler: listener,
        options
      }, {
        element: this.tagName || 'Unknown',
        event: type
      });
    };
    
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      originalRemoveEventListener.call(this, type, listener, options);
      
      // Untrack the listener
      if (eventListeners.has(this)) {
        const listeners = eventListeners.get(this);
        for (const listenerInfo of listeners) {
          if (listenerInfo.type === type && listenerInfo.listener === listener) {
            listeners.delete(listenerInfo);
            break;
          }
        }
        
        if (listeners.size === 0) {
          eventListeners.delete(this);
        }
      }
    };
  }
  
  /**
   * Migrate existing cache data to managed cache
   */
  migrateExistingCache(name, existingData) {
    const cache = this.integrations.get(name)?.cache;
    if (!cache || !existingData) return;
    
    try {
      if (typeof existingData === 'object') {
        if (existingData instanceof Map) {
          for (const [key, value] of existingData) {
            cache.set(key, value);
          }
        } else {
          for (const [key, value] of Object.entries(existingData)) {
            cache.set(key, value);
          }
        }
      }
      
      console.log(`Migrated existing ${name} cache data`);
    } catch (error) {
      console.warn(`Failed to migrate ${name} cache:`, error);
    }
  }
  
  /**
   * Register cleanup handler for resource type
   */
  registerCleanupHandler(type, handler) {
    this.cleanupHandlers.set(type, handler);
    
    // Also register with resource manager
    memoryManager.resourceManager.registerResourceType(type, handler);
  }
  
  /**
   * Monitor component for memory usage
   */
  monitorComponent(name, component) {
    if (this.monitoredComponents.has(name)) {
      return;
    }
    
    this.monitoredComponents.add(name);
    
    // Add memory tracking hooks if possible
    if (component && typeof component === 'object') {
      this.addMemoryHooks(name, component);
    }
    
    console.log(`Started monitoring component: ${name}`);
  }
  
  /**
   * Add memory tracking hooks to component
   */
  addMemoryHooks(name, component) {
    // Hook into common methods that might allocate memory
    const methodsToHook = ['parse', 'render', 'process', 'execute'];
    
    for (const methodName of methodsToHook) {
      if (typeof component[methodName] === 'function') {
        const originalMethod = component[methodName];
        
        component[methodName] = function(...args) {
          // Track memory before operation
          const beforeStats = memoryManager.memoryTracker.getCurrentStats();
          
          try {
            const result = originalMethod.apply(this, args);
            
            // Track memory after operation
            setTimeout(() => {
              const afterStats = memoryManager.memoryTracker.getCurrentStats();
              const memoryDiff = afterStats.heapUsed - beforeStats.heapUsed;
              
              if (memoryDiff > 1024 * 1024) { // Alert if > 1MB allocated
                console.log(`📊 ${name}.${methodName} allocated ${memoryManager.cacheManager.formatBytes(memoryDiff)}`);
              }
            }, 100);
            
            return result;
          } catch (error) {
            throw error;
          }
        };
      }
    }
  }
  
  /**
   * Get integration statistics
   */
  getStatistics() {
    const stats = {
      integrations: {},
      monitoredComponents: this.monitoredComponents.size,
      cleanupHandlers: this.cleanupHandlers.size
    };
    
    for (const [name, integration] of this.integrations) {
      stats.integrations[name] = {
        component: integration.component,
        lastIntegrated: integration.lastIntegrated,
        cacheStats: integration.cache.getStatistics()
      };
    }
    
    return stats;
  }
  
  /**
   * Perform cleanup for all integrations
   */
  cleanup() {
    console.log('🧹 Cleaning up memory integrations...');
    
    // Clear all managed caches
    for (const integration of this.integrations.values()) {
      if (integration.cache) {
        integration.cache.clear();
      }
    }
    
    // Clear tracking data
    this.monitoredComponents.clear();
    this.cleanupHandlers.clear();
    this.integrations.clear();
    
    console.log('✅ Memory integration cleanup complete');
  }
}

/**
 * Memory optimization utilities
 */
class MemoryOptimizer {
  static optimizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Remove null/undefined properties
    for (const key in obj) {
      if (obj[key] === null || obj[key] === undefined) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        MemoryOptimizer.optimizeObject(obj[key]);
      }
    }
    
    return obj;
  }
  
  static createWeakCache() {
    if (typeof WeakMap !== 'undefined') {
      return new WeakMap();
    } else {
      // Fallback to regular Map with size limit
      const cache = new Map();
      const maxSize = 100;
      
      return {
        get: (key) => cache.get(key),
        set: (key, value) => {
          if (cache.size >= maxSize) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
          }
          cache.set(key, value);
        },
        has: (key) => cache.has(key),
        delete: (key) => cache.delete(key)
      };
    }
  }
  
  static estimateObjectSize(obj) {
    if (obj === null || obj === undefined) return 0;
    
    switch (typeof obj) {
      case 'boolean':
        return 4;
      case 'number':
        return 8;
      case 'string':
        return obj.length * 2; // UTF-16
      case 'object':
        if (obj instanceof ArrayBuffer) {
          return obj.byteLength;
        } else if (ArrayBuffer.isView(obj)) {
          return obj.byteLength;
        } else {
          // Rough estimation for objects
          try {
            return JSON.stringify(obj).length * 2;
          } catch {
            return 100; // Default estimation
          }
        }
      default:
        return 100; // Default size
    }
  }
}

// Create global integration instance
export const memoryIntegration = new MemoryIntegration();

// Auto-start monitoring for known components
if (typeof window !== 'undefined') {
  // Monitor window object for large allocations
  memoryIntegration.monitorComponent('window', window);
}

// Export utilities
export { MemoryIntegration, MemoryOptimizer };

console.log('Memory integration system loaded successfully');