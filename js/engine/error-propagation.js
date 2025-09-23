/**
 * 🔗 錯誤上下文傳播系統
 * 
 * Problem 3: Error context propagation
 * 
 * 📋 問題分析：
 * - 錯誤資訊在處理鏈中遺失，難以進行精確的錯誤定位與修復
 * - 缺乏統一的錯誤上下文資料結構
 * - 錯誤追蹤機制不完整，無法追溯錯誤來源
 * - 錯誤恢復策略不夠智能
 * 
 * 🎯 解決目標：
 * 1. 建立完整的錯誤上下文資料結構
 * 2. 實現錯誤鏈式傳播機制  
 * 3. 提供精確的錯誤定位功能
 * 4. 建立智能錯誤恢復策略
 * 5. 統一錯誤報告與診斷介面
 */

/**
 * 📋 錯誤上下文資料結構
 */
export class ErrorContext {
  constructor(options = {}) {
    // 基本錯誤資訊
    this.id = options.id || this._generateErrorId();
    this.timestamp = options.timestamp || new Date().toISOString();
    this.message = options.message || 'Unknown error';
    this.code = options.code || 'UNKNOWN_ERROR';
    this.severity = options.severity || 'error'; // 'error', 'warning', 'info'
    
    // 來源資訊
    this.source = {
      stage: options.stage || 'unknown',      // 'parsing', 'analysis', 'generation', etc.
      component: options.component || null,   // 具體組件名稱
      function: options.function || null,     // 函數名稱
      file: options.file || null,             // 原始檔案
      line: options.line || null,             // 行號
      column: options.column || null          // 列號
    };
    
    // 上下文資訊
    this.context = {
      operation: options.operation || null,   // 正在執行的操作
      input: options.input || null,           // 輸入資料
      state: options.state || null,           // 系統狀態
      dependencies: options.dependencies || [],// 依賴項目
      configuration: options.config || null   // 相關配置
    };
    
    // 錯誤鏈
    this.chain = {
      parent: options.parentError || null,    // 父錯誤
      children: options.children || [],       // 子錯誤
      root: options.rootError || this,        // 根錯誤
      depth: options.depth || 0               // 錯誤深度
    };
    
    // 診斷資訊
    this.diagnostics = {
      stack: options.stack || null,           // 錯誤堆疊
      suggestions: options.suggestions || [], // 修復建議
      relatedErrors: options.related || [],   // 相關錯誤
      metadata: options.metadata || {}        // 額外元資料
    };
    
    // 恢復資訊
    this.recovery = {
      attempted: false,                       // 是否嘗試恢復
      successful: false,                      // 恢復是否成功
      strategy: null,                         // 使用的恢復策略
      fallbackUsed: null,                     // 使用的後備方案
      retries: 0                             // 重試次數
    };
  }

  /**
   * 🆔 生成唯一錯誤 ID
   */
  _generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 🔗 建立錯誤鏈關係
   */
  chainWith(parentError) {
    if (parentError instanceof ErrorContext) {
      this.chain.parent = parentError;
      this.chain.root = parentError.chain.root;
      this.chain.depth = parentError.chain.depth + 1;
      
      // 將自己加入父錯誤的子錯誤列表
      parentError.chain.children.push(this);
    }
    return this;
  }

  /**
   * 📍 設定錯誤位置
   */
  setLocation(file, line, column) {
    this.source.file = file;
    this.source.line = line;
    this.source.column = column;
    return this;
  }

  /**
   * 🎯 設定錯誤來源
   */
  setSource(stage, component, functionName) {
    this.source.stage = stage;
    this.source.component = component;
    this.source.function = functionName;
    return this;
  }

  /**
   * 📝 添加上下文資訊
   */
  addContext(key, value) {
    this.context[key] = value;
    return this;
  }

  /**
   * 💡 添加修復建議
   */
  addSuggestion(suggestion) {
    this.diagnostics.suggestions.push(suggestion);
    return this;
  }

  /**
   * 🔧 記錄恢復嘗試
   */
  recordRecoveryAttempt(strategy, successful = false, fallback = null) {
    this.recovery.attempted = true;
    this.recovery.successful = successful;
    this.recovery.strategy = strategy;
    this.recovery.fallbackUsed = fallback;
    this.recovery.retries++;
    return this;
  }

