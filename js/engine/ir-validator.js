/**
 * 🔍 IR 驗證器與測試工具
 * 
 * 用於驗證 IR 結構完整性，測試轉換功能，並提供診斷資訊
 */

import { createIRConverter } from './unified-ir.js';

/**
 * 📋 IR 結構驗證器
 */
export class IRValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: false,
      enableWarnings: true,
      logVerbose: false,
      ...options
    };
    
    this.validationResults = {
      errors: [],
      warnings: [],
      info: [],
      metrics: {}
    };
  }

  /**
   * ✅ 驗證統一 IR 結構
   */
  validateUnifiedIR(project) {
    console.log('🔍 Validating unified IR structure...');
    this._resetResults();
    
    try {
      // 基本結構驗證
      this._validateProjectStructure(project);
      
      // 模組驗證
      this._validateModules(project.modules);
      
      // 圖結構驗證
      if (project.callGraph) {
        this._validateCallGraph(project.callGraph);
      }
      
      if (project.dependencyGraph) {
        this._validateDependencyGraph(project.dependencyGraph);
      }
      
      // 計算統計資料
      this._calculateMetrics(project);
      
      const isValid = this.validationResults.errors.length === 0;
      console.log(`${isValid ? '✅' : '❌'} IR validation ${isValid ? 'passed' : 'failed'}`);
      
      return {
        isValid,
        ...this.validationResults
      };
      
    } catch (error) {
      this.validationResults.errors.push(`Validation error: ${error.message}`);
      return {
        isValid: false,
        ...this.validationResults
      };
    }
  }

  /**
   * ✅ 驗證舊版 IR 結構
   */
  validateLegacyIR(legacyIR) {
    console.log('🔍 Validating legacy IR structure...');
    this._resetResults();
    
    try {
      // 基本結構檢查
      if (!legacyIR || typeof legacyIR !== 'object') {
        this.validationResults.errors.push('Legacy IR must be an object');
        return { isValid: false, ...this.validationResults };
      }
      
      // Entities 驗證
      this._validateLegacyEntities(legacyIR.entities);
      
      // Relations 驗證
      this._validateLegacyRelations(legacyIR.relations);
      
      // 參照完整性檢查
      this._validateLegacyReferences(legacyIR.entities, legacyIR.relations);
      
      const isValid = this.validationResults.errors.length === 0;
      console.log(`${isValid ? '✅' : '❌'} Legacy IR validation ${isValid ? 'passed' : 'failed'}`);
      
      return {
        isValid,
        ...this.validationResults
      };
      
    } catch (error) {
      this.validationResults.errors.push(`Legacy validation error: ${error.message}`);
      return {
        isValid: false,
        ...this.validationResults
      };
    }
  }

  /**
   * 🏗️ 驗證專案結構
   */
  _validateProjectStructure(project) {
    if (!project) {
      this.validationResults.errors.push('Project is null or undefined');
      return;
    }
    
    if (typeof project !== 'object') {
      this.validationResults.errors.push('Project must be an object');
      return;
    }
    
    // 必需欄位檢查
    const requiredFields = ['modules'];
    for (const field of requiredFields) {
      if (!(field in project)) {
        this.validationResults.errors.push(`Missing required field: ${field}`);
      }
    }
    
    // 選擇性欄位型別檢查
    if (project.fixNotes && !Array.isArray(project.fixNotes)) {
      this.validationResults.warnings.push('fixNotes should be an array');
    }
    
    if (project.parserMeta && typeof project.parserMeta !== 'object') {
      this.validationResults.warnings.push('parserMeta should be an object');
    }
  }

  /**
   * 📚 驗證模組集合
   */
  _validateModules(modules) {
    if (!modules || typeof modules !== 'object') {
      this.validationResults.errors.push('Modules must be an object');
      return;
    }
    
    const moduleNames = Object.keys(modules);
    if (moduleNames.length === 0) {
      this.validationResults.warnings.push('No modules found in project');
    }
    
    for (const [moduleName, module] of Object.entries(modules)) {
      this._validateSingleModule(moduleName, module);
    }
  }

  /**
   * 📄 驗證單一模組
   */
  _validateSingleModule(moduleName, module) {
    if (!module || typeof module !== 'object') {
      this.validationResults.errors.push(`Module ${moduleName} must be an object`);
      return;
    }
    
    // 必需欄位
    const requiredFields = ['name', 'path', 'classes', 'functions', 'imports'];
    for (const field of requiredFields) {
      if (!(field in module)) {
        this.validationResults.errors.push(`Module ${moduleName} missing field: ${field}`);
      }
    }
    
    // 陣列型別檢查
    const arrayFields = ['classes', 'functions', 'imports'];
    for (const field of arrayFields) {
      if (module[field] && !Array.isArray(module[field])) {
        this.validationResults.errors.push(`Module ${moduleName}.${field} must be an array`);
      }
    }
    
    // 驗證 classes
    if (Array.isArray(module.classes)) {
      module.classes.forEach((cls, index) => {
        this._validateClass(cls, `${moduleName}.classes[${index}]`);
      });
    }
    
    // 驗證 functions
    if (Array.isArray(module.functions)) {
      module.functions.forEach((func, index) => {
        this._validateFunction(func, `${moduleName}.functions[${index}]`);
      });
    }
  }

  /**
   * 🏛️ 驗證類別結構
   */
  _validateClass(cls, path) {
    if (!cls || typeof cls !== 'object') {
      this.validationResults.errors.push(`${path} must be an object`);
      return;
    }
    
    // 必需欄位
    const requiredFields = ['id', 'name', 'bases', 'attrs', 'methods', 'pos'];
    for (const field of requiredFields) {
      if (!(field in cls)) {
        this.validationResults.errors.push(`${path} missing field: ${field}`);
      }
    }
    
    // 陣列欄位檢查
    const arrayFields = ['bases', 'attrs', 'methods'];
    for (const field of arrayFields) {
      if (cls[field] && !Array.isArray(cls[field])) {
        this.validationResults.errors.push(`${path}.${field} must be an array`);
      }
    }
    
    // 驗證方法
    if (Array.isArray(cls.methods)) {
      cls.methods.forEach((method, index) => {
        this._validateFunction(method, `${path}.methods[${index}]`);
      });
    }
    
    // 驗證位置資訊
    if (cls.pos) {
      this._validatePosition(cls.pos, `${path}.pos`);
    }
  }

  /**
   * ⚙️ 驗證函數結構
   */
  _validateFunction(func, path) {
    if (!func || typeof func !== 'object') {
      this.validationResults.errors.push(`${path} must be an object`);
      return;
    }
    
    // 必需欄位
    const requiredFields = ['id', 'name', 'params', 'body', 'calls', 'pos'];
    for (const field of requiredFields) {
      if (!(field in func)) {
        this.validationResults.errors.push(`${path} missing field: ${field}`);
      }
    }
    
    // 陣列欄位檢查
    const arrayFields = ['params', 'body', 'calls'];
    for (const field of arrayFields) {
      if (func[field] && !Array.isArray(func[field])) {
        this.validationResults.errors.push(`${path}.${field} must be an array`);
      }
    }
    
    // 驗證位置資訊
    if (func.pos) {
      this._validatePosition(func.pos, `${path}.pos`);
    }
  }

  /**
   * 📍 驗證位置資訊
   */
  _validatePosition(pos, path) {
    if (!pos || typeof pos !== 'object') {
      this.validationResults.errors.push(`${path} must be an object`);
      return;
    }
    
    // 必需欄位
    if (!pos.file) {
      this.validationResults.errors.push(`${path} missing file field`);
    }
    
    if (!pos.line || typeof pos.line !== 'number') {
      this.validationResults.errors.push(`${path} missing or invalid line field`);
    }
    
    if (pos.endLine !== undefined && typeof pos.endLine !== 'number') {
      this.validationResults.warnings.push(`${path}.endLine should be a number`);
    }
  }

  /**
   * 📞 驗證呼叫圖
   */
  _validateCallGraph(callGraph) {
    if (!callGraph || typeof callGraph !== 'object') {
      this.validationResults.errors.push('Call graph must be an object');
      return;
    }
    
    if (!Array.isArray(callGraph.edges)) {
      this.validationResults.errors.push('Call graph edges must be an array');
      return;
    }
    
    callGraph.edges.forEach((edge, index) => {
      if (!edge.from || !edge.toName) {
        this.validationResults.errors.push(`Call graph edge ${index} missing required fields`);
      }
    });
  }

  /**
   * 🕷️ 驗證依賴圖
   */
  _validateDependencyGraph(dependencyGraph) {
    if (!dependencyGraph || typeof dependencyGraph !== 'object') {
      this.validationResults.errors.push('Dependency graph must be an object');
      return;
    }
    
    if (!Array.isArray(dependencyGraph.edges)) {
      this.validationResults.errors.push('Dependency graph edges must be an array');
      return;
    }
    
    dependencyGraph.edges.forEach((edge, index) => {
      if (!edge.from || !edge.to) {
        this.validationResults.errors.push(`Dependency graph edge ${index} missing required fields`);
      }
    });
  }

  /**
   * 📋 驗證舊版 entities
   */
  _validateLegacyEntities(entities) {
    if (!Array.isArray(entities)) {
      this.validationResults.errors.push('Legacy entities must be an array');
      return;
    }
    
    entities.forEach((entity, index) => {
      if (!entity.id || !entity.kind || !entity.name) {
        this.validationResults.errors.push(`Entity ${index} missing required fields (id, kind, name)`);
      }
    });
  }

  /**
   * 🔗 驗證舊版 relations
   */
  _validateLegacyRelations(relations) {
    if (!Array.isArray(relations)) {
      this.validationResults.errors.push('Legacy relations must be an array');
      return;
    }
    
    relations.forEach((relation, index) => {
      if (!relation.from || !relation.to || !relation.type) {
        this.validationResults.errors.push(`Relation ${index} missing required fields (from, to, type)`);
      }
    });
  }

  /**
   * 🔍 驗證舊版參照完整性
   */
  _validateLegacyReferences(entities, relations) {
    if (!Array.isArray(entities) || !Array.isArray(relations)) return;
    
    const entityIds = new Set(entities.map(e => e.id));
    
    relations.forEach((relation, index) => {
      // 檢查 from 參照
      if (!entityIds.has(relation.from)) {
        this.validationResults.warnings.push(`Relation ${index} references non-existent entity: ${relation.from}`);
      }
      
      // 對於某些關係類型，to 可能不是 entity ID
      if (relation.type === 'EXTENDS' || relation.type === 'IMPLEMENTS') {
        // 這些可能是外部類別名稱，不一定在 entities 中
      } else if (!entityIds.has(relation.to)) {
        this.validationResults.warnings.push(`Relation ${index} references non-existent entity: ${relation.to}`);
      }
    });
  }

  /**
   * 📊 計算 IR 統計資料
   */
  _calculateMetrics(project) {
    const metrics = {
      moduleCount: Object.keys(project.modules).length,
      totalClasses: 0,
      totalFunctions: 0,
      totalMethods: 0,
      totalImports: 0
    };
    
    for (const module of Object.values(project.modules)) {
      metrics.totalClasses += module.classes?.length || 0;
      metrics.totalFunctions += module.functions?.length || 0;
      metrics.totalImports += module.imports?.length || 0;
      
      for (const cls of module.classes || []) {
        metrics.totalMethods += cls.methods?.length || 0;
      }
    }
    
    this.validationResults.metrics = metrics;
  }

  /**
   * 🧹 重置驗證結果
   */
  _resetResults() {
    this.validationResults = {
      errors: [],
      warnings: [],
      info: [],
      metrics: {}
    };
  }

  /**
   * 📊 取得驗證報告
   */
  getValidationReport() {
    return {
      timestamp: new Date().toISOString(),
      summary: {
        errors: this.validationResults.errors.length,
        warnings: this.validationResults.warnings.length,
        info: this.validationResults.info.length
      },
      details: this.validationResults,
      isValid: this.validationResults.errors.length === 0
    };
  }
}

