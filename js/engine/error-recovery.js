/**
 * Error Recovery Mechanisms - Problem 7
 * 
 * Intelligent error recovery with fallback strategies, state rollback,
 * and progressive degradation for maximum system resilience
 */

import { 
  globalErrorManager 
} from './error-propagation.js';

import { memoryManager } from './memory-management.js';

/**
 * 🔧 Recovery Strategy Interface
 */
export class RecoveryStrategy {
  constructor(name, options = {}) {
    this.name = name;
    this.priority = options.priority || 0;
    this.enabled = options.enabled !== false;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 5000;
    this.conditions = options.conditions || [];
  }
  
  /**
   * Check if this strategy can handle the error
   */
  canHandle(errorContext) {
    if (!this.enabled) return false;
    
    // Check conditions
    return this.conditions.every(condition => {
      if (typeof condition === 'function') {
        return condition(errorContext);
      }
      if (typeof condition === 'string') {
        return errorContext.code === condition;
      }
      return true;
    });
  }
  
  /**
   * Execute the recovery strategy
   */
  async execute() {
    throw new Error('RecoveryStrategy.execute must be implemented by subclasses');
  }
  
  /**
   * Clean up after recovery attempt
   */
  cleanup() {
    // Override in subclasses if needed
  }
}

/**
 * 🔄 Fallback Strategy
 */
export class FallbackStrategy extends RecoveryStrategy {
  constructor(options = {}) {
    super('fallback', {
      priority: 1,
      conditions: ['PARSE_ERROR', 'ANALYSIS_ERROR', 'GENERATION_ERROR'],
      ...options
    });
    
    this.fallbackProviders = new Map();
    this.registerDefaultFallbacks();
  }
  
  registerDefaultFallbacks() {
    // Parser fallbacks
    this.fallbackProviders.set('PARSE_ERROR', {
      regex: () => this._regexFallback(),
      minimal: () => this._minimalParser(),
      empty: () => this._emptyResult()
    });
    
    // Analysis fallbacks  
    this.fallbackProviders.set('ANALYSIS_ERROR', {
      basic: () => this._basicAnalysis(),
      cached: () => this._cachedResult(),
      default: () => this._defaultAnalysis()
    });
    
    // Generation fallbacks
    this.fallbackProviders.set('GENERATION_ERROR', {
      template: () => this._templateGeneration(),
      simple: () => this._simpleGeneration(),
      placeholder: () => this._placeholderGeneration()
    });
  }
  
  async execute(errorContext) {
    const providers = this.fallbackProviders.get(errorContext.code);
    if (!providers) {
      throw new Error(`No fallback providers for error code: ${errorContext.code}`);
    }
    
    const providerNames = Object.keys(providers);
    let lastError = null;
    
    for (const providerName of providerNames) {
      try {
        console.log(`🔄 Trying fallback provider: ${providerName}`);
        
        const provider = providers[providerName];
        const result = await this._executeWithTimeout(provider, errorContext);
        
        if (result && result.success) {
          errorContext.addContext('fallback_provider', providerName);
          return {
            recovered: true,
            strategy: 'fallback',
            provider: providerName,
            result: result.data
          };
        }
      } catch (error) {
        lastError = error;
        console.warn(`Fallback provider ${providerName} failed:`, error.message);
      }
    }
    
    throw new Error(`All fallback providers failed. Last error: ${lastError?.message}`);
  }
  
