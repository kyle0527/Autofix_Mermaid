/**
 * Rule Integration System
 * 
 * Integrates optimized rule processing with existing rule systems
 * Provides backward compatibility and enhanced performance
 */

import { ruleOptimization } from './rule-optimization.js';

/**
 * Enhanced rule loader with optimization support
 */
class OptimizedRuleLoader {
  constructor() {
    this.loadedRuleSets = [];
    this.isInitialized = false;
    this.loadingPromise = null;
  }
  
  /**
   * Load rules from various sources
   */
  async loadRules(sources = []) {
    if (this.loadingPromise) {
      return await this.loadingPromise;
    }
    
    this.loadingPromise = this._performLoad(sources);
    return await this.loadingPromise;
  }
  
  async _performLoad(sources) {
    const ruleSets = [];
    
    // Default rule sources if none provided
    if (sources.length === 0) {
      sources = [
        'assets/rules.registry.json',
        'js/models/rules_v1.json',
        'rules/rulepack.json'
      ];
    }
    
    for (const source of sources) {
      try {
        const rules = await this._loadFromSource(source);
        if (rules && rules.length > 0) {
          ruleSets.push(rules);
          console.log(`Loaded ${rules.length} rules from ${source}`);
        }
      } catch (error) {
        console.warn(`Failed to load rules from ${source}:`, error.message);
      }
    }
    
    this.loadedRuleSets = ruleSets;
    
    // Initialize optimization system
    const initResult = await ruleOptimization.initialize(ruleSets);
    this.isInitialized = true;
    
    console.log(`Rule optimization initialized with ${initResult.rulesLoaded} rules`);
    return initResult;
  }
  
  async _loadFromSource(source) {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Handle different rule formats
      if (Array.isArray(data)) {
        return data;
      } else if (data.rules && Array.isArray(data.rules)) {
        return data.rules;
      } else if (data.registry && Array.isArray(data.registry)) {
        return data.registry;
      }
      
      return [];
    } catch (error) {
      console.warn(`Error loading rules from ${source}:`, error);
      return [];
    }
  }
  
  /**
   * Ensure rules are loaded
   */
  async ensureLoaded() {
    if (!this.isInitialized) {
      await this.loadRules();
    }
    return this.isInitialized;
  }
}

/**
 * Enhanced rule processor with fallback support
 */
class EnhancedRuleProcessor {
  constructor() {
    this.loader = new OptimizedRuleLoader();
    this.fallbackProcessors = [];
    this.processingHistory = [];
  }
  
  /**
   * Add fallback processor for compatibility
   */
  addFallbackProcessor(processor) {
    this.fallbackProcessors.push(processor);
  }
  
  /**
   * Process text with optimized rules and fallback support
   */
  async processText(text, diagramType = 'auto', options = {}) {
    await this.loader.ensureLoaded();
    
    const startTime = performance.now();
    let result = null;
    let usedProcessor = 'optimized';
    
    try {
      // Try optimized processor first
      result = await ruleOptimization.processWithRules(text, diagramType, options);
      
      // Record successful processing
      this.processingHistory.push({
        timestamp: Date.now(),
        diagramType,
        processor: usedProcessor,
        success: true,
        processingTimeMs: result.processingTimeMs,
        rulesApplied: result.appliedRules?.length || 0
      });
      
    } catch (error) {
      console.warn('Optimized processor failed, trying fallbacks:', error);
      
      // Try fallback processors
      for (let i = 0; i < this.fallbackProcessors.length; i++) {
        try {
          const processor = this.fallbackProcessors[i];
          usedProcessor = `fallback-${i}`;
          
          result = await processor.processText(text, diagramType, options);
          if (result) {
            console.log(`Fallback processor ${i} succeeded`);
            break;
          }
        } catch (fallbackError) {
          console.warn(`Fallback processor ${i} failed:`, fallbackError);
        }
      }
      
      // If all processors failed, return minimal result
      if (!result) {
        const endTime = performance.now();
        result = {
          originalText: text,
          processedText: text,
          diagramType,
          modified: false,
          errors: [{
            type: 'all_processors_failed',
            message: 'All rule processors failed'
          }],
          processingTimeMs: endTime - startTime
        };
        usedProcessor = 'none';
      }
      
      // Record processing attempt
      this.processingHistory.push({
        timestamp: Date.now(),
        diagramType,
        processor: usedProcessor,
        success: result !== null,
        processingTimeMs: performance.now() - startTime,
        error: error.message
      });
    }
    
    return {
      ...result,
      processor: usedProcessor,
      fallbackAvailable: this.fallbackProcessors.length > 0
    };
  }
  
