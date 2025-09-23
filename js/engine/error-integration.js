/**
 * 🔗 錯誤處理系統整合
 * 
 * 將新的錯誤上下文傳播系統與現有的 errorPolicy.js 整合
 * 提供向後相容性並增強錯誤處理能力
 */

import { 
  ErrorContext, 
  globalErrorManager,
  createErrorContext
} from './error-propagation.js';

/**
 * 🔄 錯誤轉換器 - 將舊格式轉換為新格式
 */
export class ErrorConverter {
  /**
   * 🔄 將 ErrorCat 格式轉換為 ErrorContext
   */
  static fromErrorCat(errorCat, additionalContext = {}) {
    // 從 ErrorCat 碼解析錯誤資訊
    const errorInfo = this._parseErrorCat(errorCat);
    
    return new ErrorContext({
      message: errorInfo.message,
      code: errorCat,
      severity: errorInfo.severity,
      stage: errorInfo.stage,
      component: errorInfo.component,
      ...additionalContext
    });
  }

  /**
   * 🔄 將 ErrorContext 轉換為 ErrorCat 格式（向後相容）
   */
  static toErrorCat(errorContext) {
    return {
      errorCat: errorContext.code,
      message: errorContext.message,
      severity: errorContext.severity,
      source: errorContext.source,
      timestamp: errorContext.timestamp
    };
  }

  /**
   * 🔍 解析 ErrorCat 代碼
   */
  static _parseErrorCat(errorCat) {
    const errorMappings = {
      // 解析錯誤 (E10x)
      E101: { message: 'Syntax error in diagram', severity: 'error', stage: 'parsing', component: 'parser' },
      E102: { message: 'Invalid diagram type', severity: 'error', stage: 'parsing', component: 'parser' },
      E103: { message: 'Malformed node definition', severity: 'error', stage: 'parsing', component: 'node_parser' },
      
      // 分析錯誤 (E20x)
      E201: { message: 'Semantic analysis failed', severity: 'error', stage: 'analysis', component: 'analyzer' },
      E202: { message: 'Type checking failed', severity: 'error', stage: 'analysis', component: 'type_checker' },
      
      // 生成錯誤 (E30x)
      E301: { message: 'Code generation failed', severity: 'error', stage: 'generation', component: 'generator' },
      E302: { message: 'Template processing failed', severity: 'error', stage: 'generation', component: 'template_engine' },
      
      // 系統錯誤 (E80x)
      E801: { message: 'Internal system error', severity: 'error', stage: 'system', component: 'core' },
      E802: { message: 'Resource allocation failed', severity: 'error', stage: 'system', component: 'resource_manager' }
    };

    return errorMappings[errorCat] || {
      message: `Unknown error: ${errorCat}`,
      severity: 'error',
      stage: 'unknown',
      component: 'unknown'
    };
  }
}

/**
 * 🔧 增強版錯誤政策
 */
export class EnhancedErrorPolicy {
  constructor() {
    this.manager = globalErrorManager;
    this.legacyMode = false; // 是否使用舊版相容模式
    
    // 設定錯誤處理器
    this._setupErrorHandlers();
    
    // 設定錯誤攔截器
    this._setupErrorInterceptors();
  }

  /**
   * 🎯 處理錯誤（統一入口點）
   */
  async handleError(error, context = {}) {
    let errorContext;
    
    // 判斷錯誤類型並轉換
    if (error instanceof ErrorContext) {
      errorContext = error;
    } else if (typeof error === 'string' && error.startsWith('E')) {
      // 假設是 ErrorCat 格式
      errorContext = ErrorConverter.fromErrorCat(error, context);
    } else if (error instanceof Error) {
      // JavaScript 原生錯誤
      errorContext = createErrorContext({
        message: error.message,
        code: error.name || 'JS_ERROR',
        stack: error.stack,
        ...context
      });
    } else {
      // 其他格式
      errorContext = createErrorContext({
        message: String(error),
        code: 'UNKNOWN_ERROR',
        ...context
      });
    }
    
    // 傳播錯誤並處理
    const propagatedContext = this.manager.propagateError(errorContext);
    
    // 根據嚴重程度決定處理策略
    return await this._executeErrorStrategy(propagatedContext);
  }

