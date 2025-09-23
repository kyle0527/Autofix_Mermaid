/**
 * 🧪 Async Processing Pipeline Tests
 * 
 * 測試異步處理管線的功能和效能
 * 
 * @version 1.0.0
 * @author AutoFix Mermaid Team  
 * @date 2025-09-24
 */

import { 
  PipelineTask, 
  TaskQueue, 
  AsyncProcessingPipeline,
  createPipeline 
} from '../js/engine/async-processing-pipeline.js';

import {
  MermaidProcessingPipeline,
  PipelineFactory
} from '../js/engine/async-pipeline-integration.js';

/**
 * 🎯 基礎功能測試
 */
export class AsyncPipelineTests {
  constructor() {
    this.results = [];
  }

  /**
   * 🧪 運行所有測試
   */
  async runAllTests() {
    console.log('🚀 開始 Async Processing Pipeline 測試...\n');

    const tests = [
      'testPipelineTask',
      'testTaskQueue',
      'testAsyncPipeline',
      'testBatchProcessing',
      'testErrorHandling',
      'testRetryMechanism',
      'testPerformanceMetrics',
      'testMermaidIntegration',
      'testPipelineFactory'
    ];

    for (const testName of tests) {
      try {
        console.log(`📋 執行測試: ${testName}`);
        const result = await this[testName]();
        this.results.push({ test: testName, success: true, result });
        console.log(`✅ ${testName} 通過\n`);
      } catch (error) {
        this.results.push({ test: testName, success: false, error: error.message });
        console.log(`❌ ${testName} 失敗: ${error.message}\n`);
      }
    }

    this.printSummary();
    return this.results;
  }

  /**
   * 🎯 測試 PipelineTask
   */
  async testPipelineTask() {
    const task = new PipelineTask('test-1', { data: 'test' }, {
      priority: 5,
      dependencies: ['dep-1'],
      maxRetries: 2
    });

    // 測試初始狀態
    if (task.status !== 'pending') throw new Error('Initial status should be pending');
    if (task.priority !== 5) throw new Error('Priority not set correctly');
    if (task.dependencies.length !== 1) throw new Error('Dependencies not set correctly');

    // 測試開始
    task.start();
    if (task.status !== 'running') throw new Error('Status should be running after start');
    if (!task.startTime) throw new Error('Start time should be set');

    // 測試完成
    task.complete({ result: 'success' });
    if (task.status !== 'completed') throw new Error('Status should be completed');
    if (!task.result) throw new Error('Result should be set');
    if (!task.endTime) throw new Error('End time should be set');

    // 測試重試
    const task2 = new PipelineTask('test-2', { data: 'test' });
    task2.start();
    task2.fail(new Error('Test error'));
    task2.retry();
    if (task2.status !== 'pending') throw new Error('Status should be pending after retry');
    if (task2.retryCount !== 1) throw new Error('Retry count should increment');

    return { passed: 4, message: 'PipelineTask 基礎功能正常' };
  }

  /**
   * 📋 測試 TaskQueue
   */
  async testTaskQueue() {
    const queue = new TaskQueue({ maxConcurrent: 2, autoStart: false });
    
    // 測試添加任務
    queue.add('task-1', { value: 1 });
    queue.add('task-2', { value: 2 }, { priority: 10 });
    
    if (queue.tasks.size !== 2) throw new Error('Should have 2 tasks');

    // 測試優先級排序
    const nextTask = queue.getNextTask();
    if (nextTask.id !== 'task-2') throw new Error('Should prioritize higher priority task');

    // 測試依賴檢查
    const task3 = queue.add('task-3', { value: 3 }, { dependencies: ['task-1'] });
    if (queue.areDependenciesMet(task3)) throw new Error('Dependencies should not be met');

    // 測試統計
    const stats = queue.getStats();
    if (stats.total !== 3) throw new Error('Total count incorrect');
    if (stats.pending !== 3) throw new Error('Pending count incorrect');

    return { passed: 5, message: 'TaskQueue 功能正常' };
  }

