/**
 * AnalysisMonitor - 分析流程監控器
 * Phase 2.1: 事件驅動架構的監控與調試組件
 * 
 * 功能：
 * 1. 實時監控分析進度
 * 2. 錯誤追蹤與恢復建議
 * 3. 效能分析與優化建議
 * 4. 系統健康度評估
 */

import { globalEventBus, SystemEventTypes } from './EventBus.js';

export class AnalysisMonitor {
  constructor() {
    this.sessions = new Map(); // 分析會話追蹤
    this.systemHealth = {
      treeSitterHealth: 'unknown',
      parserFallbackRate: 0,
      averageAnalysisTime: 0,
      errorRate: 0
    };
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // 分析流程監控
    globalEventBus.safeOn(SystemEventTypes.ANALYSIS_STARTED, (eventData) => {
      this.onAnalysisStarted(eventData);
    });

    globalEventBus.safeOn(SystemEventTypes.ANALYSIS_COMPLETED, (eventData) => {
      this.onAnalysisCompleted(eventData);
    });

    globalEventBus.safeOn(SystemEventTypes.ANALYSIS_FAILED, (eventData) => {
      this.onAnalysisFailed(eventData);
    });

    // Tree-sitter 健康度監控
    globalEventBus.safeOn(SystemEventTypes.TREESITTER_INIT_SUCCESS, (eventData) => {
      this.systemHealth.treeSitterHealth = 'healthy';
      console.log(`✅ Tree-sitter ${eventData.payload.language} 初始化成功`);
    });

    globalEventBus.safeOn(SystemEventTypes.TREESITTER_INIT_FAILED, (eventData) => {
      this.systemHealth.treeSitterHealth = 'degraded';
      console.warn(`⚠️ Tree-sitter ${eventData.payload.language} 初始化失敗: ${eventData.payload.error}`);
    });

    globalEventBus.safeOn(SystemEventTypes.TREESITTER_FALLBACK, (eventData) => {
      this.systemHealth.parserFallbackRate += 1;
      console.info(`🔄 切換到備用解析器: ${eventData.payload.language} (${eventData.payload.reason})`);
    });

    // 解析器監控
    globalEventBus.safeOn(SystemEventTypes.PARSER_SWITCH, (eventData) => {
      const { from, to, file, reason } = eventData.payload;
      console.info(`🔀 解析器切換: ${from} → ${to} (${file}): ${reason}`);
    });

    globalEventBus.safeOn(SystemEventTypes.PARSER_ERROR, (eventData) => {
      console.error(`❌ 解析器錯誤:`, eventData.payload);
    });

    // IR 生成監控
    globalEventBus.safeOn(SystemEventTypes.IR_GENERATED, (eventData) => {
      const { language, entityCount, relationCount } = eventData.payload;
      console.info(`📊 ${language} IR 生成完成: ${entityCount} 實體, ${relationCount} 關係`);
    });

    // 系統監控
    globalEventBus.safeOn(SystemEventTypes.SYSTEM_MEMORY_WARNING, (eventData) => {
      const { current, limit, percentage } = eventData.payload;
      console.warn(`⚠️ 記憶體警告: ${percentage.toFixed(1)}% (${(current/1024/1024).toFixed(1)}MB / ${(limit/1024/1024).toFixed(1)}MB)`);
    });

    globalEventBus.safeOn(SystemEventTypes.SYSTEM_ERROR, (eventData) => {
      console.error(`🚨 系統錯誤:`, eventData.payload);
    });
  }

  onAnalysisStarted(eventData) {
    const { projectPath, language } = eventData.payload;
    const sessionId = `${language}-${Date.now()}`;
    
    this.sessions.set(sessionId, {
      id: sessionId,
      projectPath,
      language,
      startTime: eventData.metadata.timestamp,
      status: 'running'
    });

    console.log(`🚀 開始分析 ${language} 專案: ${projectPath}`);
  }

  onAnalysisCompleted(eventData) {
    const { projectPath, language, stats } = eventData.payload;
    const { performance } = eventData.metadata;
    
    // 更新系統健康度
    if (performance) {
      this.updateAverageAnalysisTime(performance.duration);
    }

    // 生成完成報告
    console.log(`✅ ${language} 分析完成:`);
    console.log(`   專案: ${projectPath}`);
    console.log(`   檔案: ${stats.filesProcessed}`);
    console.log(`   實體: ${stats.entitiesFound}`);
    console.log(`   關係: ${stats.relationsFound}`);
    console.log(`   錯誤: ${stats.errorsFound}`);
    if (performance) {
      console.log(`   耗時: ${performance.duration}ms`);
    }
    
    // 檢查是否有性能問題
    if (performance && performance.duration > 10000) {
      console.warn(`⚠️ 分析耗時過長 (${performance.duration}ms)，建議檢查：`);
      console.warn(`   - 檔案大小是否過大`);
      console.warn(`   - Tree-sitter 是否正常工作`);
      console.warn(`   - 系統資源是否充足`);
    }
    
    // 檢查錯誤率
    if (stats.errorsFound > 0) {
      const errorRate = stats.errorsFound / stats.filesProcessed;
      if (errorRate > 0.1) { // 錯誤率超過 10%
        console.warn(`⚠️ 錯誤率偏高 (${(errorRate * 100).toFixed(1)}%)，建議：`);
        console.warn(`   - 檢查檔案編碼格式`);
        console.warn(`   - 驗證 Python 語法正確性`);
        console.warn(`   - 確認檔案路徑可存取`);
      }
    }
  }

