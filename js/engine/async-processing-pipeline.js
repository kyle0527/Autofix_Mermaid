/**
 * 🔄 Async Processing Pipeline System
 * 
 * 提供完整的異步處理管線，支援批次處理、進度追蹤和錯誤處理
 * 
 * @version 1.0.0
 * @author AutoFix Mermaid Team
 * @date 2025-09-24
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

/**
 * 🎯 管線任務介面
 */
export class PipelineTask {
  constructor(id, data, options = {}) {
    this.id = id;
    this.data = data;
    this.options = options;
    this.status = 'pending';
    this.result = null;
    this.error = null;
    this.startTime = null;
    this.endTime = null;
    this.dependencies = options.dependencies || [];
    this.priority = options.priority || 0;
    this.retryCount = 0;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * 🏁 開始任務
   */
  start() {
    this.status = 'running';
    this.startTime = performance.now();
  }

  /**
   * ✅ 完成任務
   */
  complete(result) {
    this.status = 'completed';
    this.result = result;
    this.endTime = performance.now();
  }

  /**
   * ❌ 任務失敗
   */
  fail(error) {
    this.status = 'failed';
    this.error = error;
    this.endTime = performance.now();
  }

  /**
   * 🔄 重試任務
   */
  retry() {
    this.retryCount++;
    this.status = 'pending';
    this.error = null;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * ⏱️ 取得執行時間
   */
  getDuration() {
    if (!this.startTime) return null;
    const endTime = this.endTime || performance.now();
    return endTime - this.startTime;
  }

  /**
   * 📊 取得任務資訊
   */
  getInfo() {
    return {
      id: this.id,
      status: this.status,
      priority: this.priority,
      retryCount: this.retryCount,
      duration: this.getDuration(),
      dependencies: this.dependencies,
      hasResult: !!this.result,
      hasError: !!this.error
    };
  }
}

/**
 * 🔄 任務佇列管理器
 */
export class TaskQueue {
  constructor(options = {}) {
    this.tasks = new Map();
    this.runningTasks = new Set();
    this.completedTasks = new Set();
    this.failedTasks = new Set();
    this.maxConcurrent = options.maxConcurrent || 4;
    this.autoStart = options.autoStart !== false;
    this.events = new EventEmitter();
    this.events.setMaxListeners(50); // 增加監聽器限制
  }

  /**
   * ➕ 添加任務
   */
  add(taskOrId, data, options = {}) {
    const task = taskOrId instanceof PipelineTask 
      ? taskOrId 
      : new PipelineTask(taskOrId, data, options);
    
    this.tasks.set(task.id, task);
    this.events.emit('taskAdded', task);

    if (this.autoStart) {
      setImmediate(() => this.process());
    }

    return task;
  }

  /**
   * 🔍 取得任務
   */
  get(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * 🗑️ 移除任務
   */
  remove(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      this.tasks.delete(taskId);
      this.runningTasks.delete(taskId);
      this.completedTasks.delete(taskId);
      this.failedTasks.delete(taskId);
      this.events.emit('taskRemoved', task);
    }
    return task;
  }

  /**
   * 🚀 處理佇列
   */
  async process() {
    while (this.runningTasks.size < this.maxConcurrent && this.hasPendingTasks()) {
      const task = this.getNextTask();
      if (task) {
        await this.executeTask(task);
      }
    }
  }

  /**
   * 🔍 檢查是否有待處理任務
   */
  hasPendingTasks() {
    return Array.from(this.tasks.values()).some(task => 
      task.status === 'pending' && this.areDependenciesMet(task)
    );
  }

  /**
   * 🎯 取得下一個要執行的任務 (優先級排序)
   */
  getNextTask() {
    const pendingTasks = Array.from(this.tasks.values())
      .filter(task => 
        task.status === 'pending' && 
        this.areDependenciesMet(task)
      )
      .sort((a, b) => b.priority - a.priority); // 高優先級優先

    return pendingTasks[0] || null;
  }

  /**
   * 🔗 檢查依賴是否滿足
   */
  areDependenciesMet(task) {
    return task.dependencies.every(depId => 
      this.completedTasks.has(depId)
    );
  }

  /**
   * ⚡ 執行任務
   */
  async executeTask(task) {
    this.runningTasks.add(task.id);
    task.start();
    this.events.emit('taskStarted', task);

    try {
      // 這裡會由具體的處理器來執行
      const result = await this.executeTaskLogic(task);
      
      task.complete(result);
      this.runningTasks.delete(task.id);
      this.completedTasks.add(task.id);
      this.events.emit('taskCompleted', task);

    } catch (error) {
      task.fail(error);
      this.runningTasks.delete(task.id);

      // 重試邏輯
      if (task.retryCount < task.maxRetries) {
        task.retry();
        this.events.emit('taskRetrying', task);
        
        // 延遲重試
        setTimeout(() => {
          if (this.autoStart) this.process();
        }, 1000 * Math.pow(2, task.retryCount)); // 指數退避
      } else {
        this.failedTasks.add(task.id);
        this.events.emit('taskFailed', task);
      }
    }

    // 繼續處理佇列
    if (this.autoStart) {
      setImmediate(() => this.process());
    }
  }

  /**
   * 🎯 任務執行邏輯 (由子類實作)
   */
  async executeTaskLogic(_task) {
    throw new Error('executeTaskLogic must be implemented by subclass');
  }

  /**
   * ⏸️ 暫停處理
   */
  pause() {
    this.autoStart = false;
  }

  /**
   * ▶️ 恢復處理
   */
  resume() {
    this.autoStart = true;
    this.process();
  }

  /**
   * 🛑 停止所有任務
   */
  stop() {
    this.autoStart = false;
    this.runningTasks.clear();
  }

  /**
   * 🧹 清空佇列
   */
  clear() {
    this.stop();
    this.tasks.clear();
    this.completedTasks.clear();
    this.failedTasks.clear();
  }

  /**
   * 📊 取得佇列統計
   */
  getStats() {
    const allTasks = Array.from(this.tasks.values());
    
    return {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      running: this.runningTasks.size,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size,
      avgDuration: this.getAverageDuration(),
      throughput: this.getThroughput()
    };
  }

  /**
   * ⏱️ 取得平均執行時間
   */
  getAverageDuration() {
    const completedTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'completed');
    
    if (completedTasks.length === 0) return 0;
    
    const totalDuration = completedTasks.reduce((sum, task) => 
      sum + (task.getDuration() || 0), 0);
    
    return totalDuration / completedTasks.length;
  }

  /**
   * 📈 取得處理能力 (任務/秒)
   */
  getThroughput() {
    const now = performance.now();
    const recentTasks = Array.from(this.tasks.values())
      .filter(t => 
        t.status === 'completed' && 
        t.endTime && 
        (now - t.endTime) < 60000 // 最近1分鐘
      );
    
    return recentTasks.length / 60; // 任務/秒
  }

  /**
   * 👂 事件監聽
   */
  on(event, listener) {
    this.events.on(event, listener);
  }

  /**
   * 🔇 移除監聽
   */
  off(event, listener) {
    this.events.off(event, listener);
  }
}

/**
 * 🏭 異步處理管線
 */
export class AsyncProcessingPipeline extends TaskQueue {
  constructor(processor, options = {}) {
    super(options);
    this.processor = processor;
    this.batchSize = options.batchSize || 10;
    this.enableBatching = options.enableBatching !== false;
    this.progressCallbacks = new Set();
  }

