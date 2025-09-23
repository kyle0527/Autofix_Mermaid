/**
 * Rule Application Optimization System
 * 
 * Problem 5: Optimizes rule matching algorithms and reduces rule processing overhead
 * - Implements efficient rule matching with pre-computed indices
 * - Provides rule caching and memoization
 * - Optimizes pattern matching with compiled regex
 * - Adds rule priority        const result = await this._evaluatePattern(pattern, ir);queues and conditional application
 * - Supports batch processing and parallel execution
 * 
 * Dependencies: Problem 2 (unified-ir.js), Problem 3 (error-propagation.js)
 */

import { UnifiedIR } from './unified-ir.js';
import { ErrorPropagationManager } from './error-propagation.js';

/**
 * Optimized rule matcher with pre-compiled patterns and indices
 */
class RuleMatcher {
  constructor() {
    this.compiledRules = new Map(); // rule_id -> CompiledRule
    this.typeIndex = new Map(); // diagram_type -> Set<rule_id>
    this.patternIndex = new Map(); // pattern_hash -> Set<rule_id>
    this.priorityQueues = new Map(); // priority -> Array<rule_id>
    this.cache = new Map(); // cache_key -> MatchResult
    this.statistics = {
      totalMatches: 0,
      cacheHits: 0,
      compilationTime: 0,
      matchingTime: 0,
      applicationsSuccessful: 0,
      applicationsFailed: 0
    };
    
    // Performance optimization settings
    this.enableCaching = true;
    this.cacheMaxSize = 1000;
    this.cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
    this.enableParallelMatching = true;
    this.maxParallelRules = 10;
    
    console.log('RuleMatcher initialized with optimizations enabled');
  }
  
  /**
   * Compile a rule set into optimized internal format
   */
  compileRuleSet(rules) {
    const startTime = performance.now();
    let compiledCount = 0;
    
    // Clear existing indices
    this.compiledRules.clear();
    this.typeIndex.clear();
    this.patternIndex.clear();
    this.priorityQueues.clear();
    
    for (const rule of rules) {
      try {
        const compiled = this._compileRule(rule);
        this.compiledRules.set(rule.id, compiled);
        
        // Build type index
        for (const type of compiled.appliesTo) {
          if (!this.typeIndex.has(type)) {
            this.typeIndex.set(type, new Set());
          }
          this.typeIndex.get(type).add(rule.id);
        }
        
        // Build pattern index
        const patternHash = this._hashPattern(compiled.patterns);
        if (!this.patternIndex.has(patternHash)) {
          this.patternIndex.set(patternHash, new Set());
        }
        this.patternIndex.get(patternHash).add(rule.id);
        
        // Build priority queue
        const priority = compiled.priority;
        if (!this.priorityQueues.has(priority)) {
          this.priorityQueues.set(priority, []);
        }
        this.priorityQueues.get(priority).push(rule.id);
        
        compiledCount++;
      } catch (error) {
        console.warn(`Failed to compile rule ${rule.id}:`, error);
      }
    }
    
    // Sort priority queues
    for (const [_priority, ruleIds] of this.priorityQueues) {
      ruleIds.sort((a, b) => {
        const ruleA = this.compiledRules.get(a);
        const ruleB = this.compiledRules.get(b);
        return (ruleB.confidence || 0.5) - (ruleA.confidence || 0.5);
      });
    }
    
    const endTime = performance.now();
    this.statistics.compilationTime += endTime - startTime;
    
    console.log(`Compiled ${compiledCount} rules in ${(endTime - startTime).toFixed(2)}ms`);
    return compiledCount;
  }
  