  /**
   * 📊 取得完整錯誤報告
   */
  getReport() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      message: this.message,
      code: this.code,
      severity: this.severity,
      source: { ...this.source },
      context: { ...this.context },
      chain: {
        hasParent: !!this.chain.parent,
        hasChildren: this.chain.children.length > 0,
        depth: this.chain.depth,
        rootId: this.chain.root?.id
      },
      diagnostics: {
        hasStack: !!this.diagnostics.stack,
        suggestions: [...this.diagnostics.suggestions],
        relatedCount: this.diagnostics.relatedErrors.length,
        metadata: { ...this.diagnostics.metadata }
      },
      recovery: { ...this.recovery }
    };
  }

  /**
   * 🌳 取得錯誤鏈樹
   */
  getErrorTree() {
    const buildTree = (error) => ({
      id: error.id,
      message: error.message,
      code: error.code,
      severity: error.severity,
      source: error.source,
      children: error.chain.children.map(buildTree)
    });

    return buildTree(this.chain.root);
  }

  /**
   * 📋 轉換為 JSON
   */
  toJSON() {
    return this.getReport();
  }

  /**
   * 📄 轉換為可讀字串
   */
  toString() {
    let result = `[${this.severity.toUpperCase()}] ${this.code}: ${this.message}`;
    
    if (this.source.file) {
      result += `\n  at ${this.source.file}`;
      if (this.source.line) {
        result += `:${this.source.line}`;
        if (this.source.column) {
          result += `:${this.source.column}`;
        }
      }
    }
    
    if (this.source.component) {
      result += `\n  in ${this.source.component}`;
      if (this.source.function) {
        result += `.${this.source.function}()`;
      }
    }
    
    if (this.diagnostics.suggestions.length > 0) {
      result += `\n  💡 Suggestions:`;
      this.diagnostics.suggestions.forEach(s => {
        result += `\n    - ${s}`;
      });
    }
    
    return result;
  }
}

/**
 * 🔗 錯誤傳播管理器
 */
export class ErrorPropagationManager {
  constructor() {
    this.activeContexts = new Map();     // 活躍的錯誤上下文
    this.errorHistory = [];              // 錯誤歷史記錄
    this.handlers = new Map();           // 錯誤處理器
    this.interceptors = [];              // 錯誤攔截器
    this.listeners = [];                 // 事件監聽器
    this.config = {
      maxHistorySize: 1000,              // 最大歷史記錄數
      enableAutoRecovery: true,          // 啟用自動恢復
      enableErrorChaining: true,         // 啟用錯誤鏈
      logLevel: 'error'                  // 日誌級別
    };
  }

  /**
   * 📝 建立新的錯誤上下文
   */
  createContext(options = {}) {
    const context = new ErrorContext(options);
    this.activeContexts.set(context.id, context);
    return context;
  }

  /**
   * 🔗 傳播錯誤
   */
  propagateError(error, options = {}) {
    let context;
    
    if (error instanceof ErrorContext) {
      context = error;
    } else {
      // 從 JavaScript Error 建立錯誤上下文
      context = this.createContext({
        message: error.message || String(error),
        code: error.code || 'JS_ERROR',
        stack: error.stack,
        ...options
      });
    }
    
    // 執行攔截器
    for (const interceptor of this.interceptors) {
      try {
        const result = interceptor(context);
        if (result === false) {
          // 攔截器返回 false 表示停止傳播
          return context;
        }
      } catch (interceptorError) {
        console.warn('Error interceptor failed:', interceptorError);
      }
    }
    
    // 記錄到歷史
    this._recordError(context);
    
    // 嘗試恢復
    if (this.config.enableAutoRecovery) {
      this._attemptRecovery(context);
    }
    
    // 觸發處理器
    this._triggerHandlers(context);
    
    // 觸發事件監聽器
    this._emit('error', context);
    
    return context;
  }

  /**
   * 🔗 建立錯誤鏈
   */
  chainError(newError, parentError) {
    if (!this.config.enableErrorChaining) {
      return this.propagateError(newError);
    }
    
    const parentContext = parentError instanceof ErrorContext 
      ? parentError 
      : this.activeContexts.get(parentError);
      
    if (parentContext) {
      const newContext = this.createContext({
        ...newError,
        parentError: parentContext
      });
      newContext.chainWith(parentContext);
      return this.propagateError(newContext);
    }
    
    return this.propagateError(newError);
  }

  /**
   * 📋 註冊錯誤處理器
   */
  registerHandler(errorCode, handler) {
    if (!this.handlers.has(errorCode)) {
      this.handlers.set(errorCode, []);
    }
    this.handlers.get(errorCode).push(handler);
  }

  /**
   * 🛡️ 註冊錯誤攔截器
   */
  registerInterceptor(interceptor) {
    if (typeof interceptor === 'function') {
      this.interceptors.push(interceptor);
    }
  }

  /**
   * � 添加事件監聽器
   */
  addListener(eventType, listener) {
    if (typeof listener === 'function') {
      this.listeners.push({ eventType, listener });
    }
  }

  /**
   * 📢 觸發事件
   */
  _emit(eventType, data) {
    this.listeners.forEach(({ eventType: type, listener }) => {
      if (type === eventType || type === '*') {
        try {
          listener(data);
        } catch (error) {
          console.warn('Event listener error:', error);
        }
      }
    });
  }

  /**
   * �🔍 查找錯誤上下文
   */
  findContext(errorId) {
    return this.activeContexts.get(errorId) || 
           this.errorHistory.find(e => e.id === errorId);
  }