  /**
   * 🔧 建立錯誤鏈
   */
  createErrorChain(newError, parentError) {
    return this.manager.chainError(newError, parentError);
  }

  /**
   * 📊 取得錯誤統計
   */
  getErrorStatistics() {
    return this.manager.getStatistics();
  }

  /**
   * 🔍 查找錯誤
   */
  findError(errorId) {
    return this.manager.findContext(errorId);
  }

  /**
   * ⚙️ 設定錯誤處理器
   */
  _setupErrorHandlers() {
    // 解析錯誤處理器
    this.manager.registerHandler('E101', this._handleParseError.bind(this));
    this.manager.registerHandler('E102', this._handleParseError.bind(this));
    this.manager.registerHandler('E103', this._handleParseError.bind(this));
    
    // 分析錯誤處理器
    this.manager.registerHandler('E201', this._handleAnalysisError.bind(this));
    this.manager.registerHandler('E202', this._handleAnalysisError.bind(this));
    
    // 生成錯誤處理器
    this.manager.registerHandler('E301', this._handleGenerationError.bind(this));
    this.manager.registerHandler('E302', this._handleGenerationError.bind(this));
    
    // 系統錯誤處理器
    this.manager.registerHandler('E801', this._handleSystemError.bind(this));
    this.manager.registerHandler('E802', this._handleSystemError.bind(this));
  }

  /**
   * 🛡️ 設定錯誤攔截器
   */
  _setupErrorInterceptors() {
    // 錯誤日誌攔截器
    this.manager.registerInterceptor((context) => {
      this._logError(context);
      return true; // 繼續傳播
    });
    
    // 重複錯誤過濾攔截器
    this.manager.registerInterceptor((context) => {
      return this._filterDuplicateErrors(context);
    });
    
    // 錯誤豐富化攔截器
    this.manager.registerInterceptor((context) => {
      this._enrichErrorContext(context);
      return true;
    });
  }

  /**
   * 🎯 執行錯誤處理策略
   */
  async _executeErrorStrategy(errorContext) {
    const strategies = {
      error: () => this._handleCriticalError(errorContext),
      warning: () => this._handleWarning(errorContext),
      info: () => this._handleInfo(errorContext)
    };
    
    const strategy = strategies[errorContext.severity] || strategies.error;
    return await strategy();
  }

  /**
   * 🔥 處理關鍵錯誤
   */
  async _handleCriticalError(errorContext) {
    // 嘗試恢復
    if (errorContext.recovery.attempted && !errorContext.recovery.successful) {
      // 恢復失敗，使用後備方案
      return this._useFallbackStrategy(errorContext);
    }
    
    // 記錄錯誤並拋出
    console.error('🔥 Critical Error:', errorContext.toString());
    throw errorContext;
  }

  /**
   * ⚠️ 處理警告
   */
  async _handleWarning(errorContext) {
    console.warn('⚠️ Warning:', errorContext.message);
    return { 
      handled: true, 
      severity: 'warning', 
      context: errorContext 
    };
  }

  /**
   * ℹ️ 處理資訊
   */
  async _handleInfo(errorContext) {
    console.info('ℹ️ Info:', errorContext.message);
    return { 
      handled: true, 
      severity: 'info', 
      context: errorContext 
    };
  }

  /**
   * 🔧 使用後備策略
   */
  _useFallbackStrategy(errorContext) {
    const fallbackStrategies = {
      'parsing': () => ({ result: null, message: 'Parse failed, using basic parser' }),
      'analysis': () => ({ result: {}, message: 'Analysis failed, using default values' }),
      'generation': () => ({ result: '', message: 'Generation failed, using empty output' })
    };
    
    const strategy = fallbackStrategies[errorContext.source.stage];
    if (strategy) {
      const result = strategy();
      errorContext.addSuggestion(`Used fallback strategy: ${result.message}`);
      return result;
    }
    
    return { result: null, message: 'No fallback strategy available' };
  }

  /**
   * 🔍 解析錯誤處理器
   */
  _handleParseError(errorContext) {
    errorContext.addSuggestion('Check diagram syntax');
    errorContext.addSuggestion('Verify node and edge definitions');
    
    // 嘗試使用容錯解析器
    if (!errorContext.recovery.attempted) {
      errorContext.addContext('fallback_parser', 'tolerant_parser');
    }
  }

