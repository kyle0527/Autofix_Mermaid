/**
 * 🔗 多語言解析協調系統
 * 
 * Problem 4: Multi-language parsing coordination
 * 
 * 📋 問題分析：
 * - 多個解析器缺乏協調，可能產生不一致的結果
 * - 解析器選擇策略不夠智能
 * - 缺乏統一的解析結果格式驗證
 * - 解析器間的依賴關係處理不完善
 * 
 * 🎯 解決目標：
 * 1. 建立智能解析器選擇機制
 * 2. 實現解析器協調與同步
 * 3. 統一解析結果格式與驗證
 * 4. 提供解析器負載平衡與故障轉移
 * 5. 建立解析器效能監控與優化
 */

import { 
  createErrorContext, 
  propagateError
} from './error-propagation.js';

import { UnifiedIR } from './unified-ir.js';

/**
 * 📋 解析器資訊介面
 */
export class ParserInfo {
  constructor(options = {}) {
    this.id = options.id || this._generateParserId();
    this.name = options.name || 'Unknown Parser';
    this.version = options.version || '1.0.0';
    this.languages = options.languages || [];
    this.priority = options.priority || 0;
    this.capabilities = options.capabilities || {};
    this.status = 'inactive'; // 'inactive', 'active', 'busy', 'error'
    this.statistics = {
      totalParses: 0,
      successfulParses: 0,
      failedParses: 0,
      averageTime: 0,
      lastUsed: null
    };
    this.config = options.config || {};
    this.parser = options.parser || null;
  }