  /**
   * 📊 取得錯誤統計
   */
  getStatistics() {
    const stats = {
      active: this.activeContexts.size,
      total: this.errorHistory.length,
      byCode: {},
      bySeverity: {},
      byStage: {},
      recoveryRate: 0
    };
    
    let recoveryAttempts = 0;
    let successfulRecoveries = 0;
    
    for (const error of this.errorHistory) {
      // 按錯誤代碼統計
      stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1;
      
      // 按嚴重程度統計
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // 按階段統計
      stats.byStage[error.source.stage] = (stats.byStage[error.source.stage] || 0) + 1;
      
      // 恢復統計
      if (error.recovery.attempted) {
        recoveryAttempts++;
        if (error.recovery.successful) {
          successfulRecoveries++;
        }
      }
    }
    
    stats.recoveryRate = recoveryAttempts > 0 
      ? Math.round((successfulRecoveries / recoveryAttempts) * 100) 
      : 0;
    
    return stats;
  }

  /**
   * 📝 記錄錯誤到歷史
   */
  _recordError(context) {
    this.errorHistory.push(context);
    
    // 清理過舊的記錄
    if (this.errorHistory.length > this.config.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * 🔧 嘗試錯誤恢復
   */
  _attemptRecovery(context) {
    const recoveryStrategies = [
      () => this._tryFallbackStrategy(context),
      () => this._tryRetryStrategy(context),
      () => this._tryDegradedModeStrategy(context)
    ];
    
    for (const strategy of recoveryStrategies) {
      try {
        const result = strategy();
        if (result) {
          context.recordRecoveryAttempt(strategy.name, true, result);
          return true;
        }
      } catch (recoveryError) {
        console.warn(`Recovery strategy ${strategy.name} failed:`, recoveryError);
      }
    }
    
    context.recordRecoveryAttempt('all_strategies', false);
    return false;
  }

  /**
   * 🔄 後備策略
   */
  _tryFallbackStrategy(context) {
    // 根據錯誤類型選擇後備方案
    switch (context.code) {
      case 'PARSE_ERROR':
        return 'fallback_parser';
      case 'ANALYSIS_ERROR':
        return 'basic_analysis';
      case 'GENERATION_ERROR':
        return 'simple_output';
      default:
        return null;
    }
  }

  /**
   * 🔁 重試策略
   */
  _tryRetryStrategy(context) {
    if (context.recovery.retries < 3) {
      return 'retry_operation';
    }
    return null;
  }

  /**
   * 📉 降級模式策略
   */
  _tryDegradedModeStrategy() {
    return 'degraded_mode';
  }

  /**
   * 🎯 觸發錯誤處理器
   */
  _triggerHandlers(context) {
    const handlers = this.handlers.get(context.code) || [];
    
    for (const handler of handlers) {
      try {
        handler(context);
      } catch (handlerError) {
        console.warn(`Error handler failed for ${context.code}:`, handlerError);
      }
    }
  }

  /**
   * 🧹 清理過期的錯誤上下文
   */
  cleanup() {
    const now = Date.now();
    const expiredIds = [];
    
    for (const [id, context] of this.activeContexts) {
      const age = now - new Date(context.timestamp).getTime();
      if (age > 300000) { // 5 分鐘
        expiredIds.push(id);
      }
    }
    
    for (const id of expiredIds) {
      this.activeContexts.delete(id);
    }
  }
}

/**
 * 🏭 全域錯誤管理器實例
 */
export const globalErrorManager = new ErrorPropagationManager();

/**
 * 🔗 便利函數：建立錯誤上下文
 */
export function createErrorContext(options = {}) {
  return globalErrorManager.createContext(options);
}

/**
 * 🔗 便利函數：傳播錯誤
 */
export function propagateError(error, options = {}) {
  return globalErrorManager.propagateError(error, options);
}

/**
 * 🔗 便利函數：建立錯誤鏈
 */
export function chainError(newError, parentError) {
  return globalErrorManager.chainError(newError, parentError);
}

/**
 * 🛡️ 便利函數：安全執行（自動錯誤捕獲）
 */
export async function safeExecute(operation, context = {}) {
  try {
    return await operation();
  } catch (error) {
    const errorContext = propagateError(error, {
      operation: operation.name || 'anonymous_operation',
      ...context
    });
    throw errorContext;
  }
}

/**
 * 🎯 錯誤處理裝飾器
 */
export function withErrorHandling(options = {}) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const errorContext = propagateError(error, {
          stage: options.stage || 'method_execution',
          component: target.constructor.name,
          function: propertyKey,
          ...options
        });
        
        if (options.rethrow !== false) {
          throw errorContext;
        }
        
        return options.fallback || null;
      }
    };
    
    return descriptor;
  };
}

// 瀏覽器環境全域暴露
if (typeof window !== 'undefined') {
  window.ErrorContext = ErrorContext;
  window.ErrorPropagationManager = ErrorPropagationManager;
  window.globalErrorManager = globalErrorManager;
  window.createErrorContext = createErrorContext;
  window.propagateError = propagateError;
  window.chainError = chainError;
  window.safeExecute = safeExecute;
}