  async _executeWithTimeout(provider, errorContext) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Fallback provider timeout'));
      }, this.timeout);
      
      Promise.resolve(provider(errorContext))
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  _regexFallback() {
    return {
      success: true,
      data: {
        type: 'regex_parse',
        nodes: [],
        edges: [],
        metadata: { fallback: 'regex' }
      }
    };
  }
  
  _minimalParser() {
    return {
      success: true,
      data: {
        type: 'minimal_parse',
        nodes: [{ id: 'error', label: 'Parse Error' }],
        edges: [],
        metadata: { fallback: 'minimal' }
      }
    };
  }
  
  _emptyResult() {
    return {
      success: true,
      data: {
        type: 'empty',
        nodes: [],
        edges: [],
        metadata: { fallback: 'empty' }
      }
    };
  }
  
  _basicAnalysis() {
    return {
      success: true,
      data: {
        complexity: 'unknown',
        metrics: {},
        issues: [],
        metadata: { fallback: 'basic' }
      }
    };
  }
  
  _cachedResult() {
    const cache = memoryManager.getCache('analysis-fallback');
    const cached = cache.get('last_successful_analysis');
    
    if (cached) {
      return {
        success: true,
        data: {
          ...cached,
          metadata: { ...cached.metadata, fallback: 'cached' }
        }
      };
    }
    
    return { success: false };
  }
  
  _defaultAnalysis() {
    return {
      success: true,
      data: {
        complexity: 'low',
        metrics: { nodes: 0, edges: 0 },
        issues: [],
        metadata: { fallback: 'default' }
      }
    };
  }
  
  _templateGeneration() {
    return {
      success: true,
      data: {
        code: 'graph TD\n  A[Start] --> B[Error]\n  B --> C[End]',
        metadata: { fallback: 'template' }
      }
    };
  }
  
  _simpleGeneration() {
    return {
      success: true,
      data: {
        code: 'flowchart LR\n  Error --> Recovery',
        metadata: { fallback: 'simple' }
      }
    };
  }
  
  _placeholderGeneration() {
    return {
      success: true,
      data: {
        code: '<!-- Generation failed -->',
        metadata: { fallback: 'placeholder' }
      }
    };
  }
}

/**
 * 🔁 Retry Strategy
 */
export class RetryStrategy extends RecoveryStrategy {
  constructor(options = {}) {
    super('retry', {
      priority: 2,
      maxRetries: options.maxRetries || 3,
      backoffMultiplier: options.backoffMultiplier || 2,
      initialDelay: options.initialDelay || 1000,
      ...options
    });
    
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.initialDelay = options.initialDelay || 1000;
  }
  
  canHandle(errorContext) {
    if (!super.canHandle(errorContext)) return false;
    
    // Only retry if we haven't exceeded max retries
    return errorContext.recovery.retries < this.maxRetries;
  }
  
  async execute(errorContext) {
    const retryCount = errorContext.recovery.retries + 1;
    const delay = this.initialDelay * Math.pow(this.backoffMultiplier, retryCount - 1);
    
    console.log(`🔁 Retry attempt ${retryCount}/${this.maxRetries} after ${delay}ms`);
    
    // Wait for backoff delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Get the original operation from context
    const originalOperation = errorContext.source.operation;
    if (!originalOperation || typeof originalOperation !== 'function') {
      throw new Error('No retryable operation found in error context');
    }
    
    try {
      const result = await originalOperation();
      
      return {
        recovered: true,
        strategy: 'retry',
        attempt: retryCount,
        result: result
      };
    } catch (error) {
      errorContext.recovery.retries++;
      
      if (retryCount >= this.maxRetries) {
        throw new Error(`Retry strategy failed after ${this.maxRetries} attempts: ${error.message}`);
      }
      
      // Try again
      return await this.execute(errorContext);
    }
  }
}

/**
 * 📉 Degraded Mode Strategy
 */
export class DegradedModeStrategy extends RecoveryStrategy {
  constructor(options = {}) {
    super('degraded', {
      priority: 0,
      ...options
    });
    
    this.degradationLevels = options.degradationLevels || [
      'disable_advanced_features',
      'use_basic_parsing',
      'minimal_functionality',
      'emergency_mode'
    ];
    
    this.currentLevel = 0;
  }
  
  async execute(errorContext) {
    if (this.currentLevel >= this.degradationLevels.length) {
      throw new Error('Maximum degradation level reached');
    }
    
    const level = this.degradationLevels[this.currentLevel];
    console.log(`📉 Entering degraded mode: ${level}`);
    
    const result = await this._applyDegradation(level, errorContext);
    this.currentLevel++;
    
    return {
      recovered: true,
      strategy: 'degraded',
      level: level,
      result: result
    };
  }
  
  async _applyDegradation(level, errorContext) {
    switch (level) {
      case 'disable_advanced_features':
        return this._disableAdvancedFeatures(errorContext);
      
      case 'use_basic_parsing':
        return this._useBasicParsing(errorContext);
      
      case 'minimal_functionality':
        return this._enableMinimalMode(errorContext);
      
      case 'emergency_mode':
        return this._activateEmergencyMode(errorContext);
      
      default:
        throw new Error(`Unknown degradation level: ${level}`);
    }
  }
  
  _disableAdvancedFeatures() {
    // Disable complex features
    return {
      mode: 'basic',
      features: {
        treeSitter: false,
        advanced_analysis: false,
        complex_generation: false
      },
      message: 'Advanced features disabled'
    };
  }
  