  onAnalysisFailed(eventData) {
    const { projectPath, language, error, stats } = eventData.payload;
    this.systemHealth.errorRate += 1;
    
    console.error(`❌ ${language} 分析失敗:`);
    console.error(`   專案: ${projectPath}`);
    console.error(`   錯誤: ${error}`);
    console.error(`   統計: ${JSON.stringify(stats, null, 2)}`);
    
    // 提供恢復建議
    console.log(`💡 建議的恢復措施：`);
    console.log(`   1. 檢查專案路徑是否正確`);
    console.log(`   2. 確認檔案讀取權限`);
    console.log(`   3. 驗證 Python 檔案語法`);
    console.log(`   4. 檢查系統資源使用狀況`);
    
    if (error.includes('TreeSitter')) {
      console.log(`   5. Tree-sitter 相關問題，系統會自動切換到正則表達式解析`);
    }
  }

  updateAverageAnalysisTime(duration) {
    if (this.systemHealth.averageAnalysisTime === 0) {
      this.systemHealth.averageAnalysisTime = duration;
    } else {
      // 使用指數移動平均
      this.systemHealth.averageAnalysisTime = 
        this.systemHealth.averageAnalysisTime * 0.8 + duration * 0.2;
    }
  }

  /**
   * 獲取系統健康度報告
   */
  getHealthReport() {
    const eventStats = globalEventBus.getEventStats();
    
    return {
      timestamp: Date.now(),
      systemHealth: { ...this.systemHealth },
      eventStats,
      activeSessions: Array.from(this.sessions.values()),
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.systemHealth.treeSitterHealth === 'degraded') {
      recommendations.push({
        level: 'warning',
        message: 'Tree-sitter 未能正常初始化，建議檢查 WASM 檔案路徑',
        action: '檢查 js/wasm/ 目錄下的 tree-sitter-*.wasm 檔案'
      });
    }
    
    if (this.systemHealth.parserFallbackRate > 5) {
      recommendations.push({
        level: 'info',
        message: `解析器回退次數較多 (${this.systemHealth.parserFallbackRate})，正則表達式模式正常運作`,
        action: '考慮修復 Tree-sitter 設定以獲得更好的解析精度'
      });
    }
    
    if (this.systemHealth.averageAnalysisTime > 5000) {
      recommendations.push({
        level: 'warning',
        message: `平均分析時間較長 (${this.systemHealth.averageAnalysisTime.toFixed(0)}ms)`,
        action: '考慮優化專案結構或增加系統資源'
      });
    }
    
    return recommendations;
  }

  /**
   * 輸出詳細的監控報告
   */
  printDetailedReport() {
    const report = this.getHealthReport();
    
    console.log('\n=== 系統健康度報告 ===');
    console.log(`時間: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`Tree-sitter 狀態: ${report.systemHealth.treeSitterHealth}`);
    console.log(`解析器回退次數: ${report.systemHealth.parserFallbackRate}`);
    console.log(`平均分析時間: ${report.systemHealth.averageAnalysisTime.toFixed(0)}ms`);
    console.log(`錯誤次數: ${report.systemHealth.errorRate}`);
    
    console.log('\n=== 事件統計 ===');
    console.log(`總事件數: ${report.eventStats.totalEvents}`);
    console.log(`事件分類:`);
    Object.entries(report.eventStats.eventBreakdown).forEach(([event, count]) => {
      console.log(`  ${event}: ${count}`);
    });
    
    if (report.recommendations.length > 0) {
      console.log('\n=== 改善建議 ===');
      report.recommendations.forEach((rec, i) => {
        const icon = rec.level === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${i + 1}. ${icon} ${rec.message}`);
        console.log(`   動作: ${rec.action}`);
      });
    }
    
    console.log('\n========================\n');
  }
}

// 創建全域監控器實例
export const globalAnalysisMonitor = new AnalysisMonitor();

export default globalAnalysisMonitor;