  /**
   * 📊 分析錯誤處理器
   */
  _handleAnalysisError(errorContext) {
    errorContext.addSuggestion('Check data types and relationships');
    errorContext.addSuggestion('Verify semantic consistency');
  }

  /**
   * 🔧 生成錯誤處理器
   */
  _handleGenerationError(errorContext) {
    errorContext.addSuggestion('Check template configuration');
    errorContext.addSuggestion('Verify output format settings');
  }

  /**
   * 🛠️ 系統錯誤處理器
   */
  _handleSystemError(errorContext) {
    errorContext.addSuggestion('Check system resources');
    errorContext.addSuggestion('Restart the application if problem persists');
  }

  /**
   * 📝 記錄錯誤
   */
  _logError(errorContext) {
    const logLevel = this._getLogLevel(errorContext.severity);
    const logMessage = `[${errorContext.code}] ${errorContext.message}`;
    
    console[logLevel](logMessage, {
      id: errorContext.id,
      timestamp: errorContext.timestamp,
      source: errorContext.source,
      context: errorContext.context
    });
  }

  /**
   * 🚫 過濾重複錯誤
   */
  _filterDuplicateErrors(errorContext) {
    const recentErrors = this.manager.errorHistory.slice(-10);
    const duplicate = recentErrors.find(e => 
      e.code === errorContext.code &&
      e.message === errorContext.message &&
      (Date.now() - new Date(e.timestamp).getTime()) < 1000 // 1秒內
    );
    
    if (duplicate) {
      console.log(`🚫 Filtered duplicate error: ${errorContext.code}`);
      return false; // 停止傳播
    }
    
    return true; // 繼續傳播
  }

  /**
   * 🎨 豐富錯誤上下文
   */
  _enrichErrorContext(errorContext) {
    // 添加環境資訊
    errorContext.addContext('browser', navigator?.userAgent || 'unknown');
    errorContext.addContext('timestamp', new Date().toISOString());
    errorContext.addContext('url', window?.location?.href || 'unknown');
    
    // 添加系統狀態
    errorContext.addContext('memoryUsage', this._getMemoryUsage());
    errorContext.addContext('performance', this._getPerformanceInfo());
  }

  /**
   * 📊 取得記憶體使用情況
   */
  _getMemoryUsage() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    return 'unavailable';
  }

  /**
   * 🚀 取得效能資訊
   */
  _getPerformanceInfo() {
    return {
      now: performance.now(),
      timing: performance.timing ? {
        loadEventEnd: performance.timing.loadEventEnd,
        navigationStart: performance.timing.navigationStart
      } : 'unavailable'
    };
  }

  /**
   * 📊 取得日誌級別
   */
  _getLogLevel(severity) {
    const levels = {
      error: 'error',
      warning: 'warn',
      info: 'info'
    };
    return levels[severity] || 'log';
  }
}

/**
 * 🏭 全域增強錯誤政策實例
 */
export const enhancedErrorPolicy = new EnhancedErrorPolicy();

/**
 * 🔄 向後相容性函數
 */
export function toErrorInfo(error, context = {}) {
  return enhancedErrorPolicy.handleError(error, context);
}

/**
 * 🔗 便利函數：處理錯誤
 */
export function handleError(error, context = {}) {
  return enhancedErrorPolicy.handleError(error, context);
}

/**
 * 🔗 便利函數：建立錯誤鏈
 */
export function createErrorChain(newError, parentError, context = {}) {
  return enhancedErrorPolicy.createErrorChain(newError, parentError, context);
}

/**
 * 📊 便利函數：取得錯誤統計
 */
export function getErrorStatistics() {
  return enhancedErrorPolicy.getErrorStatistics();
}

// 瀏覽器環境全域暴露
if (typeof window !== 'undefined') {
  window.ErrorConverter = ErrorConverter;
  window.EnhancedErrorPolicy = EnhancedErrorPolicy;
  window.enhancedErrorPolicy = enhancedErrorPolicy;
  window.handleError = handleError;
  window.createErrorChain = createErrorChain;
  window.getErrorStatistics = getErrorStatistics;
  window.toErrorInfo = toErrorInfo;
}