  /**
   * 🎯 執行任務邏輯 - 使用注入的處理器
   */
  async executeTaskLogic(task) {
    if (typeof this.processor === 'function') {
      return await this.processor(task.data, task.options);
    } else if (this.processor && typeof this.processor.process === 'function') {
      return await this.processor.process(task.data, task.options);
    } else {
      throw new Error('Invalid processor: must be function or object with process method');
    }
  }

  /**
   * 📦 批次處理多個項目
   */
  async processBatch(items, options = {}) {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tasks = [];

    // 建立批次任務
    for (let i = 0; i < items.length; i++) {
      const taskId = `${batchId}_task_${i}`;
      const task = this.add(taskId, items[i], {
        ...options,
        batchId,
        batchIndex: i
      });
      tasks.push(task);
    }

    // 等待批次完成
    return await this.waitForBatch(tasks);
  }

  /**
   * ⏳ 等待批次完成
   */
  async waitForBatch(tasks) {
    return new Promise((resolve, reject) => {
      let completedCount = 0;
      let hasError = false;

      const checkCompletion = () => {
        completedCount++;
        
        // 報告進度
        this.reportProgress({
          type: 'batch',
          completed: completedCount,
          total: tasks.length,
          percentage: Math.round((completedCount / tasks.length) * 100)
        });

        if (completedCount === tasks.length) {
          if (hasError) {
            const errors = tasks
              .filter(t => t.error)
              .map(t => ({ id: t.id, error: t.error }));
            reject(new Error(`Batch processing failed: ${errors.length} errors`));
          } else {
            resolve(tasks.map(t => ({ id: t.id, result: t.result })));
          }
        }
      };

      // 監聽每個任務
      tasks.forEach(task => {
        const onComplete = (completedTask) => {
          if (completedTask.id === task.id) {
            this.events.off('taskCompleted', onComplete);
            this.events.off('taskFailed', onFailed);
            checkCompletion();
          }
        };

        const onFailed = (failedTask) => {
          if (failedTask.id === task.id) {
            this.events.off('taskCompleted', onComplete);
            this.events.off('taskFailed', onFailed);
            hasError = true;
            checkCompletion();
          }
        };

        this.events.on('taskCompleted', onComplete);
        this.events.on('taskFailed', onFailed);
      });
    });
  }