  /**
   * Compile individual rule with pattern optimization
   */
  _compileRule(rule) {
    const compiled = {
      id: rule.id,
      appliesTo: rule.applies_to || ['*'],
      priority: rule.priority || 100,
      confidence: rule.confidence || 0.5,
      patterns: [],
      actions: [],
      conditions: [],
      metadata: rule.metadata || {}
    };
    
    // Compile detection patterns
    if (rule.detect) {
      if (rule.detect.regex) {
        compiled.patterns.push({
          type: 'regex',
          pattern: new RegExp(rule.detect.regex, 'gm'),
          source: rule.detect.regex
        });
      }
      if (rule.detect.contains) {
        compiled.patterns.push({
          type: 'contains',
          pattern: rule.detect.contains,
          source: rule.detect.contains
        });
      }
      if (rule.detect.ast_query) {
        compiled.patterns.push({
          type: 'ast',
          pattern: rule.detect.ast_query,
          source: rule.detect.ast_query
        });
      }
    }
    
    // Compile fix actions
    if (rule.fix) {
      if (rule.fix.regex && rule.fix.replace) {
        compiled.actions.push({
          type: 'regex_replace',
          pattern: new RegExp(rule.fix.regex, 'gm'),
          replacement: rule.fix.replace,
          source: rule.fix.regex
        });
      }
      if (rule.fix.function) {
        compiled.actions.push({
          type: 'function',
          handler: rule.fix.function,
          source: 'function'
        });
      }
      if (rule.fix.transform) {
        compiled.actions.push({
          type: 'transform',
          transformer: rule.fix.transform,
          source: 'transform'
        });
      }
    }
    
    // Compile conditions
    if (rule.condition) {
      compiled.conditions.push({
        type: 'custom',
        evaluator: rule.condition,
        source: 'condition'
      });
    }
    
    return compiled;
  }
  
  /**
   * Generate hash for pattern indexing
   */
  _hashPattern(patterns) {
    const sources = patterns.map(p => p.source).sort();
    return btoa(sources.join('|')).substring(0, 16);
  }
  
  /**
   * Fast rule matching with optimized algorithms
   */
  async matchRules(ir, diagramType, options = {}) {
    const startTime = performance.now();
    const cacheKey = this._generateCacheKey(ir, diagramType, options);
    
    // Check cache first
    if (this.enableCaching && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiryMs) {
        this.statistics.cacheHits++;
        return cached.result;
      } else {
        this.cache.delete(cacheKey);
      }
    }
    
    // Get candidate rules based on diagram type
    const candidateRules = this._getCandidateRules(diagramType);
    
    // Parallel or sequential matching
    let matches;
    if (this.enableParallelMatching && candidateRules.length > this.maxParallelRules) {
      matches = await this._parallelMatch(candidateRules, ir, options);
    } else {
      matches = await this._sequentialMatch(candidateRules, ir, options);
    }
    
    // Sort by priority and confidence
    matches.sort((a, b) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
    
    const endTime = performance.now();
    this.statistics.matchingTime += endTime - startTime;
    this.statistics.totalMatches++;
    
    // Cache result
    if (this.enableCaching) {
      this._addToCache(cacheKey, matches);
    }
    
    return matches;
  }
  
  /**
   * Get candidate rules based on diagram type
   */
  _getCandidateRules(diagramType) {
    const candidates = new Set();
    
    // Add rules for specific type
    if (this.typeIndex.has(diagramType)) {
      for (const ruleId of this.typeIndex.get(diagramType)) {
        candidates.add(ruleId);
      }
    }
    
    // Add universal rules
    if (this.typeIndex.has('*')) {
      for (const ruleId of this.typeIndex.get('*')) {
        candidates.add(ruleId);
      }
    }
    
    return Array.from(candidates);
  }
  
  /**
   * Sequential rule matching
   */
  async _sequentialMatch(candidateRules, ir, options) {
    const matches = [];
    
    for (const ruleId of candidateRules) {
      try {
        const rule = this.compiledRules.get(ruleId);
        const match = await this._matchSingleRule(rule, ir, options);
        if (match) {
          matches.push(match);
        }
      } catch (error) {
        console.warn(`Rule matching error for ${ruleId}:`, error);
      }
    }
    
    return matches;
  }
  
