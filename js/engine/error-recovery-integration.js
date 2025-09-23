/**
 * Error Recovery Integration - Problem 7 Support Module
 * 
 * Integrates error recovery mechanisms with existing system components
 */

import { errorRecoveryManager } from './error-recovery.js';
import { memoryManager } from './memory-management.js';
// import { enhancedErrorPolicy } from './error-integration.js';

/**
 * 🔗 Error Recovery Integration Manager
 */
export class ErrorRecoveryIntegration {
  constructor() {
    this.integrations = new Map();
    this.monitoredSystems = new Set();
    this.recoveryHooks = new Map();
    
    this.setupSystemIntegrations();
  }
  
  setupSystemIntegrations() {
    // Integrate with parsing system
    this.integrateWithParsingSystem();
    
    // Integrate with analysis system
    this.integrateWithAnalysisSystem();
    
    // Integrate with generation system
    this.integrateWithGenerationSystem();
    
    // Integrate with memory management
    this.integrateWithMemorySystem();
    
    console.log('🔗 Error recovery integrations initialized');
  }
  
  integrateWithParsingSystem() {
    const parsingRecovery = {
      component: 'parsing-system',
      hooks: {
        beforeParse: (input, options) => {
          // Save state before parsing
          const stateManager = errorRecoveryManager.getStrategy('rollback');
          if (stateManager) {
            stateManager.saveState(`parse-${Date.now()}`, {
              input: input,
              options: options,
              timestamp: Date.now()
            });
          }
        },
        
        onParseError: async (error, context) => {
          console.log('🔧 Parse error detected, attempting recovery...');
          
          // Try fallback parsing strategies
          const fallbackStrategy = errorRecoveryManager.getStrategy('fallback');
          if (fallbackStrategy && fallbackStrategy.canHandle(context)) {
            try {
              const result = await fallbackStrategy.execute(context);
              if (result.recovered) {
                console.log('✅ Parse error recovered using fallback');
                return result.result;
              }
            } catch (recoveryError) {
              console.warn('❌ Parse recovery failed:', recoveryError.message);
            }
          }
          
          return null;
        }
      }
    };
    
    this.integrations.set('parsing', parsingRecovery);
    this.monitoredSystems.add('parsing');
  }
  
  integrateWithAnalysisSystem() {
    const analysisRecovery = {
      component: 'analysis-system',
      hooks: {
        beforeAnalysis: (data, options) => {
          // Cache successful analysis results
          const cache = memoryManager.getCache('analysis-recovery');
          const cacheKey = this._generateCacheKey(data, options);
          
          // Store in fallback cache for potential recovery
          cache.set(`backup-${cacheKey}`, {
            data: data,
            options: options,
            timestamp: Date.now()
          });
        },
        
        onAnalysisError: async (error, context) => {
          console.log('🔧 Analysis error detected, attempting recovery...');
          
          // Try cached result recovery
          const cache = memoryManager.getCache('analysis-recovery');
          const cacheKey = this._generateCacheKey(context.data, context.options);
          const cached = cache.get(`result-${cacheKey}`);
          
          if (cached) {
            console.log('✅ Analysis error recovered using cached result');
            return {
              recovered: true,
              result: cached,
              strategy: 'cached'
            };
          }
          
          // Try degraded analysis
          const degradedStrategy = errorRecoveryManager.getStrategy('degraded');
          if (degradedStrategy) {
            try {
              const result = await degradedStrategy.execute(context);
              if (result.recovered) {
                console.log('✅ Analysis error recovered using degraded mode');
                return result.result;
              }
            } catch (recoveryError) {
              console.warn('❌ Analysis recovery failed:', recoveryError.message);
            }
          }
          
          return null;
        }
      }
    };
    
    this.integrations.set('analysis', analysisRecovery);
    this.monitoredSystems.add('analysis');
  }
  
  integrateWithGenerationSystem() {
    const generationRecovery = {
      component: 'generation-system',
      hooks: {
        beforeGeneration: (config, data) => {
          // Save generation state
          const stateManager = errorRecoveryManager.getStrategy('rollback');
          if (stateManager) {
            stateManager.saveState(`generation-${Date.now()}`, {
              config: config,
              data: data,
              timestamp: Date.now()
            });
          }
        },
        
        onGenerationError: async (error, context) => {
          console.log('🔧 Generation error detected, attempting recovery...');
          
          // Try template-based recovery
          const fallbackStrategy = errorRecoveryManager.getStrategy('fallback');
          if (fallbackStrategy) {
            try {
              const result = await fallbackStrategy.execute(context);
              if (result.recovered) {
                console.log('✅ Generation error recovered using fallback template');
                return result.result;
              }
            } catch (recoveryError) {
              console.warn('❌ Generation recovery failed:', recoveryError.message);
            }
          }
          
          return null;
        }
      }
    };
    
    this.integrations.set('generation', generationRecovery);
    this.monitoredSystems.add('generation');
  }
  
