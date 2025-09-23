/**
 * 🔗 Async Processing Pipeline Integration
 * 
 * 整合異步處理管線到現有系統中
 * 
 * @version 1.0.0
 * @author AutoFix Mermaid Team
 * @date 2025-09-24
 */

import { AsyncProcessingPipeline, createPipeline } from './async-processing-pipeline.js';
import { processCodeToMermaid } from './processor.js';
import { globalErrorManager } from './error-propagation.js';
import { memoryManager as resourceManager } from './memory-management.js';

/**
 * 🏭 Mermaid 處理管線
 */
export class MermaidProcessingPipeline extends AsyncProcessingPipeline {
  constructor(options = {}) {
    // 使用現有的 processCodeToMermaid 作為處理器
    super(processCodeToMermaid, {
      maxConcurrent: options.maxConcurrent || 3, // 保守一些，避免記憶體壓力
      batchSize: options.batchSize || 5,
      enableBatching: options.enableBatching !== false,
      ...options
    });

    this.processingStats = {
      totalProcessed: 0,
      totalErrors: 0,
      totalTime: 0,
      memoryUsage: []
    };

    // 監聽任務事件
    this.setupEventListeners();
  }

  /**
   * 🎧 設定事件監聽器
   */
  setupEventListeners() {
    this.on('taskStarted', (task) => {
      // 記錄記憶體使用
      const memUsage = resourceManager.getStatistics();
      this.processingStats.memoryUsage.push({
        taskId: task.id,
        timestamp: Date.now(),
        memory: memUsage.memory?.current?.heapUsed || 0
      });

      console.log(`Pipeline task started: ${task.id}`, {
        priority: task.priority,
        dependencies: task.dependencies
      });
    });

    this.on('taskCompleted', (task) => {
      this.processingStats.totalProcessed++;
      this.processingStats.totalTime += task.getDuration() || 0;

      console.log(`Pipeline task completed: ${task.id}`, {
        duration: task.getDuration(),
        result: task.result?.success || false
      });
    });

    this.on('taskFailed', (task) => {
      this.processingStats.totalErrors++;
      
      console.error('Pipeline task failed', task.error, {
        taskId: task.id,
        retryCount: task.retryCount,
        data: task.data
      });
    });

    this.on('taskRetrying', (task) => {
      console.warn(`Pipeline task retrying: ${task.id}`, {
        retryCount: task.retryCount,
        maxRetries: task.maxRetries
      });
    });
  }