  _useBasicParsing() {
    // Use only regex-based parsing
    return {
      mode: 'basic_parsing',
      parser: 'regex',
      features: {
        syntax_highlighting: false,
        error_recovery: false,
        incremental_parsing: false
      },
      message: 'Using basic regex parsing'
    };
  }
  
  _enableMinimalMode() {
    // Minimal functionality only
    return {
      mode: 'minimal',
      features: {
        parsing: 'text_only',
        analysis: 'disabled',
        generation: 'template_only'
      },
      message: 'Minimal functionality mode'
    };
  }
  
  _activateEmergencyMode() {
    // Emergency mode - almost no functionality
    return {
      mode: 'emergency',
      features: {
        parsing: 'disabled',
        analysis: 'disabled', 
        generation: 'error_message_only'
      },
      message: 'Emergency mode activated - system in safe state'
    };
  }
  
  reset() {
    this.currentLevel = 0;
    console.log('📈 Degraded mode reset to normal operation');
  }
}

/**
 * 💾 State Rollback Strategy
 */
export class StateRollbackStrategy extends RecoveryStrategy {
  constructor(options = {}) {
    super('rollback', {
      priority: 3,
      ...options
    });
    
    this.stateHistory = [];
    this.maxHistorySize = options.maxHistorySize || 10;
    this.rollbackCache = memoryManager.getCache('state-rollback', {
      maxSize: 50 * 1024 * 1024, // 50MB
      ttl: 30 * 60 * 1000 // 30 minutes
    });
  }
  
  /**
   * Save current state for potential rollback
   */
  saveState(stateId, state) {
    const stateSnapshot = {
      id: stateId,
      timestamp: Date.now(),
      data: this._deepClone(state)
    };
    
    this.stateHistory.push(stateSnapshot);
    this.rollbackCache.set(stateId, stateSnapshot);
    
    // Limit history size
    if (this.stateHistory.length > this.maxHistorySize) {
      const removed = this.stateHistory.shift();
      this.rollbackCache.delete(removed.id);
    }
    
    console.log(`💾 State saved: ${stateId}`);
  }
  
  async execute(errorContext) {
    // Try to find a suitable rollback point
    const rollbackPoint = this._findRollbackPoint(errorContext);
    
    if (!rollbackPoint) {
      throw new Error('No suitable rollback point found');
    }
    
    console.log(`⏪ Rolling back to state: ${rollbackPoint.id}`);
    
    try {
      const restoredState = await this._restoreState(rollbackPoint);
      
      return {
        recovered: true,
        strategy: 'rollback',
        rollbackPoint: rollbackPoint.id,
        timestamp: rollbackPoint.timestamp,
        result: restoredState
      };
    } catch (rollbackError) {
      throw new Error(`State rollback failed: ${rollbackError.message}`);
    }
  }
  
  _findRollbackPoint(errorContext) {
    // Find the most recent stable state before the error
    const errorTime = errorContext.timestamp;
    
    for (let i = this.stateHistory.length - 1; i >= 0; i--) {
      const state = this.stateHistory[i];
      if (state.timestamp < errorTime) {
        return state;
      }
    }
    
    return null;
  }
  
  async _restoreState(stateSnapshot) {
    // Restore from cache if available, otherwise from memory
    let state = this.rollbackCache.get(stateSnapshot.id);
    
    if (!state) {
      state = stateSnapshot;
    }
    
    // Deep clone to avoid mutations
    return this._deepClone(state.data);
  }
  
  _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this._deepClone(item));
    if (typeof obj === 'object') {
      const cloned = {};
      Object.keys(obj).forEach(key => {
        cloned[key] = this._deepClone(obj[key]);
      });
      return cloned;
    }
  }
  
  clearHistory() {
    this.stateHistory = [];
    this.rollbackCache.clear();
    console.log('🧹 State history cleared');
  }
}

/**
 * 🚨 Circuit Breaker Strategy
 */
export class CircuitBreakerStrategy extends RecoveryStrategy {
  constructor(options = {}) {
    super('circuit_breaker', {
      priority: 4,
      ...options
    });
    
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    
    this.operations = new Map(); // Track operations
  }
  
  canHandle(errorContext) {
    const operation = errorContext.source.operation?.name || 'default';
    return this.state !== 'OPEN' || this._shouldAttemptReset(operation);
  }
  