  /**
   * Parallel rule matching for better performance
   */
  async _parallelMatch(candidateRules, ir, options) {
    const batchSize = this.maxParallelRules;
    const matches = [];
    
    for (let i = 0; i < candidateRules.length; i += batchSize) {
      const batch = candidateRules.slice(i, i + batchSize);
      const batchPromises = batch.map(async (ruleId) => {
        try {
          const rule = this.compiledRules.get(ruleId);
          return await this._matchSingleRule(rule, ir, options);
        } catch (error) {
          console.warn(`Rule matching error for ${ruleId}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      matches.push(...batchResults.filter(Boolean));
    }
    
    return matches;
  }
  
  /**
   * Match a single rule against IR
   */
  async _matchSingleRule(rule, ir, options) {
    // Check conditions first
    for (const condition of rule.conditions) {
      if (!await this._evaluateCondition(condition, ir, options)) {
        return null;
      }
    }
    
    // Check patterns
    const patternResults = [];
    for (const pattern of rule.patterns) {
      const result = await this._evaluatePattern(pattern, ir, options);
      if (!result.matches) {
        return null; // All patterns must match
      }
      patternResults.push(result);
    }
    
    return {
      ruleId: rule.id,
      priority: rule.priority,
      confidence: rule.confidence,
      actions: rule.actions,
      patternResults,
      metadata: rule.metadata
    };
  }
  
  /**
   * Evaluate pattern against IR
   */
  async _evaluatePattern(pattern, ir) {
    switch (pattern.type) {
      case 'regex':
        return this._evaluateRegexPattern(pattern, ir);
      case 'contains':
        return this._evaluateContainsPattern(pattern, ir);
      case 'ast':
        return this._evaluateAstPattern(pattern, ir);
      default:
        return { matches: false, error: `Unknown pattern type: ${pattern.type}` };
    }
  }
  
  /**
   * Evaluate regex pattern
   */
  _evaluateRegexPattern(pattern, ir) {
    try {
      const text = ir.originalText || ir.toString();
      const matches = Array.from(text.matchAll(pattern.pattern));
      return {
        matches: matches.length > 0,
        matchCount: matches.length,
        matchDetails: matches.map(m => ({
          match: m[0],
          index: m.index,
          groups: m.groups || {}
        }))
      };
    } catch (error) {
      return { matches: false, error: error.message };
    }
  }
  
  /**
   * Evaluate contains pattern
   */
  _evaluateContainsPattern(pattern, ir) {
    try {
      const text = ir.originalText || ir.toString();
      const contains = text.includes(pattern.pattern);
      return {
        matches: contains,
        matchCount: contains ? 1 : 0,
        matchDetails: contains ? [{ match: pattern.pattern }] : []
      };
    } catch (error) {
      return { matches: false, error: error.message };
    }
  }
  
  /**
   * Evaluate AST pattern
   */
  _evaluateAstPattern(pattern, ir) {
    try {
      // Simplified AST query evaluation
      const nodes = ir.findNodesByType(pattern.pattern);
      return {
        matches: nodes.length > 0,
        matchCount: nodes.length,
        matchDetails: nodes.map(node => ({ match: node.id, node }))
      };
    } catch (error) {
      return { matches: false, error: error.message };
    }
  }
  
  /**
   * Evaluate condition
   */
  async _evaluateCondition(condition, ir, options) {
    try {
      if (typeof condition.evaluator === 'function') {
        return await condition.evaluator(ir, options);
      }
      return true;
    } catch (error) {
      console.warn('Condition evaluation error:', error);
      return false;
    }
  }
  
  /**
   * Generate cache key
   */
  _generateCacheKey(ir, diagramType, options) {
    const irHash = ir.hash || 'no-hash';
    const optionsHash = JSON.stringify(options);
    return `${diagramType}:${irHash}:${btoa(optionsHash).substring(0, 8)}`;
  }
  
  /**
   * Add result to cache
   */
  _addToCache(cacheKey, result) {
    // Implement LRU eviction
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get matching statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      cacheHitRate: this.statistics.totalMatches > 0 
        ? (this.statistics.cacheHits / this.statistics.totalMatches) * 100 
        : 0,
      averageMatchingTime: this.statistics.totalMatches > 0
        ? this.statistics.matchingTime / this.statistics.totalMatches
        : 0,
      successRate: (this.statistics.applicationsSuccessful + this.statistics.applicationsFailed) > 0
        ? (this.statistics.applicationsSuccessful / (this.statistics.applicationsSuccessful + this.statistics.applicationsFailed)) * 100
        : 0
    };
  }
  
  /**
   * Clear caches and reset statistics
   */
  clearCaches() {
    this.cache.clear();
    console.log('Rule matcher caches cleared');
  }
  
  resetStatistics() {
    this.statistics = {
      totalMatches: 0,
      cacheHits: 0,
      compilationTime: 0,
      matchingTime: 0,
      applicationsSuccessful: 0,
      applicationsFailed: 0
    };
    console.log('Rule matcher statistics reset');
  }
}

/**
 * Optimized rule applier with efficient application strategies
 */
class RuleApplier {
  constructor(matcher, errorPropagation) {
    this.matcher = matcher;
    this.errorPropagation = errorPropagation || new ErrorPropagationManager();
    this.appliedRules = new Set();
    this.applicationHistory = [];
    this.maxApplications = 100;
    this.allowRuleReapplication = false;
    
    console.log('RuleApplier initialized with optimization features');
  }
  
  /**
   * Apply rules with various optimization strategies
   */
  async applyRules(ir, diagramType, options = {}) {
    const startTime = performance.now();
    let modifications = 0;
    const errors = [];
    
    try {
      // Get matching rules
      const matches = await this.matcher.matchRules(ir, diagramType, options);
      console.log(`Found ${matches.length} matching rules for ${diagramType}`);
      
      // Apply rules in priority order
      for (const match of matches) {
        try {
          // Check if rule already applied (unless reapplication allowed)
          if (!this.allowRuleReapplication && this.appliedRules.has(match.ruleId)) {
            continue;
          }
          
          // Apply rule actions
          const applied = await this._applyRuleActions(ir, match, options);
          if (applied.modified) {
            modifications++;
            this.appliedRules.add(match.ruleId);
            this.applicationHistory.push({
              ruleId: match.ruleId,
              timestamp: Date.now(),
              modifications: applied.modifications,
              confidence: match.confidence
            });
            
            this.matcher.statistics.applicationsSuccessful++;
          }
          
          if (applied.errors) {
            errors.push(...applied.errors);
          }
          
        } catch (error) {
          this.matcher.statistics.applicationsFailed++;
          errors.push({
            type: 'rule_application_error',
            ruleId: match.ruleId,
            message: error.message,
            stack: error.stack
          });
        }
        
        // Prevent infinite applications
        if (modifications >= this.maxApplications) {
          console.warn(`Reached maximum applications limit (${this.maxApplications})`);
          break;
        }
      }
      
    } catch (error) {
      errors.push({
        type: 'rule_matching_error',
        message: error.message,
        stack: error.stack
      });
    }
    
    const endTime = performance.now();
    
    // Propagate any errors
    if (errors.length > 0 && this.errorPropagation) {
      for (const error of errors) {
        this.errorPropagation.propagateError(error, 'rule-application');
      }
    }
    
    return {
      modified: modifications > 0,
      modifications,
      errors,
      appliedRules: Array.from(this.appliedRules),
      processingTimeMs: endTime - startTime,
      rulesMatched: matches?.length || 0
    };
  }
  
  /**
   * Apply actions for a matched rule
   */
  async _applyRuleActions(ir, match, options) {
    let modified = false;
    const modifications = [];
    const errors = [];
    
    for (const action of match.actions) {
      try {
        const result = await this._applyAction(ir, action, match, options);
        if (result.modified) {
          modified = true;
          modifications.push({
            actionType: action.type,
            changes: result.changes,
            confidence: match.confidence
          });
        }
        if (result.errors) {
          errors.push(...result.errors);
        }
      } catch (error) {
        errors.push({
          type: 'action_application_error',
          actionType: action.type,
          ruleId: match.ruleId,
          message: error.message
        });
      }
    }
    
    return { modified, modifications, errors };
  }
  
  /**
   * Apply individual action
   */
  async _applyAction(ir, action, match, options) {
    switch (action.type) {
      case 'regex_replace':
        return this._applyRegexReplace(ir, action);
      case 'function':
        return this._applyFunction(ir, action, match, options);
      case 'transform':
        return this._applyTransform(ir, action, match, options);
      default:
        return {
          modified: false,
          errors: [{
            type: 'unknown_action_type',
            actionType: action.type,
            message: `Unknown action type: ${action.type}`
          }]
        };
    }
  }
  
  /**
   * Apply regex replacement action
   */
  _applyRegexReplace(ir, action) {
    try {
      const originalText = ir.originalText || ir.toString();
      const newText = originalText.replace(action.pattern, action.replacement);
      
      if (newText !== originalText) {
        // Update IR with new text
        ir.updateFromText(newText);
        return {
          modified: true,
          changes: [{
            type: 'text_replacement',
            pattern: action.source,
            replacement: action.replacement
          }]
        };
      }
      
      return { modified: false };
    } catch (error) {
      return {
        modified: false,
        errors: [{
          type: 'regex_replace_error',
          message: error.message
        }]
      };
    }
  }
  
  /**
   * Apply function action
   */
  async _applyFunction(ir, action, match, options) {
    try {
      if (typeof action.handler !== 'function') {
        return {
          modified: false,
          errors: [{
            type: 'invalid_function_handler',
            message: 'Action handler is not a function'
          }]
        };
      }
      
      const result = await action.handler(ir, match, options);
      return {
        modified: result?.modified || false,
        changes: result?.changes || []
      };
    } catch (error) {
      return {
        modified: false,
        errors: [{
          type: 'function_execution_error',
          message: error.message
        }]
      };
    }
  }
  
  /**
   * Apply transform action
   */
  async _applyTransform(ir, action, match, options) {
    try {
      if (typeof action.transformer !== 'function') {
        return {
          modified: false,
          errors: [{
            type: 'invalid_transformer',
            message: 'Action transformer is not a function'
          }]
        };
      }
      
      const result = await action.transformer(ir, match, options);
      return {
        modified: result?.modified || false,
        changes: result?.changes || []
      };
    } catch (error) {
      return {
        modified: false,
        errors: [{
          type: 'transform_execution_error',
          message: error.message
        }]
      };
    }
  }
  
  /**
   * Get application history
   */
  getApplicationHistory() {
    return [...this.applicationHistory];
  }
  
  /**
   * Reset application state
   */
  reset() {
    this.appliedRules.clear();
    this.applicationHistory = [];
    console.log('Rule applier state reset');
  }
}

/**
 * Rule optimization coordinator
 */
class RuleOptimizationCoordinator {
  constructor() {
    this.matcher = new RuleMatcher();
    this.errorPropagation = new ErrorPropagationManager();
    this.applier = new RuleApplier(this.matcher, this.errorPropagation);
    this.ruleRegistry = new Map();
    
    console.log('Rule optimization coordinator initialized');
  }
  
  /**
   * Initialize with rule sets
   */
  async initialize(ruleSets = []) {
    const startTime = performance.now();
    
    // Compile all rule sets
    const allRules = [];
    for (const ruleSet of ruleSets) {
      if (Array.isArray(ruleSet)) {
        allRules.push(...ruleSet);
      } else if (ruleSet.rules) {
        allRules.push(...ruleSet.rules);
      }
    }
    
    // Register rules
    for (const rule of allRules) {
      this.ruleRegistry.set(rule.id, rule);
    }
    
    // Compile for optimization
    const compiled = this.matcher.compileRuleSet(allRules);
    
    const endTime = performance.now();
    console.log(`Rule optimization initialized: ${compiled} rules in ${(endTime - startTime).toFixed(2)}ms`);
    
    return {
      rulesLoaded: compiled,
      initializationTimeMs: endTime - startTime
    };
  }
  
  /**
   * Optimized rule processing pipeline
   */
  async processWithRules(text, diagramType, options = {}) {
    const startTime = performance.now();
    
    try {
      // Convert text to UnifiedIR
      const ir = UnifiedIR.fromText(text, diagramType);
      
      // Apply rules with optimization
      const result = await this.applier.applyRules(ir, diagramType, options);
      
      // Convert back to text
      const processedText = ir.toText();
      
      const endTime = performance.now();
      
      return {
        originalText: text,
        processedText,
        diagramType,
        modified: result.modified,
        modifications: result.modifications,
        errors: result.errors,
        appliedRules: result.appliedRules,
        processingTimeMs: endTime - startTime,
        rulesMatched: result.rulesMatched,
        statistics: this.getStatistics()
      };
      
    } catch (error) {
      const endTime = performance.now();
      
      this.errorPropagation.propagateError({
        type: 'rule_processing_error',
        message: error.message,
        stack: error.stack,
        diagramType,
        processingTimeMs: endTime - startTime
      }, 'rule-optimization');
      
      return {
        originalText: text,
        processedText: text, // Return original on error
        diagramType,
        modified: false,
        errors: [{
          type: 'rule_processing_error',
          message: error.message
        }],
        processingTimeMs: endTime - startTime
      };
    }
  }
  
  /**
   * Batch process multiple diagrams
   */
  async batchProcess(diagrams, options = {}) {
    const startTime = performance.now();
    const results = [];
    const batchSize = options.batchSize || 5;
    
    for (let i = 0; i < diagrams.length; i += batchSize) {
      const batch = diagrams.slice(i, i + batchSize);
      const batchPromises = batch.map(async (diagram) => {
        return await this.processWithRules(
          diagram.text, 
          diagram.type || 'auto',
          { ...options, batchMode: true }
        );
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    const endTime = performance.now();
    
    return {
      results,
      totalProcessed: diagrams.length,
      totalProcessingTimeMs: endTime - startTime,
      statistics: this.getStatistics()
    };
  }
  
  /**
   * Get comprehensive statistics
   */
  getStatistics() {
    const matcherStats = this.matcher.getStatistics();
    
    return {
      matcher: matcherStats,
      applier: {
        rulesRegistered: this.ruleRegistry.size,
        applicationHistory: this.applier.getApplicationHistory().length
      },
      errors: this.errorPropagation.getStatistics()
    };
  }
  
  /**
   * Performance optimization controls
   */
  optimizePerformance(config = {}) {
    // Configure matcher optimizations
    this.matcher.enableCaching = config.enableCaching !== false;
    this.matcher.cacheMaxSize = config.cacheMaxSize || 1000;
    this.matcher.enableParallelMatching = config.enableParallelMatching !== false;
    this.matcher.maxParallelRules = config.maxParallelRules || 10;
    
    // Configure applier optimizations
    this.applier.maxApplications = config.maxApplications || 100;
    this.applier.allowRuleReapplication = config.allowRuleReapplication || false;
    
    console.log('Rule optimization performance configured:', config);
  }
  
  /**
   * Clean up and reset
   */
  cleanup() {
    this.matcher.clearCaches();
    this.matcher.resetStatistics();
    this.applier.reset();
    this.errorPropagation.cleanup();
    console.log('Rule optimization coordinator cleaned up');
  }
}

// Export classes and utilities
export {
  RuleMatcher,
  RuleApplier,
  RuleOptimizationCoordinator
};

// Create and export default instance
export const ruleOptimization = new RuleOptimizationCoordinator();

console.log('Rule optimization system loaded successfully');