  /**
   * 🎯 處理單個專案
   */
  async processProject(files, options = {}) {
    const projectId = options.projectId || `project_${Date.now()}`;
    
    try {
      const result = await this.processItem(files, {
        ...options,
        projectId,
        type: 'project'
      });
      
      return {
        success: true,
        projectId,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        projectId,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * 📦 批次處理多個專案
   */
  async processProjects(projects, options = {}) {
    const batchId = `batch_${Date.now()}`;
    
    // 準備專案資料
    const projectData = projects.map((project, index) => ({
      ...project,
      projectId: project.projectId || `${batchId}_project_${index}`,
      type: 'project'
    }));

    try {
      const results = await this.processBatch(projectData, {
        ...options,
        batchId
      });

      return {
        success: true,
        batchId,
        results: results.map(r => ({
          projectId: r.id,
          success: !r.error,
          ...r.result
        })),
        stats: this.getProcessingStats()
      };
    } catch (error) {
      return {
        success: false,
        batchId,
        error: error.message,
        results: [],
        stats: this.getProcessingStats()
      };
    }
  }

  /**
   * 📁 處理檔案清單
   */
  async processFileList(fileList, options = {}) {
    const tasks = [];
    
    for (const file of fileList) {
      const taskId = `file_${file.name || file.path}_${Date.now()}`;
      tasks.push({
        id: taskId,
        files: { [file.name || 'input']: file.content },
        options: {
          ...options,
          fileName: file.name,
          filePath: file.path
        }
      });
    }

    return await this.processProjects(tasks, options);
  }

  /**
   * 🔍 取得處理統計
   */
  getProcessingStats() {
    const baseStats = this.getDetailedStats();
    const avgTime = this.processingStats.totalProcessed > 0 
      ? this.processingStats.totalTime / this.processingStats.totalProcessed 
      : 0;

    return {
      ...baseStats,
      totalProcessed: this.processingStats.totalProcessed,
      totalErrors: this.processingStats.totalErrors,
      errorRate: this.processingStats.totalProcessed > 0 
        ? (this.processingStats.totalErrors / this.processingStats.totalProcessed) * 100 
        : 0,
      avgProcessingTime: avgTime,
      memoryStats: this.getMemoryStats()
    };
  }

  /**
   * 💾 取得記憶體統計
   */
  getMemoryStats() {
    const memUsage = this.processingStats.memoryUsage;
    if (memUsage.length === 0) return null;

    const memValues = memUsage.map(u => u.memory);
    return {
      count: memUsage.length,
      min: Math.min(...memValues),
      max: Math.max(...memValues),
      avg: memValues.reduce((a, b) => a + b, 0) / memValues.length,
      current: resourceManager.getStatistics().memory?.current?.heapUsed || 0
    };
  }

  /**
   * 🧹 清理資源
   */
  cleanup() {
    this.clear();
    this.processingStats = {
      totalProcessed: 0,
      totalErrors: 0,
      totalTime: 0,
      memoryUsage: []
    };
    
    // 觸發記憶體清理
    resourceManager.cleanup();
  }
}

/**
 * 🎛️ 管線工廠
 */
export class PipelineFactory {
  static createMermaidPipeline(options = {}) {
    return new MermaidProcessingPipeline(options);
  }

  static createCustomPipeline(processor, options = {}) {
    return createPipeline(processor)
      .setConcurrency(options.maxConcurrent || 4)
      .setBatchSize(options.batchSize || 10)
      .enableBatching(options.enableBatching !== false)
      .setAutoStart(options.autoStart !== false)
      .build();
  }

  static createHighPerformancePipeline(processor, options = {}) {
    return createPipeline(processor)
      .setConcurrency(options.maxConcurrent || 8)
      .setBatchSize(options.batchSize || 20)
      .enableBatching(true)
      .setAutoStart(true)
      .build();
  }

  static createLowMemoryPipeline(processor, options = {}) {
    return createPipeline(processor)
      .setConcurrency(options.maxConcurrent || 2)
      .setBatchSize(options.batchSize || 3)
      .enableBatching(true)
      .setAutoStart(true)
      .build();
  }
}

/**
 * 🌐 全域管線實例
 */
export const globalMermaidPipeline = new MermaidProcessingPipeline({
  maxConcurrent: 3,
  batchSize: 5,
  enableBatching: true
});

// 進度監聽 (用於 UI 更新)
globalMermaidPipeline.onProgress((progress) => {
  // 發布進度事件到全域
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mermaidProcessingProgress', {
      detail: progress
    }));
  }
});

/**
 * 🚀 便利的 API 函數
 */

/**
 * 處理單個專案 (便利函數)
 */
export async function processProject(files, options = {}) {
  return await globalMermaidPipeline.processProject(files, options);
}

/**
 * 批次處理專案 (便利函數)
 */
export async function processProjects(projects, options = {}) {
  return await globalMermaidPipeline.processProjects(projects, options);
}

/**
 * 處理檔案清單 (便利函數)
 */
export async function processFileList(fileList, options = {}) {
  return await globalMermaidPipeline.processFileList(fileList, options);
}

/**
 * 取得全域管線統計 (便利函數)
 */
export function getPipelineStats() {
  return globalMermaidPipeline.getProcessingStats();
}

/**
 * 清理全域管線 (便利函數)
 */
export function cleanupPipeline() {
  globalMermaidPipeline.cleanup();
}

export default {
  MermaidProcessingPipeline,
  PipelineFactory,
  globalMermaidPipeline,
  processProject,
  processProjects,
  processFileList,
  getPipelineStats,
  cleanupPipeline
};