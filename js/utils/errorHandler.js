// js/utils/errorHandler.js
// 統一錯誤處理與 fallback 機制

/**
 * 自訂錯誤類別，提供更詳細的錯誤資訊
 */
export class AutofixError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'AutofixError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 統一錯誤處理器
 */
export class ErrorHandler {
  /**
   * 執行函數並提供 fallback 機制
   * @param {Function} primary - 主要執行函數
   * @param {Function} fallback - 備援函數
   * @param {string} context - 執行環境描述
   * @returns {Promise<any>} 執行結果
   */
  static async withFallback(primary, fallback, context = 'operation') {
    try {
      return await primary();
    } catch (error) {
      console.warn(`[${context}] Primary operation failed, using fallback:`, error.message);
      
      try {
        return await fallback();
      } catch (fallbackError) {
        console.error(`[${context}] Fallback also failed:`, fallbackError.message);
        throw new AutofixError(
          `Both primary and fallback operations failed in ${context}`,
          'FALLBACK_FAILED',
          { primaryError: error.message, fallbackError: fallbackError.message }
        );
      }
    }
  }

  /**
   * 建立帶有上下文的記錄器
   * @param {string} context - 記錄器上下文
   * @returns {Object} 記錄器物件
   */
  static createContextualLogger(context) {
    const timestamp = () => new Date().toISOString().slice(11, 23);
    
    return {
      info: (msg, ...args) => console.log(`[${timestamp()}][${context}] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[${timestamp()}][${context}] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[${timestamp()}][${context}] ${msg}`, ...args),
      debug: (msg, ...args) => {
        if (globalThis?.process?.env?.NODE_ENV === 'development') {
          console.debug(`[${timestamp()}][${context}] ${msg}`, ...args);
        }
      }
    };
  }

  /**
   * 安全執行異步函數
   * @param {Function} fn - 要執行的函數
   * @param {any} defaultValue - 失敗時的預設值
   * @param {string} context - 執行上下文
   * @returns {Promise<any>} 執行結果或預設值
   */
  static async safeExecute(fn, defaultValue = null, context = 'function') {
    try {
      return await fn();
    } catch (error) {
      console.warn(`[${context}] Safe execution failed, returning default:`, error.message);
      return defaultValue;
    }
  }
}

/**
 * 環境檢測與適配
 */
export const ENV = {
  isBrowser: typeof window !== 'undefined',
  isNode: typeof process !== 'undefined' && process.versions?.node,
  isWorker: typeof importScripts === 'function',
  
  /**
   * 取得全域作用域
   * @returns {Object} 全域物件
   */
  getGlobalScope() {
    if (this.isBrowser) return window;
    if (this.isWorker) return self;
    if (this.isNode) return globalThis;
    return {};
  },

  /**
   * 檢查功能支援
   * @returns {Object} 功能支援狀態
   */
  getCapabilities() {
    return {
      webAssembly: typeof WebAssembly !== 'undefined',
      webWorkers: typeof Worker !== 'undefined',
      esModules: typeof globalThis?.import === 'function' || typeof window?.import === 'function',
      fetch: typeof fetch !== 'undefined',
      canvas: typeof HTMLCanvasElement !== 'undefined'
    };
  }
};