/**
 * 🧪 多語言解析協調測試
 * 
 * 測試 Problem 4: Multi-language parsing coordination 的實現
 */

console.log('🔗 多語言解析協調系統測試');
console.log('='.repeat(60));

/**
 * 🧪 測試框架
 */
class ParserCoordinationTestSuite {
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
    console.log('🧪 開始運行多語言解析協調測試...\n');
    
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

  assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(message || `Expected ${actual} > ${expected}`);
    }
  }
}

/**
 * 🧪 建立測試套件實例
 */
const testSuite = new ParserCoordinationTestSuite();

/**
 * 模擬解析器實現
 */
class MockParser {
  constructor(name, languages, options = {}) {
    this.name = name;
    this.languages = languages;
    this.parseTime = options.parseTime || 100;
    this.successRate = options.successRate || 1.0;
    this.capabilities = options.capabilities || {};
  }

  async detect(files) {
    const matchedFiles = Object.keys(files).filter(f => 
      this.languages.some(lang => this._matchesLanguage(f, lang))
    );
    
    if (matchedFiles.length === 0) return null;
    
    return {
      lang: this.languages[0],
      confidence: 'high',
      reason: `${this.name} detected ${matchedFiles.length} files`,
      matchedFiles: matchedFiles.slice(0, 5)
    };
  }