  integrateWithMemorySystem() {
    const memoryRecovery = {
      component: 'memory-system',
      hooks: {
        onMemoryPressure: async (pressureLevel) => {
          console.log(`🧠 Memory pressure detected (${pressureLevel}), triggering cleanup...`);
          
          // Trigger aggressive cleanup
          try {
            const cleanupResult = memoryManager.performFullCleanup();
            console.log('✅ Memory pressure recovery completed:', cleanupResult);
            
            return {
              recovered: true,
              strategy: 'memory_cleanup',
              result: cleanupResult
            };
          } catch (cleanupError) {
            console.error('❌ Memory cleanup recovery failed:', cleanupError);
            return null;
          }
        },
        
        onMemoryError: async () => {
          console.log('🔧 Memory error detected, attempting recovery...');
          
          // Try circuit breaker to prevent cascade failures
          const circuitBreaker = errorRecoveryManager.getStrategy('circuit_breaker');
          if (circuitBreaker) {
            const cbState = circuitBreaker.getState();
            if (cbState.state === 'OPEN') {
              console.log('⚡ Circuit breaker OPEN - blocking operations to prevent cascade');
              return {
                recovered: true,
                strategy: 'circuit_breaker_block',
                result: { blocked: true }
              };
            }
          }
          
          return null;
        }
      }
    };
    
    this.integrations.set('memory', memoryRecovery);
    this.monitoredSystems.add('memory');
  }
  
  /**
   * Register a custom recovery hook
   */
  registerRecoveryHook(systemName, hookType, hookFunction) {
    if (!this.recoveryHooks.has(systemName)) {
      this.recoveryHooks.set(systemName, new Map());
    }
    
    this.recoveryHooks.get(systemName).set(hookType, hookFunction);
    console.log(`🪝 Recovery hook registered: ${systemName}.${hookType}`);
  }
  
  /**
   * Execute recovery hook
   */
  async executeRecoveryHook(systemName, hookType, ...args) {
    const systemHooks = this.recoveryHooks.get(systemName);
    if (systemHooks && systemHooks.has(hookType)) {
      const hook = systemHooks.get(hookType);
      try {
        return await hook(...args);
      } catch (error) {
        console.error(`Recovery hook ${systemName}.${hookType} failed:`, error);
        return null;
      }
    }
    
    // Check built-in integrations
    const integration = this.integrations.get(systemName);
    if (integration && integration.hooks && integration.hooks[hookType]) {
      try {
        return await integration.hooks[hookType](...args);
      } catch (error) {
        console.error(`Built-in recovery hook ${systemName}.${hookType} failed:`, error);
        return null;
      }
    }
    
    return null;
  }
  
  /**
   * Monitor system for recovery opportunities
   */
  monitorSystem(systemName) {
    if (this.monitoredSystems.has(systemName)) {
      console.log(`📊 System already monitored: ${systemName}`);
      return;
    }
    
    this.monitoredSystems.add(systemName);
    console.log(`📊 Started monitoring system: ${systemName}`);
  }
  
  /**
   * Stop monitoring system
   */
  stopMonitoring(systemName) {
    this.monitoredSystems.delete(systemName);
    console.log(`🛑 Stopped monitoring system: ${systemName}`);
  }
  
  /**
   * Get recovery statistics for all integrated systems
   */
  getIntegrationStatistics() {
    const stats = {
      integratedSystems: Array.from(this.integrations.keys()),
      monitoredSystems: Array.from(this.monitoredSystems),
      customHooks: {},
      recoveryManager: errorRecoveryManager.getStatistics()
    };
    
    // Count custom hooks per system
    for (const [systemName, hooks] of this.recoveryHooks) {
      stats.customHooks[systemName] = hooks.size;
    }
    
    return stats;
  }
  
  _generateCacheKey(data, options) {
    // Simple cache key generation
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const optionsStr = typeof options === 'object' ? JSON.stringify(options) : String(options);
    
    return `${dataStr.slice(0, 50)}-${optionsStr.slice(0, 50)}`.replace(/[^a-zA-Z0-9-]/g, '');
  }
  
  /**
   * Cleanup integration resources
   */
  cleanup() {
    this.integrations.clear();
    this.monitoredSystems.clear();
    this.recoveryHooks.clear();
    
    console.log('🧹 Error recovery integration cleanup completed');
  }
}