  /**
   * Batch process multiple texts
   */
  async batchProcess(items, options = {}) {
    await this.loader.ensureLoaded();
    
    const batchResults = await ruleOptimization.batchProcess(items, options);
    
    // Record batch processing
    this.processingHistory.push({
      timestamp: Date.now(),
      type: 'batch',
      itemCount: items.length,
      processor: 'optimized-batch',
      success: true,
      processingTimeMs: batchResults.totalProcessingTimeMs
    });
    
    return batchResults;
  }
  
  /**
   * Get processing statistics
   */
  getStatistics() {
    const optimizedStats = ruleOptimization.getStatistics();
    
    // Analyze processing history
    const history = this.processingHistory;
    const totalProcessings = history.length;
    const successfulProcessings = history.filter(h => h.success).length;
    const optimizedUsage = history.filter(h => h.processor === 'optimized').length;
    const fallbackUsage = history.filter(h => h.processor.startsWith('fallback')).length;
    
    return {
      optimized: optimizedStats,
      processing: {
        total: totalProcessings,
        successful: successfulProcessings,
        successRate: totalProcessings > 0 ? (successfulProcessings / totalProcessings) * 100 : 0,
        optimizedUsage,
        fallbackUsage,
        fallbackRate: totalProcessings > 0 ? (fallbackUsage / totalProcessings) * 100 : 0
      },
      fallbacks: {
        available: this.fallbackProcessors.length,
        processors: this.fallbackProcessors.map((p, i) => ({
          index: i,
          name: p.constructor.name || `FallbackProcessor${i}`
        }))
      }
    };
  }
  
  /**
   * Clear processing history
   */
  clearHistory() {
    this.processingHistory = [];
  }
}

/**
 * Legacy rule processor adapter for backward compatibility
 */
class LegacyRuleAdapter {
  constructor(legacyApplyRules) {
    this.legacyApplyRules = legacyApplyRules;
  }
  
  async processText(text, diagramType, options = {}) {
    try {
      const result = this.legacyApplyRules(text, {
        dtype: diagramType,
        ...options
      });
      
      return {
        originalText: text,
        processedText: result.code || text,
        diagramType,
        modified: result.code !== text,
        errors: result.errors || [],
        appliedRules: [],
        processingTimeMs: 0,
        rulesMatched: 0,
        legacy: true
      };
    } catch (error) {
      throw new Error(`Legacy adapter error: ${error.message}`);
    }
  }
}

// Create global enhanced processor
const enhancedProcessor = new EnhancedRuleProcessor();

// Auto-setup fallback processors if available
if (typeof self !== 'undefined') {
  // Try to add legacy processors as fallbacks
  if (self.applyRules) {
    enhancedProcessor.addFallbackProcessor(new LegacyRuleAdapter(self.applyRules));
  }
  
  // Export enhanced processor to global scope
  self.EnhancedRuleProcessor = enhancedProcessor;
  
  // Override global rule processing if available
  self.processWithOptimizedRules = async function(text, diagramType, options) {
    return await enhancedProcessor.processText(text, diagramType, options);
  };
}

export {
  OptimizedRuleLoader,
  EnhancedRuleProcessor,
  LegacyRuleAdapter,
  enhancedProcessor
};