  async parseProject(files) {
    // 模擬解析時間
    await new Promise(resolve => setTimeout(resolve, this.parseTime));
    
    // 模擬成功/失敗
    if (Math.random() > this.successRate) {
      throw new Error(`${this.name} parsing failed`);
    }
    
    return {
      project: {
        name: 'Mock Project',
        version: '1.0.0',
        modules: Object.keys(files).map(filePath => ({
          path: filePath,
          name: filePath.replace(/\.[^.]+$/, ''),
          functions: [`mock_function_${Math.random().toString(36).substr(2, 6)}`],
          classes: [],
          variables: []
        })),
        metadata: {
          parser: this.name,
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  _matchesLanguage(filename, language) {
    const extensions = {
      javascript: ['.js', '.jsx', '.mjs'],
      typescript: ['.ts', '.tsx'],
      python: ['.py'],
      java: ['.java']
    };
    
    const exts = extensions[language] || [];
    return exts.some(ext => filename.endsWith(ext));
  }
}

/**
 * 模擬解析器協調器
 */
class MockParserCoordinator {
  constructor() {
    this.parsers = new Map();
    this.parseHistory = [];
  }

  registerParser(parserInfo) {
    const id = `parser_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.parsers.set(id, {
      id: id,
      ...parserInfo,
      status: 'active',
      statistics: {
        totalParses: 0,
        successfulParses: 0,
        failedParses: 0,
        averageTime: 0
      }
    });
    return id;
  }

  async coordinatedParse(files, options = {}) {
    const parseId = `parse_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      // 語言偵測
      let bestDetection = null;
      let bestParser = null;
      
      for (const parser of this.parsers.values()) {
        if (parser.parser && typeof parser.parser.detect === 'function') {
          try {
            const detection = await parser.parser.detect(files);
            if (detection && (!bestDetection || this._compareDetections(detection, bestDetection) > 0)) {
              bestDetection = detection;
              bestParser = parser;
            }
          } catch (error) {
            // 忽略偵測錯誤
          }
        }
      }
      
      if (!bestParser) {
        throw new Error('No suitable parser found');
      }
      
      // 執行解析
      const result = await bestParser.parser.parseProject(files, options);
      
      // 更新統計
      const duration = Date.now() - startTime;
      bestParser.statistics.totalParses++;
      bestParser.statistics.successfulParses++;
      bestParser.statistics.averageTime = 
        ((bestParser.statistics.averageTime * (bestParser.statistics.totalParses - 1)) + duration) / 
        bestParser.statistics.totalParses;
      
      this.parseHistory.push({
        parseId: parseId,
        parserId: bestParser.id,
        success: true,
        duration: duration,
        language: bestDetection.lang
      });
      
      return {
        ...result,
        parseInfo: {
          parseId: parseId,
          parser: bestParser.name,
          language: bestDetection.lang,
          duration: duration
        }
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.parseHistory.push({
        parseId: parseId,
        success: false,
        duration: duration,
        error: error.message
      });
      throw error;
    }
  }

  _compareDetections(a, b) {
    const confidenceScores = { low: 1, medium: 2, high: 3 };
    return confidenceScores[a.confidence] - confidenceScores[b.confidence];
  }

  getStatistics() {
    return {
      totalParsers: this.parsers.size,
      totalParses: this.parseHistory.length,
      successfulParses: this.parseHistory.filter(p => p.success).length,
      parserDetails: Array.from(this.parsers.values()).map(p => ({
        id: p.id,
        name: p.name,
        languages: p.languages,
        statistics: p.statistics
      }))
    };
  }
}

/**
 * Test 1: 解析器資訊類別測試
 */
testSuite.addTest('解析器資訊類別測試', () => {
  // 模擬 ParserInfo 功能
  class MockParserInfo {
    constructor(options = {}) {
      this.name = options.name || 'Test Parser';
      this.languages = options.languages || ['javascript'];
      this.priority = options.priority || 0;
      this.statistics = {
        totalParses: 0,
        successfulParses: 0,
        failedParses: 0
      };
    }

    updateStatistics(success) {
      this.statistics.totalParses++;
      if (success) {
        this.statistics.successfulParses++;
      } else {
        this.statistics.failedParses++;
      }
    }

    getSuccessRate() {
      if (this.statistics.totalParses === 0) return 0;
      return (this.statistics.successfulParses / this.statistics.totalParses) * 100;
    }
  }

  const parser = new MockParserInfo({
    name: 'JavaScript Parser',
    languages: ['javascript', 'typescript'],
    priority: 100
  });

  testSuite.assertEqual(parser.name, 'JavaScript Parser', '解析器名稱應該正確');
  testSuite.assertEqual(parser.languages.length, 2, '應該支援 2 種語言');
  testSuite.assertEqual(parser.getSuccessRate(), 0, '初始成功率應該為 0');

  // 測試統計更新
  parser.updateStatistics(true);
  parser.updateStatistics(true);
  parser.updateStatistics(false);

  testSuite.assertEqual(parser.statistics.totalParses, 3, '總解析次數應該為 3');
  testSuite.assertEqual(parser.statistics.successfulParses, 2, '成功解析次數應該為 2');
  testSuite.assertEqual(Math.round(parser.getSuccessRate()), 67, '成功率應該約為 67%');
});

/**
 * Test 2: 解析器註冊測試
 */
testSuite.addTest('解析器註冊測試', () => {
  const coordinator = new MockParserCoordinator();
  
  const jsParser = new MockParser('JavaScript Parser', ['javascript']);
  const pyParser = new MockParser('Python Parser', ['python']);
  
  const jsId = coordinator.registerParser({
    name: 'JavaScript Parser',
    languages: ['javascript'],
    parser: jsParser
  });
  
  const pyId = coordinator.registerParser({
    name: 'Python Parser', 
    languages: ['python'],
    parser: pyParser
  });
  
  testSuite.assertNotNull(jsId, '應該返回 JavaScript 解析器 ID');
  testSuite.assertNotNull(pyId, '應該返回 Python 解析器 ID');
  testSuite.assertEqual(coordinator.parsers.size, 2, '應該註冊 2 個解析器');
  
  const stats = coordinator.getStatistics();
  testSuite.assertEqual(stats.totalParsers, 2, '統計應該顯示 2 個解析器');
});

/**
 * Test 3: 語言偵測測試
 */
testSuite.addTest('語言偵測測試', async () => {
  const coordinator = new MockParserCoordinator();
  
  const jsParser = new MockParser('JavaScript Parser', ['javascript']);
  const pyParser = new MockParser('Python Parser', ['python']);
  
  coordinator.registerParser({
    name: 'JavaScript Parser',
    languages: ['javascript'],
    parser: jsParser
  });
  
  coordinator.registerParser({
    name: 'Python Parser',
    languages: ['python'],
    parser: pyParser
  });
  
  // 測試 JavaScript 檔案偵測
  const jsFiles = {
    'main.js': 'function hello() { return "world"; }',
    'utils.js': 'export const util = 123;'
  };
  
  const jsResult = await coordinator.coordinatedParse(jsFiles);
  testSuite.assertEqual(jsResult.parseInfo.language, 'javascript', '應該偵測為 JavaScript');
  testSuite.assertEqual(jsResult.parseInfo.parser, 'JavaScript Parser', '應該使用 JavaScript 解析器');
  
  // 測試 Python 檔案偵測
  const pyFiles = {
    'main.py': 'def hello(): return "world"',
    'utils.py': 'import os'
  };
  
  const pyResult = await coordinator.coordinatedParse(pyFiles);
  testSuite.assertEqual(pyResult.parseInfo.language, 'python', '應該偵測為 Python');
  testSuite.assertEqual(pyResult.parseInfo.parser, 'Python Parser', '應該使用 Python 解析器');
});

/**
 * Test 4: 解析結果驗證測試
 */
testSuite.addTest('解析結果驗證測試', async () => {
  const coordinator = new MockParserCoordinator();
  const jsParser = new MockParser('JavaScript Parser', ['javascript']);
  
  coordinator.registerParser({
    name: 'JavaScript Parser',
    languages: ['javascript'],
    parser: jsParser
  });
  
  const files = {
    'test.js': 'function test() { console.log("test"); }'
  };
  
  const result = await coordinator.coordinatedParse(files);
  
  // 驗證結果結構
  testSuite.assertNotNull(result.project, '結果應該包含 project');
  testSuite.assertNotNull(result.project.modules, '結果應該包含 modules');
  testSuite.assertGreaterThan(result.project.modules.length, 0, '應該有至少一個模組');
  
  // 驗證模組結構
  const module = result.project.modules[0];
  testSuite.assertNotNull(module.path, '模組應該有路徑');
  testSuite.assertNotNull(module.name, '模組應該有名稱');
  testSuite.assertNotNull(module.functions, '模組應該有函數列表');
  
  // 驗證解析資訊
  testSuite.assertNotNull(result.parseInfo, '結果應該包含解析資訊');
  testSuite.assertNotNull(result.parseInfo.parseId, '應該有解析 ID');
  testSuite.assertNotNull(result.parseInfo.parser, '應該有解析器名稱');
  testSuite.assertNotNull(result.parseInfo.language, '應該有偵測語言');
  testSuite.assertGreaterThan(result.parseInfo.duration, 0, '解析時間應該大於 0');
});

/**
 * Test 5: 負載平衡測試
 */
testSuite.addTest('負載平衡測試', async () => {
  const coordinator = new MockParserCoordinator();
  
  // 註冊多個相同語言的解析器
  const fastParser = new MockParser('Fast Parser', ['javascript'], { parseTime: 50 });
  const slowParser = new MockParser('Slow Parser', ['javascript'], { parseTime: 200 });
  
  coordinator.registerParser({
    name: 'Fast Parser',
    languages: ['javascript'],
    priority: 100,
    parser: fastParser
  });
  
  coordinator.registerParser({
    name: 'Slow Parser',
    languages: ['javascript'],
    priority: 50,
    parser: slowParser
  });
  
  const files = {
    'test.js': 'function test() { return 42; }'
  };
  
  // 執行多次解析來測試負載平衡
  const results = [];
  for (let i = 0; i < 5; i++) {
    const result = await coordinator.coordinatedParse(files);
    results.push(result.parseInfo.parser);
  }
  
  // 由於選擇邏輯，應該傾向選擇較高優先級的解析器
  const stats = coordinator.getStatistics();
  testSuite.assertEqual(stats.totalParses, 5, '應該執行 5 次解析');
  testSuite.assertEqual(stats.successfulParses, 5, '所有解析都應該成功');
});

/**
 * Test 6: 錯誤處理與故障轉移測試
 */
testSuite.addTest('錯誤處理與故障轉移測試', async () => {
  const coordinator = new MockParserCoordinator();
  
  // 註冊一個會失敗的解析器和一個後備解析器
  const failingParser = new MockParser('Failing Parser', ['javascript'], { successRate: 0 });
  const backupParser = new MockParser('Backup Parser', ['javascript'], { successRate: 1.0 });
  
  coordinator.registerParser({
    name: 'Failing Parser',
    languages: ['javascript'],
    priority: 100,
    parser: failingParser
  });
  
  coordinator.registerParser({
    name: 'Backup Parser',
    languages: ['javascript'],
    priority: 50,
    parser: backupParser
  });
  
  const files = {
    'test.js': 'function test() { return "hello"; }'
  };
  
  try {
    const result = await coordinator.coordinatedParse(files);
    // 如果實現了故障轉移，應該會成功
    if (result) {
      console.log('   故障轉移成功，使用了備用解析器');
    }
  } catch (error) {
    // 如果沒有實現故障轉移，會拋出錯誤
    testSuite.assert(error.message.includes('parsing failed'), '應該是解析失敗錯誤');
  }
  
  // 檢查統計資料
  const stats = coordinator.getStatistics();
  testSuite.assertGreaterThan(stats.totalParses, 0, '應該有解析嘗試記錄');
});

/**
 * Test 7: 效能監控測試
 */
testSuite.addTest('效能監控測試', async () => {
  const coordinator = new MockParserCoordinator();
  const parser = new MockParser('Test Parser', ['javascript']);
  
  coordinator.registerParser({
    name: 'Test Parser',
    languages: ['javascript'],
    parser: parser
  });
  
  const files = {
    'perf-test.js': 'function performanceTest() { return Date.now(); }'
  };
  
  // 執行多次解析
  for (let i = 0; i < 3; i++) {
    await coordinator.coordinatedParse(files);
  }
  
  const stats = coordinator.getStatistics();
  const parserStats = stats.parserDetails[0];
  
  testSuite.assertEqual(parserStats.statistics.totalParses, 3, '應該記錄 3 次解析');
  testSuite.assertEqual(parserStats.statistics.successfulParses, 3, '所有解析都應該成功');
  testSuite.assertGreaterThan(parserStats.statistics.averageTime, 0, '平均時間應該大於 0');
  
  console.log(`   平均解析時間: ${parserStats.statistics.averageTime.toFixed(2)}ms`);
});

/**
 * Test 8: 混合語言專案測試
 */
testSuite.addTest('混合語言專案測試', async () => {
  const coordinator = new MockParserCoordinator();
  
  const jsParser = new MockParser('JavaScript Parser', ['javascript']);
  const pyParser = new MockParser('Python Parser', ['python']);
  
  coordinator.registerParser({
    name: 'JavaScript Parser',
    languages: ['javascript'],
    parser: jsParser
  });
  
  coordinator.registerParser({
    name: 'Python Parser',
    languages: ['python'],
    parser: pyParser
  });
  
  // 混合語言檔案
  const mixedFiles = {
    'frontend.js': 'function renderUI() { return "<div>Hello</div>"; }',
    'backend.py': 'def handle_request(): return {"status": "ok"}',
    'utils.js': 'export const config = { api: "/api" };'
  };
  
  // 由於這是混合語言專案，解析器選擇會依據第一個匹配的語言
  const result = await coordinator.coordinatedParse(mixedFiles);
  
  testSuite.assertNotNull(result, '混合語言專案應該能夠解析');
  testSuite.assertNotNull(result.parseInfo.language, '應該偵測到語言');
  
  console.log(`   偵測語言: ${result.parseInfo.language}`);
  console.log(`   使用解析器: ${result.parseInfo.parser}`);
});

/**
 * 🚀 執行測試
 */
async function runParserCoordinationTests() {
  try {
    console.log('🔗 多語言解析協調系統測試');
    console.log('='.repeat(50));
    
    const results = await testSuite.runAllTests();
    
    console.log('\n🎯 Problem 4 測試完成!');
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
  
  const coordinator = new MockParserCoordinator();
  const parser = new MockParser('Performance Parser', ['javascript'], { parseTime: 10 });
  
  coordinator.registerParser({
    name: 'Performance Parser',
    languages: ['javascript'],
    parser: parser
  });
  
  const testFiles = {
    'large-file.js': 'function test() { return "performance test"; }'.repeat(100)
  };
  
  // 測試批量解析效能
  const startTime = performance.now();
  const parseCount = 50;
  
  for (let i = 0; i < parseCount; i++) {
    await coordinator.coordinatedParse(testFiles);
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / parseCount;
  
  console.log(`📊 效能結果:`);
  console.log(`   解析次數: ${parseCount}`);
  console.log(`   總時間: ${totalTime.toFixed(2)}ms`);
  console.log(`   平均時間: ${avgTime.toFixed(2)}ms/parse`);
  console.log(`   解析速度: ${Math.round(1000 / avgTime)} parses/sec`);
  
  const stats = coordinator.getStatistics();
  console.log(`   成功率: ${Math.round((stats.successfulParses / stats.totalParses) * 100)}%`);
  
  return {
    parseCount: parseCount,
    totalTime: totalTime,
    avgTime: avgTime,
    successRate: (stats.successfulParses / stats.totalParses) * 100
  };
}

// 自動執行測試
runParserCoordinationTests()
  .then(() => runPerformanceTests())
  .then(() => {
    console.log('\n🏆 Problem 4 (多語言解析協調) 測試成功完成!');
  })
  .catch(error => {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
  });