  async execute(errorContext) {
    const operation = errorContext.source.operation?.name || 'default';
    
    if (this.state === 'OPEN') {
      if (this._shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        console.log('🔄 Circuit breaker: HALF_OPEN - attempting reset');
      } else {
        throw new Error('Circuit breaker is OPEN - operation blocked');
      }
    }
    
    try {
      // Attempt the operation
      const originalOperation = errorContext.source.operation;
      if (!originalOperation) {
        throw new Error('No operation to execute');
      }
      
      const result = await originalOperation();
      
      // Success - reset circuit breaker
      this._recordSuccess(operation);
      
      return {
        recovered: true,
        strategy: 'circuit_breaker',
        state: this.state,
        result: result
      };
      
    } catch (error) {
      this._recordFailure(operation);
      throw error;
    }
  }
  
  _shouldAttemptReset() {
    if (this.state !== 'OPEN') return true;
    
    const now = Date.now();
    return (now - this.lastFailureTime) > this.resetTimeout;
  }
  
  _recordSuccess(operation) {
    this.failureCount = 0;
    this.state = 'CLOSED';
    console.log(`✅ Circuit breaker: ${operation} - SUCCESS (CLOSED)`);
  }
  
  _recordFailure(operation) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log(`🚨 Circuit breaker: ${operation} - OPEN (${this.failureCount} failures)`);
    } else {
      console.log(`⚠️ Circuit breaker: ${operation} - FAILURE ${this.failureCount}/${this.failureThreshold}`);
    }
  }
  
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime
    };
  }
  
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    console.log('🔄 Circuit breaker manually reset');
  }
}

/**
 * 🛡️ Error Recovery Manager
 */
export class ErrorRecoveryManager {
  constructor(options = {}) {
    this.strategies = new Map();
    this.config = {
      enableRecovery: options.enableRecovery !== false,
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
      recoveryTimeout: options.recoveryTimeout || 10000,
      ...options
    };
    
    this.recoveryHistory = [];
    this.statistics = {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      strategyCounts: {}
    };
    
    this.setupDefaultStrategies();
    this.setupIntegration();
  }
  
  setupDefaultStrategies() {
    // Register default strategies in priority order
    this.registerStrategy(new DegradedModeStrategy());
    this.registerStrategy(new FallbackStrategy());
    this.registerStrategy(new RetryStrategy());
    this.registerStrategy(new StateRollbackStrategy());
    this.registerStrategy(new CircuitBreakerStrategy());
  }
  
  setupIntegration() {
    // Integrate with existing error propagation system
    globalErrorManager.addListener('error', (errorContext) => {
      if (this.config.enableRecovery) {
        this.attemptRecovery(errorContext);
      }
    });
    
    // Register cleanup with memory manager
    memoryManager.registerResource(
      'error-recovery-manager',
      'system',
      this,
      { component: 'error-recovery' }
    );
  }
  
  /**
   * Register a recovery strategy
   */
  registerStrategy(strategy) {
    if (!(strategy instanceof RecoveryStrategy)) {
      throw new Error('Strategy must be an instance of RecoveryStrategy');
    }
    
    this.strategies.set(strategy.name, strategy);
    this.statistics.strategyCounts[strategy.name] = {
      attempts: 0,
      successes: 0,
      failures: 0
    };
    
    console.log(`🛡️ Recovery strategy registered: ${strategy.name} (priority: ${strategy.priority})`);
  }
  
