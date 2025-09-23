/**
 * 🧪 錯誤上下文傳播測試
 * 
 * 測試 Problem 3: Error context propagation 的實現
 */

// 導入測試目標
import { 
  ErrorContext, 
  ErrorPropagationManager, 
  createErrorContext,
  propagateError,
  chainError,
  safeExecute
} from './js/engine/error-propagation.js';

/**
 * 🧪 測試框架
 */
class ErrorPropagationTestSuite {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      errors: []
    };
  }

  /**
   * 📝 添加測試
   */
  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  /**
   * ▶️ 運行所有測試
   */
  async runAllTests() {
    console.log('🧪 開始運行錯誤上下文傳播測試...\n');
    
    this.results = { passed: 0, failed: 0, total: 0, errors: [] };
    
    for (const test of this.tests) {
      await this.runSingleTest(test);
    }
    
    this.printResults();
    return this.results;
  }

  /**
   * ▶️ 運行單個測試
   */
  async runSingleTest({ name, testFn }) {
    this.results.total++;
    
    try {
      console.log(`🔬 運行測試: ${name}`);
      await testFn();
      this.results.passed++;
      console.log(`✅ 測試通過: ${name}\n`);
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({ test: name, error });
      console.error(`❌ 測試失敗: ${name}`);
      console.error(`   錯誤: ${error.message}\n`);
    }
  }

  /**
   * 📊 打印結果
   */
  printResults() {
    console.log('📊 測試結果統計:');
    console.log(`   總測試數: ${this.results.total}`);
    console.log(`   通過: ${this.results.passed} ✅`);
    console.log(`   失敗: ${this.results.failed} ❌`);
    console.log(`   成功率: ${Math.round((this.results.passed / this.results.total) * 100)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ 失敗的測試:');
      this.results.errors.forEach(({ test, error }) => {
        console.log(`   - ${test}: ${error.message}`);
      });
    }
  }

  /**
   * 🔍 斷言函數
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertNotNull(value, message) {
    if (value == null) {
      throw new Error(message || 'Value should not be null');
    }
  }

  assertInstanceOf(obj, cls, message) {
    if (!(obj instanceof cls)) {
      throw new Error(message || `Object should be instance of ${cls.name}`);
    }
  }
}

/**
 * 🧪 建立測試套件實例
 */
const testSuite = new ErrorPropagationTestSuite();

/**
 * Test 1: 錯誤上下文建立測試
 */
testSuite.addTest('錯誤上下文建立測試', () => {
  const context = new ErrorContext({
    message: 'Test error',
    code: 'TEST_ERROR',
    severity: 'error',
    stage: 'testing',
    component: 'test_component'
  });
  
  testSuite.assertInstanceOf(context, ErrorContext, '應該建立 ErrorContext 實例');
  testSuite.assertEqual(context.message, 'Test error', '錯誤訊息應該正確設定');
  testSuite.assertEqual(context.code, 'TEST_ERROR', '錯誤代碼應該正確設定');
  testSuite.assertEqual(context.severity, 'error', '嚴重程度應該正確設定');
  testSuite.assertEqual(context.source.stage, 'testing', '階段應該正確設定');
  testSuite.assertEqual(context.source.component, 'test_component', '組件應該正確設定');
  testSuite.assertNotNull(context.id, '應該自動生成錯誤 ID');
  testSuite.assertNotNull(context.timestamp, '應該自動設定時間戳');
});

/**
 * Test 2: 錯誤鏈建立測試
 */
testSuite.addTest('錯誤鏈建立測試', () => {
  const parentError = new ErrorContext({
    message: 'Parent error',
    code: 'PARENT_ERROR'
  });
  
  const childError = new ErrorContext({
    message: 'Child error',
    code: 'CHILD_ERROR'
  });
  
  childError.chainWith(parentError);
  
  testSuite.assertEqual(childError.chain.parent, parentError, '子錯誤應該連結到父錯誤');
  testSuite.assertEqual(childError.chain.root, parentError, '子錯誤應該指向根錯誤');
  testSuite.assertEqual(childError.chain.depth, 1, '子錯誤深度應該為 1');
  testSuite.assert(parentError.chain.children.includes(childError), '父錯誤應該包含子錯誤');
});

/**
 * Test 3: 錯誤傳播管理器測試
 */
testSuite.addTest('錯誤傳播管理器測試', () => {
  const manager = new ErrorPropagationManager();
  
  // 測試建立上下文
  const context = manager.createContext({
    message: 'Manager test error',
    code: 'MANAGER_TEST'
  });
  
  testSuite.assertInstanceOf(context, ErrorContext, '管理器應該建立錯誤上下文');
  testSuite.assert(manager.activeContexts.has(context.id), '管理器應該追蹤活躍上下文');
  
  // 測試傳播錯誤
  const propagatedContext = manager.propagateError(new Error('Propagation test'));
  testSuite.assertInstanceOf(propagatedContext, ErrorContext, '應該傳播錯誤並返回上下文');
  testSuite.assert(manager.errorHistory.length > 0, '應該記錄錯誤到歷史');
});

/**
 * Test 4: 錯誤處理器註冊與觸發測試
 */
testSuite.addTest('錯誤處理器註冊與觸發測試', () => {
  const manager = new ErrorPropagationManager();
  let handlerCalled = false;
  let handledContext = null;
  
  // 註冊處理器
  manager.registerHandler('TEST_HANDLER', (context) => {
    handlerCalled = true;
    handledContext = context;
  });
  
  // 觸發錯誤
  const context = manager.propagateError({
    message: 'Handler test',
    code: 'TEST_HANDLER'
  });
  
  testSuite.assert(handlerCalled, '錯誤處理器應該被調用');
  testSuite.assertEqual(handledContext, context, '處理器應該接收正確的上下文');
});

/**
 * Test 5: 錯誤攔截器測試
 */
testSuite.addTest('錯誤攔截器測試', () => {
  const manager = new ErrorPropagationManager();
  let interceptorCalled = false;
  
  // 註冊攔截器
  manager.registerInterceptor((context) => {
    interceptorCalled = true;
    // 修改錯誤嚴重程度
    context.severity = 'warning';
    return true; // 繼續傳播
  });
  
  const context = manager.propagateError({
    message: 'Interceptor test',
    severity: 'error'
  });
  
  testSuite.assert(interceptorCalled, '攔截器應該被調用');
  testSuite.assertEqual(context.severity, 'warning', '攔截器應該能修改錯誤');
});

/**
 * Test 6: 便利函數測試
 */
testSuite.addTest('便利函數測試', () => {
  // 測試 createErrorContext
  const context1 = createErrorContext({
    message: 'Convenience test 1'
  });
  testSuite.assertInstanceOf(context1, ErrorContext, 'createErrorContext 應該建立錯誤上下文');
  
  // 測試 propagateError
  const context2 = propagateError(new Error('Convenience test 2'));
  testSuite.assertInstanceOf(context2, ErrorContext, 'propagateError 應該傳播錯誤');
  
  // 測試 chainError
  const context3 = chainError(
    { message: 'Child convenience' },
    context2
  );
  testSuite.assertInstanceOf(context3, ErrorContext, 'chainError 應該建立錯誤鏈');
  testSuite.assertNotNull(context3.chain.parent, '鏈錯誤應該有父錯誤');
});

/**
 * Test 7: safeExecute 函數測試
 */
testSuite.addTest('safeExecute 函數測試', async () => {
  // 測試成功執行
  const successResult = await safeExecute(() => {
    return 'success';
  });
  testSuite.assertEqual(successResult, 'success', 'safeExecute 應該返回成功結果');
  
  // 測試錯誤捕獲
  try {
    await safeExecute(() => {
      throw new Error('Test error in safeExecute');
    });
    testSuite.assert(false, '應該拋出錯誤');
  } catch (error) {
    testSuite.assertInstanceOf(error, ErrorContext, 'safeExecute 應該包裝錯誤為 ErrorContext');
  }
});

/**
 * Test 8: 錯誤統計功能測試
 */
testSuite.addTest('錯誤統計功能測試', () => {
  const manager = new ErrorPropagationManager();
  
  // 產生一些測試錯誤
  manager.propagateError({ message: 'Error 1', code: 'TYPE_A', severity: 'error' });
  manager.propagateError({ message: 'Error 2', code: 'TYPE_A', severity: 'warning' });
  manager.propagateError({ message: 'Error 3', code: 'TYPE_B', severity: 'error' });
  
  const stats = manager.getStatistics();
  
  testSuite.assertEqual(stats.total, 3, '應該統計所有錯誤');
  testSuite.assertEqual(stats.byCode['TYPE_A'], 2, '應該正確統計 TYPE_A 錯誤');
  testSuite.assertEqual(stats.byCode['TYPE_B'], 1, '應該正確統計 TYPE_B 錯誤');
  testSuite.assertEqual(stats.bySeverity['error'], 2, '應該正確統計 error 級別');
  testSuite.assertEqual(stats.bySeverity['warning'], 1, '應該正確統計 warning 級別');
});

/**
 * Test 9: 錯誤恢復機制測試
 */
testSuite.addTest('錯誤恢復機制測試', () => {
  const manager = new ErrorPropagationManager();
  manager.config.enableAutoRecovery = true;
  
  const context = manager.propagateError({
    message: 'Recovery test',
    code: 'PARSE_ERROR' // 這個錯誤有後備策略
  });
  
  testSuite.assert(context.recovery.attempted, '應該嘗試恢復');
  testSuite.assertNotNull(context.recovery.strategy, '應該記錄恢復策略');
});

/**
 * Test 10: 錯誤報告生成測試
 */
testSuite.addTest('錯誤報告生成測試', () => {
  const context = new ErrorContext({
    message: 'Report test error',
    code: 'REPORT_TEST',
    file: 'test.js',
    line: 42,
    column: 10
  });
  
  context.addSuggestion('Try using a different approach');
  context.addContext('input', 'test input data');
  
  const report = context.getReport();
  
  testSuite.assertEqual(report.message, 'Report test error', '報告應該包含錯誤訊息');
  testSuite.assertEqual(report.code, 'REPORT_TEST', '報告應該包含錯誤代碼');
  testSuite.assertEqual(report.source.file, 'test.js', '報告應該包含檔案資訊');
  testSuite.assertEqual(report.source.line, 42, '報告應該包含行號');
  testSuite.assertEqual(report.source.column, 10, '報告應該包含列號');
  testSuite.assert(report.diagnostics.suggestions.length > 0, '報告應該包含建議');
  testSuite.assertEqual(report.context.input, 'test input data', '報告應該包含上下文');
  
  // 測試 toString 方法
  const stringReport = context.toString();
  testSuite.assert(stringReport.includes('REPORT_TEST'), 'toString 應該包含錯誤代碼');
  testSuite.assert(stringReport.includes('test.js:42:10'), 'toString 應該包含位置資訊');
  testSuite.assert(stringReport.includes('Try using a different approach'), 'toString 應該包含建議');
});

/**
 * 🚀 執行測試
 */
async function runErrorPropagationTests() {
  try {
    console.log('🔗 錯誤上下文傳播系統測試');
    console.log('='.repeat(50));
    
    const results = await testSuite.runAllTests();
    
    console.log('\n🎯 Problem 3 測試完成!');
    console.log(`✅ 成功率: ${Math.round((results.passed / results.total) * 100)}%`);
    
    return results;
  } catch (error) {
    console.error('❌ 測試執行失敗:', error);
    throw error;
  }
}

/**
 * 🧪 效能測試
 */
async function runPerformanceTests() {
  console.log('\n🚀 效能測試開始...');
  
  const manager = new ErrorPropagationManager();
  
  // 測試大量錯誤處理效能
  const startTime = performance.now();
  const errorCount = 1000;
  
  for (let i = 0; i < errorCount; i++) {
    manager.propagateError({
      message: `Performance test error ${i}`,
      code: `PERF_TEST_${i % 10}`,
      severity: i % 3 === 0 ? 'error' : 'warning'
    });
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  const errorsPerSecond = Math.round((errorCount / duration) * 1000);
  
  console.log(`📊 效能結果:`);
  console.log(`   處理 ${errorCount} 個錯誤`);
  console.log(`   總時間: ${duration.toFixed(2)}ms`);
  console.log(`   處理速度: ${errorsPerSecond} errors/sec`);
  
  // 測試錯誤鏈效能
  const chainStartTime = performance.now();
  let parentError = manager.createContext({ message: 'Root error' });
  
  for (let i = 0; i < 100; i++) {
    const childError = manager.chainError(
      { message: `Chain error ${i}` },
      parentError
    );
    parentError = childError;
  }
  
  const chainEndTime = performance.now();
  const chainDuration = chainEndTime - chainStartTime;
  
  console.log(`   錯誤鏈建立 (100層): ${chainDuration.toFixed(2)}ms`);
  
  return {
    errorProcessingSpeed: errorsPerSecond,
    chainCreationTime: chainDuration,
    overallDuration: duration
  };
}

// 瀏覽器環境暴露測試函數
if (typeof window !== 'undefined') {
  window.runErrorPropagationTests = runErrorPropagationTests;
  window.runPerformanceTests = runPerformanceTests;
  window.ErrorPropagationTestSuite = ErrorPropagationTestSuite;
}

// Node.js 環境導出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runErrorPropagationTests,
    runPerformanceTests,
    ErrorPropagationTestSuite
  };
}

export { 
  runErrorPropagationTests, 
  runPerformanceTests, 
  ErrorPropagationTestSuite 
};

// 如果作為主程序執行，自動運行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  runErrorPropagationTests()
    .then(() => runPerformanceTests())
    .catch(error => {
      console.error('❌ 測試執行失敗:', error);
      process.exit(1);
    });
}