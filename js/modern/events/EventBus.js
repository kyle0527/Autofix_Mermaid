/**
 * ModernEventBus - 統一事件驅動架構
 * Phase 2.1: 建立全域事件系統，替換分散的事件處理
 * 
 * 功能：
 * 1. 類型安全的事件定義
 * 2. 錯誤恢復與監控
 * 3. 效能追蹤與調試
 * 4. 插件式事件監聽器
 */

import { EventEmitter } from 'events';

// 系統事件類型定義
export const SystemEventTypes = {
  // 分析流程事件
  ANALYSIS_STARTED: 'analysis:started',
  ANALYSIS_PROGRESS: 'analysis:progress', 
  ANALYSIS_COMPLETED: 'analysis:completed',
  ANALYSIS_FAILED: 'analysis:failed',

  // Tree-sitter 事件
  TREESITTER_INIT_START: 'treesitter:init:start',
  TREESITTER_INIT_SUCCESS: 'treesitter:init:success',
  TREESITTER_INIT_FAILED: 'treesitter:init:failed',
  TREESITTER_FALLBACK: 'treesitter:fallback',

  // 解析器事件
  PARSER_SWITCH: 'parser:switch',
  PARSER_ERROR: 'parser:error',
  PARSER_RECOVERED: 'parser:recovered',

  // IR 生成事件
  IR_GENERATED: 'ir:generated',
  IR_INVALID: 'ir:invalid',
  IR_MERGED: 'ir:merged',

  // 輸出生成事件
  OUTPUT_START: 'output:start',
  OUTPUT_GENERATED: 'output:generated',
  OUTPUT_ERROR: 'output:error',

  // 系統監控事件
  SYSTEM_MEMORY_WARNING: 'system:memory:warning',
  SYSTEM_PERFORMANCE: 'system:performance',
  SYSTEM_ERROR: 'system:error'
};

/**
 * 現代化事件匯流排
 * 提供類型安全、可監控的事件系統
 */
export class ModernEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // 支援更多監聽器
    this._eventStats = new Map();
    this._errorHistory = [];
    this._performanceData = [];
  }

  /**
   * 發送帶有統計追蹤的事件
   * @param {string} eventType - 事件類型
   * @param {Object} payload - 事件資料
   * @param {Object} metadata - 元數據（時間戳、來源等）
   */
  emitWithStats(eventType, payload = {}, metadata = {}) {
    const eventData = {
      type: eventType,
      payload,
      metadata: {
        timestamp: Date.now(),
        source: metadata.source || 'unknown',
        ...metadata
      }
    };

    // 更新統計
    this._updateEventStats(eventType);

    // 特殊處理錯誤事件
    if (eventType.includes('error') || eventType.includes('failed')) {
      this._recordError(eventData);
    }

    // 特殊處理效能事件
    if (eventData.metadata.performance) {
      this._recordPerformance(eventData);
    }

    // 發送事件
    this.emit(eventType, eventData);

    // 發送通用事件（供全域監聽器使用）
    this.emit('*', eventData);

    return eventData;
  }

  /**
   * 帶有錯誤恢復的監聽器註冊
   * @param {string} eventType - 事件類型
   * @param {Function} handler - 處理函數
   * @param {Object} options - 選項
   */
  safeOn(eventType, handler, options = {}) {
    const {
      errorRecovery = true,
      maxRetries = 3,
      timeout = 5000
    } = options;

    const wrappedHandler = async (eventData) => {
      let retries = 0;
      
      while (retries <= maxRetries) {
        try {
          // 設定超時
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Handler timeout')), timeout)
          );
          
          const handlerPromise = Promise.resolve(handler(eventData));
          await Promise.race([handlerPromise, timeoutPromise]);
          
          return; // 成功，退出重試循環
        } catch (error) {
          retries++;
          
          if (retries > maxRetries || !errorRecovery) {
            // 記錄最終失敗
            this.emitWithStats(SystemEventTypes.SYSTEM_ERROR, {
              originalEvent: eventData,
              handlerError: error.message,
              retries: retries - 1
            }, { source: 'ModernEventBus:safeOn' });
            
            throw error;
          }
          
          // 記錄重試
          this.emitWithStats(SystemEventTypes.PARSER_ERROR, {
            originalEvent: eventData,
            error: error.message,
            retry: retries,
            maxRetries
          }, { source: 'ModernEventBus:retry' });
          
          // 等待後重試
          await new Promise(resolve => setTimeout(resolve, 100 * retries));
        }
      }
    };

    this.on(eventType, wrappedHandler);
    
    // 返回取消訂閱函數
    return () => this.off(eventType, wrappedHandler);
  }

  /**
   * 獲取事件統計資訊
   */
  getEventStats() {
    return {
      totalEvents: Array.from(this._eventStats.values()).reduce((a, b) => a + b, 0),
      eventBreakdown: Object.fromEntries(this._eventStats),
      recentErrors: this._errorHistory.slice(-10),
      performanceMetrics: this._performanceData.slice(-50)
    };
  }

  /**
   * 清理過期數據
   */
  cleanup() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    // 清理錯誤歷史
    this._errorHistory = this._errorHistory.filter(
      error => error.metadata.timestamp > oneHourAgo
    );
    
    // 清理效能數據
    this._performanceData = this._performanceData.filter(
      perf => perf.metadata.timestamp > oneHourAgo
    );
  }

  // 私有方法
  _updateEventStats(eventType) {
    this._eventStats.set(eventType, (this._eventStats.get(eventType) || 0) + 1);
  }

  _recordError(eventData) {
    this._errorHistory.push(eventData);
    if (this._errorHistory.length > 100) {
      this._errorHistory = this._errorHistory.slice(-50); // 保留最近 50 個
    }
  }

  _recordPerformance(eventData) {
    this._performanceData.push(eventData);
    if (this._performanceData.length > 200) {
      this._performanceData = this._performanceData.slice(-100); // 保留最近 100 個
    }
  }
}

// 單例模式：全域事件匯流排
export const globalEventBus = new ModernEventBus();

// 預設錯誤處理器
globalEventBus.safeOn(SystemEventTypes.SYSTEM_ERROR, (eventData) => {
  console.error('[System Error]', eventData.payload, eventData.metadata);
}, { errorRecovery: false }); // 錯誤處理器本身不重試

// 預設效能監控
globalEventBus.safeOn(SystemEventTypes.SYSTEM_PERFORMANCE, (eventData) => {
  const { operation, duration, memory } = eventData.payload;
  if (duration > 5000) { // 超過 5 秒的操作
    console.warn(`[Performance Warning] ${operation} took ${duration}ms`);
  }
  if (memory && memory.used > memory.limit * 0.8) { // 記憶體使用超過 80%
    globalEventBus.emitWithStats(SystemEventTypes.SYSTEM_MEMORY_WARNING, {
      current: memory.used,
      limit: memory.limit,
      percentage: (memory.used / memory.limit) * 100
    });
  }
});

export default globalEventBus;