  /**
   * ⚡ 測試 AsyncPipeline
   */
  async testAsyncPipeline() {
    let processedCount = 0;
    
    // 建立簡單的處理器
    const processor = async (data) => {
      await new Promise(resolve => setTimeout(resolve, 10)); // 模擬處理時間
      processedCount++;
      return { processed: true, value: data.value * 2 };
    };

    const pipeline = createPipeline(processor)
      .setConcurrency(2)
      .setBatchSize(3)
      .build();

    // 測試單個項目處理
    const result1 = await pipeline.processItem({ value: 5 });
    if (result1.value !== 10) throw new Error('Processing result incorrect');

    // 測試批次處理
    const items = [{ value: 1 }, { value: 2 }, { value: 3 }];
    const batchResults = await pipeline.processBatch(items);
    
    if (batchResults.length !== 3) throw new Error('Batch result count incorrect');
    if (batchResults[0].result.value !== 2) throw new Error('First batch result incorrect');

    // 測試統計
    const stats = pipeline.getDetailedStats();
    if (stats.completed < 4) throw new Error('Completed count should be at least 4');

    return { 
      passed: 4, 
      processedCount,
      message: 'AsyncPipeline 處理功能正常' 
    };
  }

  /**
   * 📦 測試批次處理
   */
  async testBatchProcessing() {
    const processor = async (data, options) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return {
        id: options.batchIndex,
        doubled: data.number * 2,
        batchId: options.batchId
      };
    };

    const pipeline = createPipeline(processor).build();
    
    const items = Array.from({ length: 10 }, (_, i) => ({ number: i + 1 }));
    const results = await pipeline.processBatch(items);

    if (results.length !== 10) throw new Error('Should process all 10 items');
    
    // 檢查結果順序和內容
    for (let i = 0; i < results.length; i++) {
      const result = results[i].result;
      if (result.doubled !== (i + 1) * 2) {
        throw new Error(`Item ${i} result incorrect: expected ${(i + 1) * 2}, got ${result.doubled}`);
      }
    }