  /**
   * Unregister a recovery strategy
   */
  unregisterStrategy(strategyName) {
    const strategy = this.strategies.get(strategyName);
    if (strategy) {
      strategy.cleanup();
      this.strategies.delete(strategyName);
      console.log(`🗑️ Recovery strategy unregistered: ${strategyName}`);
    }
  }
  
  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(errorContext) {
    if (!this.config.enableRecovery) {
      console.log('🚫 Error recovery disabled');
      return null;
    }
    
    console.log(`🛡️ Attempting recovery for error: ${errorContext.code}`);
    
    this.statistics.totalAttempts++;
    
    // Get applicable strategies sorted by priority
    const applicableStrategies = this._getApplicableStrategies(errorContext);
    
    if (applicableStrategies.length === 0) {
      console.log('⚠️ No applicable recovery strategies found');
      this.statistics.failedRecoveries++;
      return null;
    }
    
    let recoveryResult = null;
    let lastError = null;
    
    for (const strategy of applicableStrategies) {
      try {
        console.log(`🔧 Trying recovery strategy: ${strategy.name}`);
        
        this.statistics.strategyCounts[strategy.name].attempts++;
        
        const result = await this._executeStrategyWithTimeout(strategy, errorContext);
        
        if (result && result.recovered) {
          this.statistics.successfulRecoveries++;
          this.statistics.strategyCounts[strategy.name].successes++;
          
          // Record successful recovery
          errorContext.recordRecoveryAttempt(strategy.name, true, result);
          
          recoveryResult = result;
          console.log(`✅ Recovery successful with strategy: ${strategy.name}`);
          break;
        }
        
      } catch (error) {
        lastError = error;
        this.statistics.strategyCounts[strategy.name].failures++;
        console.warn(`❌ Recovery strategy ${strategy.name} failed:`, error.message);
      }
    }
    
    if (!recoveryResult) {
      this.statistics.failedRecoveries++;
      errorContext.recordRecoveryAttempt('all_strategies', false);
      console.error('💥 All recovery strategies failed. Last error:', lastError?.message);
    }
    
    // Record recovery attempt in history
    this._recordRecoveryAttempt(errorContext, recoveryResult, lastError);
    
    return recoveryResult;
  }
  
  async _executeStrategyWithTimeout(strategy, errorContext) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Recovery strategy ${strategy.name} timed out`));
      }, this.config.recoveryTimeout);
      
      strategy.execute(errorContext)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  _getApplicableStrategies(errorContext) {
    const strategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.canHandle(errorContext))
      .sort((a, b) => b.priority - a.priority); // Higher priority first
    
    console.log(`🔍 Found ${strategies.length} applicable strategies: ${strategies.map(s => s.name).join(', ')}`);
    
    return strategies;
  }
  
  _recordRecoveryAttempt(errorContext, result, error) {
    const record = {
      timestamp: Date.now(),
      errorCode: errorContext.code,
      errorMessage: errorContext.message,
      successful: !!result?.recovered,
      strategy: result?.strategy || null,
      error: error?.message || null
    };
    
    this.recoveryHistory.push(record);
    
    // Limit history size
    if (this.recoveryHistory.length > 100) {
      this.recoveryHistory.shift();
    }
  }
  
  /**
   * Get recovery statistics
   */
  getStatistics() {
    const successRate = this.statistics.totalAttempts > 0 
      ? (this.statistics.successfulRecoveries / this.statistics.totalAttempts) * 100 
      : 0;
    
    return {
      ...this.statistics,
      successRate: successRate,
      strategiesRegistered: this.strategies.size,
      recentHistory: this.recoveryHistory.slice(-10)
    };
  }
  
  /**
   * Get strategy by name
   */
  getStrategy(name) {
    return this.strategies.get(name);
  }
  
  /**
   * Enable/disable recovery
   */
  setRecoveryEnabled(enabled) {
    this.config.enableRecovery = enabled;
    console.log(`🛡️ Error recovery ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Reset all strategies and statistics
   */
  reset() {
    // Reset all strategies
    for (const strategy of this.strategies.values()) {
      if (typeof strategy.reset === 'function') {
        strategy.reset();
      }
    }
    
    // Reset statistics
    this.statistics = {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      strategyCounts: {}
    };
    
    // Initialize strategy counts
    for (const strategyName of this.strategies.keys()) {
      this.statistics.strategyCounts[strategyName] = {
        attempts: 0,
        successes: 0,
        failures: 0
      };
    }
    
    this.recoveryHistory = [];
    console.log('🔄 Error recovery manager reset');
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    for (const strategy of this.strategies.values()) {
      strategy.cleanup();
    }
    
    this.strategies.clear();
    this.recoveryHistory = [];
    
    console.log('🧹 Error recovery manager cleanup completed');
  }
}

// Global error recovery manager instance
export const errorRecoveryManager = new ErrorRecoveryManager();

// Integration helper functions
export function registerRecoveryStrategy(strategy) {
  return errorRecoveryManager.registerStrategy(strategy);
}

export function attemptErrorRecovery(errorContext) {
  return errorRecoveryManager.attemptRecovery(errorContext);
}

export function getRecoveryStatistics() {
  return errorRecoveryManager.getStatistics();
}

// Auto-initialization
console.log('🛡️ Error recovery system initialized');
console.log(`✅ Recovery strategies registered: ${errorRecoveryManager.strategies.size}`);
console.log('✅ Integration with error propagation system complete');

export default errorRecoveryManager;