/**
 * 🧪 IR 測試套件
 */
export class IRTestSuite {
  constructor() {
    this.testResults = [];
  }

  /**
   * 🚀 執行完整的 IR 測試
   */
  async runFullTestSuite() {
    console.log('🧪 Running complete IR test suite...');
    this.testResults = [];
    
    const tests = [
      () => this._testUnifiedIRCreation(),
      () => this._testLegacyToUnifiedConversion(),
      () => this._testUnifiedToLegacyConversion(),
      () => this._testIRValidation(),
      () => this._testErrorHandling(),
      () => this._testPerformance()
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        this.testResults.push({
          test: test.name,
          status: 'FAILED',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return this._generateTestReport();
  }

  /**
   * 🏗️ 測試統一 IR 創建
   */
  _testUnifiedIRCreation() {
    console.log('  🔧 Testing unified IR creation...');
    
    const converter = createIRConverter();
    
    if (!converter.project) {
      throw new Error('Unified IR project not initialized');
    }
    
    if (!converter.project.modules) {
      throw new Error('Modules not initialized');
    }
    
    this.testResults.push({
      test: 'UnifiedIR Creation',
      status: 'PASSED',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 🔄 測試舊版到新版轉換
   */
  _testLegacyToUnifiedConversion() {
    console.log('  🔄 Testing legacy to unified conversion...');
    
    const sampleLegacyIR = {
      meta: { createdAt: new Date().toISOString() },
      entities: [
        {
          id: 'test.js:class:Sample',
          kind: 'class',
          name: 'Sample',
          file: 'test.js',
          line: 1
        }
      ],
      relations: []
    };

    const converter = createIRConverter();
    const unified = converter.convertLegacyIR(sampleLegacyIR);
    
    if (!unified.modules) {
      throw new Error('Conversion failed: no modules in result');
    }
    
    this.testResults.push({
      test: 'Legacy to Unified Conversion',
      status: 'PASSED',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 🔄 測試新版到舊版轉換
   */
  _testUnifiedToLegacyConversion() {
    console.log('  🔄 Testing unified to legacy conversion...');
    
    const sampleUnified = {
      modules: {
        'test': {
          name: 'test',
          path: 'test.js',
          classes: [{
            id: 'test:Sample',
            name: 'Sample',
            bases: [],
            attrs: [],
            methods: [],
            pos: { file: 'test.js', line: 1 }
          }],
          functions: [],
          imports: []
        }
      }
    };

    const converter = createIRConverter();
    const legacy = converter.convertToLegacyFormat(sampleUnified);
    
    if (!Array.isArray(legacy.entities) || !Array.isArray(legacy.relations)) {
      throw new Error('Conversion failed: invalid legacy format');
    }
    
    this.testResults.push({
      test: 'Unified to Legacy Conversion',
      status: 'PASSED',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * ✅ 測試 IR 驗證
   */
  _testIRValidation() {
    console.log('  ✅ Testing IR validation...');
    
    const validator = new IRValidator();
    
    // 測試有效的統一 IR
    const validUnified = {
      modules: {
        'test': {
          name: 'test',
          path: 'test.js',
          classes: [],
          functions: [],
          imports: []
        }
      }
    };
    
    const result = validator.validateUnifiedIR(validUnified);
    
    if (!result.isValid) {
      throw new Error(`Validation failed for valid IR: ${result.errors.join(', ')}`);
    }
    
    this.testResults.push({
      test: 'IR Validation',
      status: 'PASSED',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * ❌ 測試錯誤處理
   */
  _testErrorHandling() {
    console.log('  ❌ Testing error handling...');
    
    const converter = createIRConverter();
    
    try {
      // 測試無效的舊版 IR
      converter.convertLegacyIR({ invalid: 'data' });
      throw new Error('Should have thrown an error for invalid IR');
    } catch (error) {
      if (!error.message.includes('IR conversion failed')) {
        throw error;
      }
    }
    
    this.testResults.push({
      test: 'Error Handling',
      status: 'PASSED',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * ⚡ 測試效能
   */
  _testPerformance() {
    console.log('  ⚡ Testing performance...');
    
    const startTime = Date.now();
    const converter = createIRConverter();
    
    // 建立大型測試資料
    const largeIR = {
      meta: { createdAt: new Date().toISOString() },
      entities: [],
      relations: []
    };
    
    // 生成 1000 個 entities
    for (let i = 0; i < 1000; i++) {
      largeIR.entities.push({
        id: `entity-${i}`,
        kind: 'class',
        name: `Class${i}`,
        file: `file${i % 10}.js`,
        line: i
      });
    }
    
    const _unified = converter.convertLegacyIR(largeIR);
    const endTime = Date.now();
    
    const processingTime = endTime - startTime;
    
    if (processingTime > 5000) { // 5 秒限制
      throw new Error(`Performance test failed: took ${processingTime}ms (limit: 5000ms)`);
    }
    
    this.testResults.push({
      test: 'Performance',
      status: 'PASSED',
      duration: processingTime,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 📊 生成測試報告
   */
  _generateTestReport() {
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const total = this.testResults.length;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed,
        failed,
        successRate: total > 0 ? Math.round((passed / total) * 100) : 0
      },
      tests: this.testResults,
      isSuccess: failed === 0
    };

    console.log(`📊 Test Results: ${passed}/${total} passed (${report.summary.successRate}%)`);
    
    if (report.isSuccess) {
      console.log('✅ All IR tests passed!');
    } else {
      console.log('❌ Some IR tests failed');
      this.testResults.filter(r => r.status === 'FAILED').forEach(test => {
        console.log(`  ❌ ${test.test}: ${test.error}`);
      });
    }

    return report;
  }
}

/**
 * 🏭 便利函數：快速 IR 驗證
 */
export function validateIR(ir, options = {}) {
  const validator = new IRValidator(options);
  
  // 自動判斷 IR 類型
  if (ir.entities && ir.relations) {
    return validator.validateLegacyIR(ir);
  } else if (ir.modules) {
    return validator.validateUnifiedIR(ir);
  } else {
    return {
      isValid: false,
      errors: ['Unknown IR format'],
      warnings: [],
      info: [],
      metrics: {}
    };
  }
}

/**
 * 🧪 便利函數：快速測試
 */
export async function runIRTests() {
  const testSuite = new IRTestSuite();
  return await testSuite.runFullTestSuite();
}

// 瀏覽器環境全域暴露
if (typeof window !== 'undefined') {
  window.IRValidator = IRValidator;
  window.IRTestSuite = IRTestSuite;
  window.validateIR = validateIR;
  window.runIRTests = runIRTests;
}