/**
 * 🎯 Recovery Policy Manager
 */
export class RecoveryPolicyManager {
  constructor() {
    this.policies = new Map();
    this.defaultPolicy = this.createDefaultPolicy();
    this.activePolicies = new Set();
    
    this.setupDefaultPolicies();
  }
  
  createDefaultPolicy() {
    return {
      name: 'default',
      rules: [
        {
          condition: (error) => error.code === 'PARSE_ERROR',
          strategy: 'fallback',
          maxRetries: 2
        },
        {
          condition: (error) => error.code === 'MEMORY_ERROR',
          strategy: 'circuit_breaker',
          maxRetries: 1
        },
        {
          condition: (error) => error.severity === 'critical',
          strategy: 'rollback',
          maxRetries: 1
        },
        {
          condition: () => true, // Catch-all
          strategy: 'degraded',
          maxRetries: 3
        }
      ]
    };
  }
  
  setupDefaultPolicies() {
    this.registerPolicy(this.defaultPolicy);
    this.activatePolicy('default');
    
    // Register specialized policies
    this.registerPolicy({
      name: 'aggressive_recovery',
      rules: [
        {
          condition: (error) => error.recovery.retries < 5,
          strategy: 'retry',
          maxRetries: 5
        },
        {
          condition: (error) => error.code.includes('PARSE'),
          strategy: 'fallback',
          maxRetries: 3
        },
        {
          condition: () => true,
          strategy: 'degraded',
          maxRetries: 2
        }
      ]
    });
    
    this.registerPolicy({
      name: 'conservative_recovery',
      rules: [
        {
          condition: (error) => error.severity === 'warning',
          strategy: 'retry',
          maxRetries: 1
        },
        {
          condition: () => true,
          strategy: 'degraded',
          maxRetries: 1
        }
      ]
    });
  }
  
  /**
   * Register a recovery policy
   */
  registerPolicy(policy) {
    if (!policy.name || !policy.rules || !Array.isArray(policy.rules)) {
      throw new Error('Invalid policy format');
    }
    
    this.policies.set(policy.name, policy);
    console.log(`📋 Recovery policy registered: ${policy.name}`);
  }
  
  /**
   * Activate a policy
   */
  activatePolicy(policyName) {
    if (!this.policies.has(policyName)) {
      throw new Error(`Policy not found: ${policyName}`);
    }
    
    this.activePolicies.add(policyName);
    console.log(`✅ Recovery policy activated: ${policyName}`);
  }
  
  /**
   * Deactivate a policy
   */
  deactivatePolicy(policyName) {
    this.activePolicies.delete(policyName);
    console.log(`❌ Recovery policy deactivated: ${policyName}`);
  }
  
  /**
   * Evaluate which recovery strategies to use for an error
   */
  evaluateRecoveryStrategies(errorContext) {
    const strategies = [];
    
    for (const policyName of this.activePolicies) {
      const policy = this.policies.get(policyName);
      
      for (const rule of policy.rules) {
        try {
          if (rule.condition(errorContext)) {
            strategies.push({
              policy: policyName,
              strategy: rule.strategy,
              maxRetries: rule.maxRetries,
              priority: rule.priority || 0
            });
          }
        } catch (error) {
          console.warn(`Policy evaluation error in ${policyName}:`, error.message);
        }
      }
    }
    
    // Sort by priority (higher first)
    strategies.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return strategies;
  }
  
  /**
   * Get all registered policies
   */
  getPolicies() {
    return Array.from(this.policies.keys());
  }
  
  /**
   * Get active policies
   */
  getActivePolicies() {
    return Array.from(this.activePolicies);
  }
}

// Global instances
export const errorRecoveryIntegration = new ErrorRecoveryIntegration();
export const recoveryPolicyManager = new RecoveryPolicyManager();

// Integration helper functions
export function registerRecoveryHook(systemName, hookType, hookFunction) {
  return errorRecoveryIntegration.registerRecoveryHook(systemName, hookType, hookFunction);
}

export function executeRecoveryHook(systemName, hookType, ...args) {
  return errorRecoveryIntegration.executeRecoveryHook(systemName, hookType, ...args);
}

export function registerRecoveryPolicy(policy) {
  return recoveryPolicyManager.registerPolicy(policy);
}

export function activateRecoveryPolicy(policyName) {
  return recoveryPolicyManager.activatePolicy(policyName);
}

// Auto-initialization
console.log('🔗 Error recovery integration system loaded');
console.log(`✅ Integrated systems: ${errorRecoveryIntegration.integrations.size}`);
console.log(`✅ Recovery policies: ${recoveryPolicyManager.policies.size}`);

export default errorRecoveryIntegration;