    return { passed: 11, message: '批次處理功能正常' };
  }

  /**
   * ❌ 測試錯誤處理
   */
  async testErrorHandling() {
    let callCount = 0;
    
    const faultyProcessor = async (data) => {
      callCount++;
      if (data.shouldFail) {
        throw new Error(`Intentional error for ${data.id}`);
      }
      return { success: true, id: data.id };
    };

    const pipeline = createPipeline(faultyProcessor)
      .setConcurrency(1)
      .build();

    // 測試成功案例
    const successResult = await pipeline.processItem({ id: 'success-1', shouldFail: false });
    if (!successResult.success) throw new Error('Success case should work');

    // 測試失敗案例
    try {
      await pipeline.processItem({ id: 'fail-1', shouldFail: true });
      throw new Error('Should have thrown an error');
    } catch (error) {
      if (error.message !== 'Intentional error for fail-1') {
        throw new Error('Wrong error message');
      }
    }

    return { passed: 2, callCount, message: '錯誤處理功能正常' };
  }

  /**
   * 🔄 測試重試機制
   */
  async testRetryMechanism() {
    let attemptCount = 0;
    
    const retryProcessor = async (_data) => {
      attemptCount++;
      if (attemptCount <= 2) {
        throw new Error(`Attempt ${attemptCount} failed`);
      }
      return { success: true, attempts: attemptCount };
    };

    const pipeline = createPipeline(retryProcessor).build();
    
    // 添加一個會重試的任務
    const task = pipeline.add('retry-test', { id: 'test' }, { maxRetries: 3 });
    
    // 等待任務完成或失敗
    await new Promise(resolve => {
      pipeline.on('taskCompleted', (completedTask) => {
        if (completedTask.id === 'retry-test') resolve();
      });
      pipeline.on('taskFailed', (failedTask) => {
        if (failedTask.id === 'retry-test') resolve();
      });
    });

    if (task.status !== 'completed') throw new Error('Task should eventually succeed');
    if (task.retryCount !== 2) throw new Error('Should have retried 2 times');
    if (attemptCount !== 3) throw new Error('Should have made 3 attempts total');

    return { passed: 3, attemptCount, message: '重試機制功能正常' };
  }

  /**
   * 📊 測試效能指標
   */
  async testPerformanceMetrics() {
    const processor = async (data) => {
      const delay = Math.random() * 20 + 10; // 10-30ms 隨機延遲
      await new Promise(resolve => setTimeout(resolve, delay));
      return { processed: data.id, delay };
    };

    const pipeline = createPipeline(processor)
      .setConcurrency(3)
      .build();

    // 處理一些項目來產生統計數據
    const items = Array.from({ length: 15 }, (_, i) => ({ id: i }));
    await pipeline.processBatch(items);

    const stats = pipeline.getDetailedStats();
    
    if (stats.completed !== 15) throw new Error('Should have completed 15 tasks');
    if (stats.avgDuration <= 0) throw new Error('Average duration should be positive');
    if (stats.throughput < 0) throw new Error('Throughput should be non-negative');

    return { 
      passed: 3, 
      avgDuration: stats.avgDuration,
      throughput: stats.throughput,
      message: '效能指標計算正常' 
    };
  }

  /**
   * 🎨 測試 Mermaid 整合
   */
  async testMermaidIntegration() {
    const pipeline = new MermaidProcessingPipeline({
      maxConcurrent: 2,
      batchSize: 3
    });

    // 測試簡單的 Python 程式碼
    const testFiles = {
      'main.py': `
def hello():
    print("Hello World")

def goodbye():
    print("Goodbye")
    hello()

if __name__ == "__main__":
    goodbye()
      `.trim()
    };

    const result = await pipeline.processProject(testFiles, {
      diagram: 'flowchart',
      projectId: 'test-project'
    });

    if (!result.success) {
      throw new Error(`Processing failed: ${result.error}`);
    }

    if (!result.code) throw new Error('Should generate Mermaid code');
    if (!result.code.includes('flowchart')) throw new Error('Should include flowchart directive');

    // 測試統計功能
    const stats = pipeline.getProcessingStats();
    if (stats.totalProcessed !== 1) throw new Error('Should record 1 processed project');

    return { 
      passed: 3, 
      codeLength: result.code.length,
      message: 'Mermaid 整合功能正常' 
    };
  }

  /**
   * 🏭 測試管線工廠
   */
  async testPipelineFactory() {
    // 測試不同類型的管線
    const standardPipeline = PipelineFactory.createMermaidPipeline();
    const highPerfPipeline = PipelineFactory.createHighPerformancePipeline(
      async (data) => ({ result: data })
    );
    const lowMemPipeline = PipelineFactory.createLowMemoryPipeline(
      async (data) => ({ result: data })
    );

    if (!(standardPipeline instanceof MermaidProcessingPipeline)) {
      throw new Error('Should create MermaidProcessingPipeline');
    }

    if (!(highPerfPipeline instanceof AsyncProcessingPipeline)) {
      throw new Error('Should create AsyncProcessingPipeline');
    }

    if (!(lowMemPipeline instanceof AsyncProcessingPipeline)) {
      throw new Error('Should create AsyncProcessingPipeline');
    }

    // 測試工廠設定的並行數量
    if (highPerfPipeline.maxConcurrent !== 8) {
      throw new Error('High performance pipeline should have maxConcurrent = 8');
    }

    if (lowMemPipeline.maxConcurrent !== 2) {
      throw new Error('Low memory pipeline should have maxConcurrent = 2');
    }

    return { passed: 5, message: '管線工廠功能正常' };
  }

  /**
   * 📊 列印測試摘要
   */
  printSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;

    console.log('📊 測試摘要:');
    console.log(`✅ 通過: ${passed}/${total}`);
    console.log(`❌ 失敗: ${failed}/${total}`);
    console.log(`📈 成功率: ${Math.round((passed / total) * 100)}%\n`);

    if (failed > 0) {
      console.log('❌ 失敗的測試:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.test}: ${r.error}`));
    }
  }
}

/**
 * 🎯 效能基準測試
 */
export class PipelinePerformanceBenchmark {
  async runBenchmarks() {
    console.log('🏎️ 開始效能基準測試...\n');

    const results = {
      concurrencyTest: await this.testConcurrencyPerformance(),
      batchSizeTest: await this.testBatchSizeOptimization(),
      memoryUsageTest: await this.testMemoryUsage(),
      scalabilityTest: await this.testScalability()
    };

    this.printBenchmarkResults(results);
    return results;
  }