  /**
   * 🆔 生成解析器 ID
   */
  _generateParserId() {
    return `parser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 📊 更新統計資訊
   */
  updateStatistics(success, duration) {
    this.statistics.totalParses++;
    if (success) {
      this.statistics.successfulParses++;
    } else {
      this.statistics.failedParses++;
    }
    
    // 更新平均時間
    const currentAvg = this.statistics.averageTime;
    const count = this.statistics.totalParses;
    this.statistics.averageTime = ((currentAvg * (count - 1)) + duration) / count;
    
    this.statistics.lastUsed = new Date().toISOString();
  }

  /**
   * 📈 取得成功率
   */
  getSuccessRate() {
    if (this.statistics.totalParses === 0) return 0;
    return (this.statistics.successfulParses / this.statistics.totalParses) * 100;
  }

  /**
   * 🎯 檢查語言支援
   */
  supportsLanguage(language) {
    return this.languages.includes(language) || 
           this.languages.includes('*') || 
           this.capabilities.universal === true;
  }

  /**
   * 🔍 取得解析器資訊
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      languages: [...this.languages],
      priority: this.priority,
      status: this.status,
      capabilities: { ...this.capabilities },
      statistics: { ...this.statistics },
      successRate: this.getSuccessRate()
    };
  }
}

/**
 * 🎯 解析器協調管理器
 */
export class ParserCoordinator {
  constructor() {
    this.parsers = new Map();           // 註冊的解析器
    this.activeJobs = new Map();        // 活躍的解析任務
    this.languageMap = new Map();       // 語言到解析器的映射
    this.loadBalancer = new ParserLoadBalancer();
    this.resultCache = new Map();       // 解析結果快取
    this.config = {
      maxConcurrentParsers: 4,          // 最大並發解析器數
      parserTimeout: 30000,             // 解析器超時 (30秒)
      cacheEnabled: true,               // 啟用結果快取
      cacheExpiry: 300000,              // 快取過期時間 (5分鐘)
      retryAttempts: 2,                 // 重試次數
      fallbackEnabled: true             // 啟用後備解析器
    };
  }

  /**
   * 📝 註冊解析器
   */
  registerParser(parserOptions) {
    const parserInfo = new ParserInfo(parserOptions);
    this.parsers.set(parserInfo.id, parserInfo);
    
    // 建立語言映射
    for (const language of parserInfo.languages) {
      if (!this.languageMap.has(language)) {
        this.languageMap.set(language, []);
      }
      this.languageMap.get(language).push(parserInfo.id);
    }
    
    console.log(`🔧 註冊解析器: ${parserInfo.name} (${parserInfo.languages.join(', ')})`);
    return parserInfo.id;
  }

  /**
   * 📝 註銷解析器
   */
  unregisterParser(parserId) {
    const parser = this.parsers.get(parserId);
    if (!parser) return false;
    
    // 清理語言映射
    for (const language of parser.languages) {
      const parserList = this.languageMap.get(language);
      if (parserList) {
        const index = parserList.indexOf(parserId);
        if (index !== -1) {
          parserList.splice(index, 1);
        }
        if (parserList.length === 0) {
          this.languageMap.delete(language);
        }
      }
    }
    
    this.parsers.delete(parserId);
    console.log(`🗑️ 註銷解析器: ${parser.name}`);
    return true;
  }

  /**
   * 🎯 智能解析器選擇
   */
  selectParser(language, options = {}) {
    const candidates = this.languageMap.get(language) || [];
    
    if (candidates.length === 0) {
      throw propagateError(new Error(`No parser available for language: ${language}`), {
        stage: 'parsing',
        component: 'parser_coordinator',
        operation: 'selectParser',
        language: language
      });
    }
    
    // 過濾可用的解析器
    const availableParsers = candidates
      .map(id => this.parsers.get(id))
      .filter(parser => parser && parser.status !== 'error')
      .filter(parser => this._checkParserCapabilities(parser, options));
    
    if (availableParsers.length === 0) {
      throw propagateError(new Error(`No available parser for language: ${language}`), {
        stage: 'parsing',
        component: 'parser_coordinator',
        operation: 'selectParser',
        language: language
      });
    }
    
    // 使用負載平衡器選擇最佳解析器
    const selectedParser = this.loadBalancer.selectBestParser(availableParsers, options);
    
    console.log(`🎯 選擇解析器: ${selectedParser.name} (${language})`);
    return selectedParser;
  }

  /**
   * 🔍 檢查解析器能力
   */
  _checkParserCapabilities(parser, options) {
    // 檢查 Tree-sitter 需求
    if (options.requireTreeSitter && !parser.capabilities.treeSitter) {
      return false;
    }
    
    // 檢查增量解析需求
    if (options.incremental && !parser.capabilities.incremental) {
      return false;
    }
    
    // 檢查運行時環境
    if (options.runtime && parser.capabilities.runtime) {
      const supportedRuntimes = Array.isArray(parser.capabilities.runtime) 
        ? parser.capabilities.runtime 
        : [parser.capabilities.runtime];
      if (!supportedRuntimes.includes(options.runtime)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 🚀 協調解析
   */
  async coordinatedParse(input, options = {}) {
    const parseId = this._generateParseId();
    const context = createErrorContext({
      operation: 'coordinatedParse',
      stage: 'parsing',
      component: 'parser_coordinator'
    });
    
    try {
      // 檢查快取
      if (this.config.cacheEnabled) {
        const cached = this._getCachedResult(input, options);
        if (cached) {
          console.log(`💾 使用快取結果: ${parseId}`);
          return cached;
        }
      }
      
      // 偵測語言
      const detectionResult = await this._detectLanguage(input, options);
      context.addContext('detectedLanguage', detectionResult.language);
      context.addContext('confidence', detectionResult.confidence);
      
      // 選擇解析器
      const parser = this.selectParser(detectionResult.language, options);
      context.addContext('selectedParser', parser.name);
      
      // 執行解析
      const result = await this._executeParse(parser, input, options, parseId);
      
      // 驗證結果
      const validatedResult = await this._validateParseResult(result, detectionResult.language);
      
      // 快取結果
      if (this.config.cacheEnabled) {
        this._cacheResult(input, options, validatedResult);
      }
      
      console.log(`✅ 解析完成: ${parseId} (${parser.name})`);
      return validatedResult;
      
    } catch (error) {
      const errorContext = propagateError(error, {
        parseId: parseId,
        stage: 'parsing',
        component: 'parser_coordinator',
        operation: 'coordinatedParse'
      });
      
      // 嘗試故障轉移
      if (this.config.fallbackEnabled && options.allowFallback !== false) {
        try {
          console.log(`🔄 嘗試故障轉移: ${parseId}`);
          return await this._attemptFallback(input, options, errorContext);
        } catch (fallbackError) {
          throw propagateError(fallbackError, {
            parentError: errorContext,
            operation: 'fallbackParse'
          });
        }
      }
      
      throw errorContext;
    } finally {
      this.activeJobs.delete(parseId);
    }
  }

  /**
   * 🔍 語言偵測
   */
  async _detectLanguage(input, options) {
    const detectors = [];
    
    // 收集所有解析器的偵測器
    for (const parser of this.parsers.values()) {
      if (parser.parser && typeof parser.parser.detect === 'function') {
        detectors.push({
          parser: parser,
          detector: parser.parser.detect
        });
      }
    }
    
    if (detectors.length === 0) {
      // 使用檔案副檔名偵測
      return this._detectLanguageByExtension(input, options);
    }
    
    // 執行偵測
    const results = [];
    for (const { parser, detector } of detectors) {
      try {
        const result = await detector(input);
        if (result && result.confidence) {
          results.push({
            language: result.lang || result.language,
            confidence: this._normalizeConfidence(result.confidence),
            parser: parser.name,
            details: result
          });
        }
      } catch (error) {
        console.warn(`⚠️ 偵測器失敗 (${parser.name}):`, error.message);
      }
    }
    
    if (results.length === 0) {
      return this._detectLanguageByExtension(input, options);
    }
    
    // 選擇最佳結果
    results.sort((a, b) => b.confidence - a.confidence);
    const best = results[0];
    
    console.log(`🔍 偵測語言: ${best.language} (信心度: ${best.confidence})`);
    return {
      language: best.language,
      confidence: best.confidence,
      method: 'detector',
      details: best
    };
  }

  /**
   * 🎯 副檔名語言偵測
   */
  _detectLanguageByExtension(input, options) {
    // 簡單的副檔名映射
    const extensionMap = {
      '.js': 'javascript',
      '.jsx': 'javascript', 
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c'
    };
    
    if (options.filename) {
      const ext = options.filename.split('.').pop();
      const language = extensionMap[`.${ext}`];
      if (language) {
        return {
          language: language,
          confidence: 0.8,
          method: 'extension',
          extension: ext
        };
      }
    }
    
    // 預設為 JavaScript
    return {
      language: 'javascript',
      confidence: 0.3,
      method: 'default'
    };
  }

  /**
   * 📊 正規化信心度
   */
  _normalizeConfidence(confidence) {
    if (typeof confidence === 'string') {
      const confidenceMap = {
        'low': 0.3,
        'medium': 0.6,
        'high': 0.9
      };
      return confidenceMap[confidence.toLowerCase()] || 0.5;
    }
    
    if (typeof confidence === 'number') {
      return Math.max(0, Math.min(1, confidence));
    }
    
    return 0.5;
  }

  /**
   * ⚡ 執行解析
   */
  async _executeParse(parser, input, options, parseId) {
    const startTime = Date.now();
    parser.status = 'busy';
    this.activeJobs.set(parseId, {
      parserId: parser.id,
      startTime: startTime,
      input: input,
      options: options
    });
    
    try {
      // 設定超時
      const parsePromise = parser.parser.parseProject ? 
        parser.parser.parseProject(input, options) :
        parser.parser.parse(input, options);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Parser timeout after ${this.config.parserTimeout}ms`));
        }, this.config.parserTimeout);
      });
      
      const result = await Promise.race([parsePromise, timeoutPromise]);
      
      // 更新統計
      const duration = Date.now() - startTime;
      parser.updateStatistics(true, duration);
      parser.status = 'active';
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      parser.updateStatistics(false, duration);
      parser.status = 'active';
      
      throw propagateError(error, {
        parserId: parser.id,
        parserName: parser.name,
        parseId: parseId,
        duration: duration
      });
    }
  }

  /**
   * ✅ 驗證解析結果
   */
  async _validateParseResult(result, language) {
    try {
      // 轉換為統一 IR 格式
      const unifiedIR = new UnifiedIR(result);
      
      // 基本結構驗證
      if (!unifiedIR.project || !unifiedIR.project.modules) {
        throw new Error('Invalid parse result: missing project structure');
      }
      
      // 語言特定驗證
      await this._validateLanguageSpecific(unifiedIR, language);
      
      return {
        originalResult: result,
        unifiedIR: unifiedIR,
        language: language,
        validation: {
          status: 'passed',
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      throw propagateError(error, {
        stage: 'validation',
        component: 'parser_coordinator',
        operation: 'validateParseResult',
        language: language
      });
    }
  }

  /**
   * 🎯 語言特定驗證
   */
  async _validateLanguageSpecific(unifiedIR, language) {
    const validators = {
      javascript: (ir) => this._validateJavaScript(ir),
      typescript: (ir) => this._validateTypeScript(ir),
      python: (ir) => this._validatePython(ir),
      java: (ir) => this._validateJava(ir)
    };
    
    const validator = validators[language];
    if (validator) {
      await validator(unifiedIR);
    }
  }

  /**
   * 🔧 JavaScript 驗證
   */
  _validateJavaScript(ir) {
    // 檢查 JavaScript 特定結構
    for (const module of ir.project.modules) {
      if (module.functions) {
        for (const func of module.functions) {
          if (!func.name || typeof func.name !== 'string') {
            throw new Error(`Invalid JavaScript function: ${JSON.stringify(func)}`);
          }
        }
      }
    }
  }

  /**
   * 🔧 TypeScript 驗證
   */
  _validateTypeScript(ir) {
    // TypeScript 特定驗證邏輯
    this._validateJavaScript(ir); // 繼承 JavaScript 驗證
    
    // 額外的 TypeScript 驗證
    for (const module of ir.project.modules) {
      if (module.interfaces) {
        for (const interfaceItem of module.interfaces) {
          if (!interfaceItem.name) {
            throw new Error(`Invalid TypeScript interface: ${JSON.stringify(interfaceItem)}`);
          }
        }
      }
    }
  }

  /**
   * 🐍 Python 驗證
   */
  _validatePython(ir) {
    // Python 特定驗證邏輯
    for (const module of ir.project.modules) {
      if (module.classes) {
        for (const cls of module.classes) {
          if (!cls.name || typeof cls.name !== 'string') {
            throw new Error(`Invalid Python class: ${JSON.stringify(cls)}`);
          }
        }
      }
    }
  }

  /**
   * ☕ Java 驗證
   */
  _validateJava(ir) {
    // Java 特定驗證邏輯
    for (const module of ir.project.modules) {
      if (module.classes) {
        for (const cls of module.classes) {
          if (!cls.name || !cls.package) {
            throw new Error(`Invalid Java class: ${JSON.stringify(cls)}`);
          }
        }
      }
    }
  }

  /**
   * 🔄 故障轉移
   */
  async _attemptFallback(input, options) {
    console.log('🚨 執行故障轉移策略');
    
    // 尋找後備解析器
    const fallbackParsers = Array.from(this.parsers.values())
      .filter(p => p.capabilities.fallback === true)
      .sort((a, b) => b.priority - a.priority);
    
    for (const parser of fallbackParsers) {
      try {
        console.log(`🔄 嘗試後備解析器: ${parser.name}`);
        const result = await this._executeParse(parser, input, {
          ...options,
          fallback: true
        }, this._generateParseId());
        
        return await this._validateParseResult(result, 'unknown');
        
      } catch (error) {
        console.warn(`⚠️ 後備解析器失敗 (${parser.name}):`, error.message);
      }
    }
    
    throw new Error('All fallback parsers failed');
  }

  /**
   * 💾 快取管理
   */
  _getCachedResult(input, options) {
    const cacheKey = this._generateCacheKey(input, options);
    const cached = this.resultCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
      return cached.result;
    }
    
    return null;
  }

  _cacheResult(input, options, result) {
    const cacheKey = this._generateCacheKey(input, options);
    this.resultCache.set(cacheKey, {
      result: result,
      timestamp: Date.now()
    });
    
    // 清理過期快取
    this._cleanupCache();
  }

  _generateCacheKey(input, options) {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    const optionsStr = JSON.stringify(options || {});
    return `${this._hash(inputStr)}_${this._hash(optionsStr)}`;
  }

  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 轉為 32位元整數
    }
    return Math.abs(hash).toString(36);
  }

  _cleanupCache() {
    const now = Date.now();
    for (const [key, cached] of this.resultCache) {
      if (now - cached.timestamp > this.config.cacheExpiry) {
        this.resultCache.delete(key);
      }
    }
  }

  /**
   * 🆔 生成解析 ID
   */
  _generateParseId() {
    return `parse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 📊 取得統計資料
   */
  getStatistics() {
    const stats = {
      totalParsers: this.parsers.size,
      activeParsers: 0,
      busyParsers: 0,
      errorParsers: 0,
      activeJobs: this.activeJobs.size,
      cacheSize: this.resultCache.size,
      supportedLanguages: Array.from(this.languageMap.keys()),
      parserDetails: []
    };
    
    for (const parser of this.parsers.values()) {
      switch (parser.status) {
        case 'active':
          stats.activeParsers++;
          break;
        case 'busy':
          stats.busyParsers++;
          break;
        case 'error':
          stats.errorParsers++;
          break;
      }
      
      stats.parserDetails.push(parser.getInfo());
    }
    
    return stats;
  }
}

/**
 * ⚖️ 解析器負載平衡器
 */
export class ParserLoadBalancer {
  constructor() {
    this.strategy = 'weighted'; // 'round-robin', 'least-busy', 'weighted', 'performance'
  }

  /**
   * 🎯 選擇最佳解析器
   */
  selectBestParser(parsers) {
    switch (this.strategy) {
      case 'round-robin':
        return this._roundRobinSelection(parsers);
      case 'least-busy':
        return this._leastBusySelection(parsers);
      case 'weighted':
        return this._weightedSelection(parsers);
      case 'performance':
        return this._performanceBasedSelection(parsers);
      default:
        return this._weightedSelection(parsers);
    }
  }

  /**
   * 🔄 輪循選擇
   */
  _roundRobinSelection(parsers) {
    if (!this.roundRobinIndex) {
      this.roundRobinIndex = 0;
    }
    
    const selected = parsers[this.roundRobinIndex % parsers.length];
    this.roundRobinIndex++;
    
    return selected;
  }

  /**
   * 📊 最少忙碌選擇
   */
  _leastBusySelection(parsers) {
    return parsers.reduce((best, current) => {
      if (current.status === 'active' && best.status === 'busy') {
        return current;
      }
      if (current.status === best.status) {
        return current.statistics.totalParses < best.statistics.totalParses ? current : best;
      }
      return best;
    });
  }

  /**
   * ⚖️ 加權選擇
   */
  _weightedSelection(parsers) {
    // 計算權重分數
    const scored = parsers.map(parser => ({
      parser: parser,
      score: this._calculateParserScore(parser)
    }));
    
    // 依分數排序
    scored.sort((a, b) => b.score - a.score);
    
    return scored[0].parser;
  }

  /**
   * 🚀 效能導向選擇
   */
  _performanceBasedSelection(parsers) {
    return parsers.reduce((best, current) => {
      const bestPerf = this._calculatePerformanceScore(best);
      const currentPerf = this._calculatePerformanceScore(current);
      
      return currentPerf > bestPerf ? current : best;
    });
  }

  /**
   * 📊 計算解析器分數
   */
  _calculateParserScore(parser) {
    let score = 0;
    
    // 基礎優先級分數
    score += parser.priority * 10;
    
    // 成功率分數
    score += parser.getSuccessRate() * 2;
    
    // 狀態分數
    switch (parser.status) {
      case 'active':
        score += 20;
        break;
      case 'inactive':
        score += 10;
        break;
      case 'busy':
        score -= 10;
        break;
      case 'error':
        score -= 50;
        break;
    }
    
    // 平均時間分數 (越快越好)
    if (parser.statistics.averageTime > 0) {
      score += Math.max(0, 100 - parser.statistics.averageTime / 100);
    }
    
    return Math.max(0, score);
  }

  /**
   * 🎯 計算效能分數
   */
  _calculatePerformanceScore(parser) {
    const successRate = parser.getSuccessRate() / 100;
    const avgTime = parser.statistics.averageTime || 1000; // 預設 1 秒
    const timeScore = Math.max(0, 1 - (avgTime / 10000)); // 10 秒為基準
    
    return (successRate * 0.7) + (timeScore * 0.3);
  }
}

/**
 * 🏭 全域解析器協調器實例
 */
export const globalParserCoordinator = new ParserCoordinator();

/**
 * 🔗 便利函數：註冊解析器
 */
export function registerParser(parserOptions) {
  return globalParserCoordinator.registerParser(parserOptions);
}

/**
 * 🔗 便利函數：協調解析
 */
export function coordinatedParse(input, options = {}) {
  return globalParserCoordinator.coordinatedParse(input, options);
}

/**
 * 📊 便利函數：取得統計資料
 */
export function getParsingStatistics() {
  return globalParserCoordinator.getStatistics();
}

// 瀏覽器環境全域暴露
if (typeof window !== 'undefined') {
  window.ParserInfo = ParserInfo;
  window.ParserCoordinator = ParserCoordinator;
  window.ParserLoadBalancer = ParserLoadBalancer;
  window.globalParserCoordinator = globalParserCoordinator;
  window.registerParser = registerParser;
  window.coordinatedParse = coordinatedParse;
  window.getParsingStatistics = getParsingStatistics;
}