  /**
   * 📊 報告進度
   */
  reportProgress(progress) {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Progress callback error:', error);
      }
    });
  }

  /**
   * 👂 添加進度監聽器
   */
  onProgress(callback) {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  /**
   * 🚀 處理單個項目 (便利方法)
   */
  async processItem(data, options = {}) {
    const taskId = `item_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const task = this.add(taskId, data, options);
    
    return new Promise((resolve, reject) => {
      const onComplete = (completedTask) => {
        if (completedTask.id === task.id) {
          this.events.off('taskCompleted', onComplete);
          this.events.off('taskFailed', onFailed);
          resolve(completedTask.result);
        }
      };

      const onFailed = (failedTask) => {
        if (failedTask.id === task.id) {
          this.events.off('taskCompleted', onComplete);
          this.events.off('taskFailed', onFailed);
          reject(failedTask.error);
        }
      };

      this.events.on('taskCompleted', onComplete);
      this.events.on('taskFailed', onFailed);
    });
  }

  /**
   * 📈 取得詳細統計
   */
  getDetailedStats() {
    const baseStats = this.getStats();
    const allTasks = Array.from(this.tasks.values());
    
    // 按批次分組統計
    const batches = {};
    allTasks.forEach(task => {
      if (task.options.batchId) {
        if (!batches[task.options.batchId]) {
          batches[task.options.batchId] = { tasks: [], completed: 0, failed: 0 };
        }
        batches[task.options.batchId].tasks.push(task);
        if (task.status === 'completed') batches[task.options.batchId].completed++;
        if (task.status === 'failed') batches[task.options.batchId].failed++;
      }
    });

    return {
      ...baseStats,
      batches: Object.keys(batches).length,
      batchStats: Object.entries(batches).map(([id, data]) => ({
        id,
        total: data.tasks.length,
        completed: data.completed,
        failed: data.failed,
        progress: Math.round((data.completed / data.tasks.length) * 100)
      }))
    };
  }
}

/**
 * 🎛️ 管線建構器
 */
export class PipelineBuilder {
  constructor() {
    this.options = {
      maxConcurrent: 4,
      enableBatching: true,
      batchSize: 10,
      autoStart: true
    };
    this.processor = null;
  }

  /**
   * 🎯 設定處理器
   */
  setProcessor(processor) {
    this.processor = processor;
    return this;
  }

  /**
   * 📦 設定並行數量
   */
  setConcurrency(maxConcurrent) {
    this.options.maxConcurrent = maxConcurrent;
    return this;
  }

  /**
   * 📦 設定批次大小
   */
  setBatchSize(batchSize) {
    this.options.batchSize = batchSize;
    return this;
  }

  /**
   * 🔧 啟用/禁用批次處理
   */
  enableBatching(enabled = true) {
    this.options.enableBatching = enabled;
    return this;
  }

  /**
   * 🚀 設定自動啟動
   */
  setAutoStart(autoStart = true) {
    this.options.autoStart = autoStart;
    return this;
  }

  /**
   * 🏗️ 建構管線
   */
  build() {
    if (!this.processor) {
      throw new Error('Processor is required');
    }
    
    return new AsyncProcessingPipeline(this.processor, this.options);
  }
}

// 便利的建構器函數
export function createPipeline(processor) {
  return new PipelineBuilder().setProcessor(processor);
}

export default {
  PipelineTask,
  TaskQueue,
  AsyncProcessingPipeline,
  PipelineBuilder,
  createPipeline
};