  /**
   * 🚀 測試並行效能
   */
  async testConcurrencyPerformance() {
    const processor = async (data) => {
      await new Promise(resolve => setTimeout(resolve, 50)); // 固定 50ms 延遲
      return { id: data.id };
    };

    const concurrencies = [1, 2, 4, 8];
    const results = {};

    for (const concurrency of concurrencies) {
      const pipeline = createPipeline(processor)
        .setConcurrency(concurrency)
        .build();

      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      
      const startTime = performance.now();
      await pipeline.processBatch(items);
      const endTime = performance.now();

      results[concurrency] = {
        duration: endTime - startTime,
        throughput: 20 / ((endTime - startTime) / 1000)
      };
    }

    return results;
  }

  /**
   * 📦 測試批次大小最佳化
   */
  async testBatchSizeOptimization() {
    const processor = async (data) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { id: data.id };
    };

    const batchSizes = [1, 5, 10, 20, 50];
    const results = {};

    for (const batchSize of batchSizes) {
      const pipeline = createPipeline(processor)
        .setBatchSize(batchSize)
        .setConcurrency(4)
        .build();

      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      
      const startTime = performance.now();
      await pipeline.processBatch(items);
      const endTime = performance.now();

      results[batchSize] = {
        duration: endTime - startTime,
        throughput: 100 / ((endTime - startTime) / 1000)
      };
    }

    return results;
  }

  /**
   * 💾 測試記憶體使用
   */
  async testMemoryUsage() {
    // 這個測試需要在真實環境中運行才有意義
    // 這裡只是示範框架
    return {
      baseline: 'Memory usage testing requires real environment',
      note: 'Use process.memoryUsage() in Node.js environment'
    };
  }

  /**
   * 📈 測試擴展性
   */
  async testScalability() {
    const processor = async (data) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return { id: data.id };
    };

    const pipeline = createPipeline(processor)
      .setConcurrency(4)
      .build();

    const sizes = [10, 50, 100, 500];
    const results = {};

    for (const size of sizes) {
      const items = Array.from({ length: size }, (_, i) => ({ id: i }));
      
      const startTime = performance.now();
      await pipeline.processBatch(items);
      const endTime = performance.now();

      results[size] = {
        duration: endTime - startTime,
        throughputPerItem: (endTime - startTime) / size,
        itemsPerSecond: size / ((endTime - startTime) / 1000)
      };
    }

    return results;
  }

  /**
   * 📊 列印基準測試結果
   */
  printBenchmarkResults(results) {
    console.log('🏆 效能基準測試結果:\n');

    console.log('🚀 並行效能測試:');
    Object.entries(results.concurrencyTest).forEach(([concurrency, result]) => {
      console.log(`   ${concurrency} 線程: ${result.duration.toFixed(2)}ms (${result.throughput.toFixed(2)} items/sec)`);
    });

    console.log('\n📦 批次大小測試:');
    Object.entries(results.batchSizeTest).forEach(([batchSize, result]) => {
      console.log(`   批次 ${batchSize}: ${result.duration.toFixed(2)}ms (${result.throughput.toFixed(2)} items/sec)`);
    });

    console.log('\n📈 擴展性測試:');
    Object.entries(results.scalabilityTest).forEach(([size, result]) => {
      console.log(`   ${size} 項目: ${result.duration.toFixed(2)}ms (${result.itemsPerSecond.toFixed(2)} items/sec)`);
    });
  }
}

/**
 * 🎯 便利的測試執行器
 */
export async function runAsyncPipelineTests() {
  const tester = new AsyncPipelineTests();
  return await tester.runAllTests();
}

export async function runPerformanceBenchmarks() {
  const benchmark = new PipelinePerformanceBenchmark();
  return await benchmark.runBenchmarks();
}

// 如果直接執行此檔案，運行測試
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  runAsyncPipelineTests().then(() => {
    console.log('\n🏎️ 運行效能基準測試...');
    return runPerformanceBenchmarks();
  });
}

export default {
  AsyncPipelineTests,
  PipelinePerformanceBenchmark,
  runAsyncPipelineTests,
  runPerformanceBenchmarks
};