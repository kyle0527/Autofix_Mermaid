/**
 * 🔄 IR 結構重新設計與統一方案
 * 
 * Problem 2: IR structure redesign
 * 
 * 📋 問題分析：
 * - 系統中存在兩套不同的 IR 結構定義
 * - 新版 (TypeScript): IRProject/IRModule - 完整、型別安全
 * - 舊版 (JavaScript): entities/relations - 簡單、靈活  
 * - 不同解析器產生的 IR 格式差異導致後續處理困難
 * - 缺乏統一的 IR 接口與轉換機制
 * 
 * 🎯 解決目標：
 * 1. 統一 IR 結構規範 - 以新版 TypeScript 定義為基準
 * 2. 實現 IR 標準化轉換器 - 舊版→新版自動轉換
 * 3. 建立 IR 驗證機制 - 確保 IR 結構完整性
 * 4. 優化 IR 處理效能 - 減少轉換開銷
 * 5. 保持向後相容性 - 不破壞現有功能
 */

/**
 * 🏗️ 統一 IR 結構 (Based on TypeScript definitions)
 */
export class UnifiedIR {
  constructor(options = {}) {
    this.version = '2.0.0';
    this.createdAt = new Date().toISOString();
    this.options = {
      enableValidation: true,
      enableMetrics: true,
      legacyCompatibility: true,
      ...options
    };
    
    // 統一的 IR 結構
    this.project = {
      modules: {},
      fixNotes: [],
      callGraph: null,
      dependencyGraph: null,
      parserMeta: null
    };
    
    // 效能監控
    this.metrics = {
      conversions: 0,
      validations: 0,
      errors: 0,
      processingTime: 0
    };
    
    // 向後相容性支援
    if (this.options.legacyCompatibility) {
      this.legacy = {
        entities: [],
        relations: [],
        meta: { createdAt: this.createdAt }
      };
    }
  }

  /**
   * 🔄 從舊版 IR 轉換到新版 IR
   */
  convertLegacyIR(legacyIR) {
    console.log('🔄 Converting legacy IR to unified format...');
    const startTime = Date.now();
    
    try {
      // 驗證舊版 IR 結構
      this._validateLegacyIR(legacyIR);
      
      // 轉換過程
      const converted = this._performLegacyConversion(legacyIR);
      
      // 驗證轉換結果
      if (this.options.enableValidation) {
        this._validateUnifiedIR(converted);
      }
      
      const processingTime = Date.now() - startTime;
      this.metrics.conversions++;
      this.metrics.processingTime += processingTime;
      
      console.log(`✅ Legacy IR converted in ${processingTime}ms`);
      return converted;
      
    } catch (error) {
      this.metrics.errors++;
      console.error('❌ Legacy IR conversion failed:', error);
      throw new Error(`IR conversion failed: ${error.message}`);
    }
  }

  /**
   * 🔍 驗證舊版 IR 結構
   */
  _validateLegacyIR(ir) {
    if (!ir || typeof ir !== 'object') {
      throw new Error('Invalid legacy IR: must be an object');
    }
    
    if (!Array.isArray(ir.entities)) {
      throw new Error('Invalid legacy IR: entities must be an array');
    }
    
    if (!Array.isArray(ir.relations)) {
      throw new Error('Invalid legacy IR: relations must be an array');
    }
    
    // 驗證 entities 結構
    for (const entity of ir.entities) {
      if (!entity.id || !entity.kind || !entity.name) {
        throw new Error(`Invalid entity: missing required fields (id, kind, name)`);
      }
    }
    
    // 驗證 relations 結構
    for (const relation of ir.relations) {
      if (!relation.from || !relation.to || !relation.type) {
        throw new Error(`Invalid relation: missing required fields (from, to, type)`);
      }
    }
  }

  /**
   * 🔧 執行舊版到新版的轉換
   */
  _performLegacyConversion(legacyIR) {
    const project = {
      modules: {},
      fixNotes: [`Converted from legacy IR format at ${new Date().toISOString()}`],
      callGraph: null,
      dependencyGraph: null,
      parserMeta: {
        implementation: 'legacy-converter',
        runtime: typeof window !== 'undefined' ? 'browser' : 'node',
        details: {
          originalFormat: 'entities-relations',
          conversionVersion: this.version,
          entityCount: legacyIR.entities.length,
          relationCount: legacyIR.relations.length
        }
      }
    };

    // 按檔案分組 entities
    const entityGroups = this._groupEntitiesByFile(legacyIR.entities);
    
    // 為每個檔案建立 IRModule
    for (const [filePath, entities] of Object.entries(entityGroups)) {
      const moduleName = this._filePathToModuleName(filePath);
      const module = this._createModuleFromEntities(moduleName, filePath, entities, legacyIR.relations);
      project.modules[moduleName] = module;
    }

    // 建立依賴圖
    project.dependencyGraph = this._buildDependencyGraph(legacyIR);
    
    // 建立呼叫圖
    project.callGraph = this._buildCallGraph(legacyIR);

    return project;
  }

  /**
   * 📂 按檔案分組 entities
   */
  _groupEntitiesByFile(entities) {
    const groups = {};
    
    for (const entity of entities) {
      const filePath = entity.file || entity.data?.file || 'unknown.js';
      if (!groups[filePath]) {
        groups[filePath] = [];
      }
      groups[filePath].push(entity);
    }
    
    return groups;
  }

  /**
   * 📄 從檔案路徑生成模組名
   */
  _filePathToModuleName(filePath) {
    if (filePath === 'unknown.js') return 'unknown';
    
    return filePath
      .replace(/\\/g, '/')  // 統一路徑分隔符
      .replace(/^.*\//, '')  // 移除路徑部分，只保留檔名
      .replace(/\.[^.]+$/, '');  // 移除副檔名
  }

  /**
   * 🏗️ 從 entities 建立 IRModule
   */
  _createModuleFromEntities(moduleName, filePath, entities, relations) {
    const classes = [];
    const functions = [];
    const imports = new Set();

    for (const entity of entities) {
      switch (entity.kind) {
        case 'class':
          classes.push(this._convertEntityToIRClass(entity, relations));
          break;
        case 'function':
        case 'method':
          functions.push(this._convertEntityToIRFunction(entity, relations));
          break;
        case 'import':
          if (entity.name) imports.add(entity.name);
          break;
      }
    }

    return {
      name: moduleName,
      path: filePath,
      classes,
      functions,
      imports: Array.from(imports)
    };
  }

  /**
   * 🏛️ 轉換 entity 為 IRClass
   */
  _convertEntityToIRClass(entity, relations) {
    // 找出繼承關係
    const bases = relations
      .filter(r => r.from === entity.id && (r.type === 'EXTENDS' || r.type === 'IMPLEMENTS'))
      .map(r => {
        // 從關係中找出目標類別名稱 - 這裡需要找到目標 entity
        // 暫時使用關係的 to 字段，後續可以加強查詢邏輯
        return r.to;
      });

    // 找出方法（如果有相關的 method entities）
    // 注意：這裡需要從完整的 entities 陣列中查找，暫時返回空陣列
    const methods = [];

    return {
      id: entity.id,
      name: entity.name,
      bases,
      attrs: entity.data?.attrs || [],
      methods,
      pos: this._extractPosition(entity),
      doc: entity.data?.doc || undefined
    };
  }

  /**
   * ⚙️ 轉換 entity 為 IRFunction
   */
  _convertEntityToIRFunction(entity, relations) {
    // 找出函數呼叫關係
    const calls = relations
      .filter(r => r.from === entity.id && r.type === 'CALLS')
      .map(r => r.to);

    return {
      id: entity.id,
      name: entity.name,
      params: entity.data?.params || [],
      body: [], // 舊版 IR 通常沒有詳細的 body 資訊
      calls,
      pos: this._extractPosition(entity),
      doc: entity.data?.doc || undefined
    };
  }

  /**
   * 📍 提取位置資訊
   */
  _extractPosition(entity) {
    return {
      file: entity.file || entity.data?.file || 'unknown',
      line: entity.line || entity.data?.line || 1,
      endLine: entity.data?.endLine || undefined
    };
  }

  /**
   * 🔍 根據 ID 找尋 entity (輔助函數)
   */
  _findEntityById(id, entities) {
    // 在完整的 entities 陣列中根據 ID 尋找對應的 entity
    return entities ? entities.find(e => e.id === id) : null;
  }

  /**
   * 🕷️ 建立依賴圖
   */
  _buildDependencyGraph(legacyIR) {
    const edges = [];
    
    for (const relation of legacyIR.relations) {
      if (relation.type === 'IMPORTS' || relation.type === 'DEPENDS_ON') {
        edges.push({
          from: relation.from,
          to: relation.to,
          symbols: relation.data?.symbols || [],
          isExternal: relation.data?.isExternal || false
        });
      }
    }
    
    return { edges };
  }

  /**
   * 📞 建立呼叫圖
   */
  _buildCallGraph(legacyIR) {
    const edges = [];
    
    for (const relation of legacyIR.relations) {
      if (relation.type === 'CALLS') {
        edges.push({
          from: relation.from,
          toName: relation.to,
          toId: relation.data?.resolvedId || undefined
        });
      }
    }
    
    return { edges };
  }

  /**
   * ✅ 驗證統一 IR 結構
   */
  _validateUnifiedIR(project) {
    if (this.options.enableValidation) {
      this.metrics.validations++;
      
      if (!project || typeof project !== 'object') {
        throw new Error('Invalid unified IR: must be an object');
      }
      
      if (!project.modules || typeof project.modules !== 'object') {
        throw new Error('Invalid unified IR: modules must be an object');
      }
      
      // 驗證每個模組
      for (const [moduleName, module] of Object.entries(project.modules)) {
        this._validateModule(moduleName, module);
      }
      
      console.log('✅ Unified IR validation passed');
    }
  }

  /**
   * 📝 驗證模組結構
   */
  _validateModule(moduleName, module) {
    if (!module.name || !module.path) {
      throw new Error(`Invalid module ${moduleName}: missing name or path`);
    }
    
    if (!Array.isArray(module.classes)) {
      throw new Error(`Invalid module ${moduleName}: classes must be an array`);
    }
    
    if (!Array.isArray(module.functions)) {
      throw new Error(`Invalid module ${moduleName}: functions must be an array`);
    }
    
    if (!Array.isArray(module.imports)) {
      throw new Error(`Invalid module ${moduleName}: imports must be an array`);
    }
  }

  /**
   * 🔄 雙向轉換：新版 IR → 舊版 IR (向後相容性)
   */
  convertToLegacyFormat(unifiedProject) {
    console.log('🔄 Converting unified IR to legacy format for compatibility...');
    
    const legacyIR = {
      meta: { 
        createdAt: new Date().toISOString(),
        convertedFrom: 'unified-format',
        version: this.version
      },
      entities: [],
      relations: []
    };

    // 轉換模組為 entities 和 relations
    for (const [moduleName, module] of Object.entries(unifiedProject.modules)) {
      // 轉換 classes
      for (const cls of module.classes) {
        legacyIR.entities.push({
          id: cls.id,
          kind: 'class',
          name: cls.name,
          file: cls.pos?.file || module.path,
          line: cls.pos?.line || 1,
          data: {
            attrs: cls.attrs,
            doc: cls.doc
          }
        });

        // 轉換繼承關係
        for (const base of cls.bases || []) {
          legacyIR.relations.push({
            from: cls.id,
            to: base,
            type: 'EXTENDS'
          });
        }

        // 轉換方法
        for (const method of cls.methods || []) {
          legacyIR.entities.push({
            id: method.id,
            kind: 'method',
            name: method.name,
            file: method.pos?.file || module.path,
            line: method.pos?.line || 1,
            data: {
              params: method.params,
              doc: method.doc
            }
          });

          legacyIR.relations.push({
            from: method.id,
            to: cls.id,
            type: 'BELONGS_TO'
          });
        }
      }

      // 轉換 functions
      for (const func of module.functions) {
        legacyIR.entities.push({
          id: func.id,
          kind: 'function',
          name: func.name,
          file: func.pos?.file || module.path,
          line: func.pos?.line || 1,
          data: {
            params: func.params,
            doc: func.doc
          }
        });

        // 轉換函數呼叫
        for (const call of func.calls || []) {
          legacyIR.relations.push({
            from: func.id,
            to: call,
            type: 'CALLS'
          });
        }
      }

      // 轉換 imports
      for (const importName of module.imports) {
        legacyIR.entities.push({
          id: `${moduleName}:import:${importName}`,
          kind: 'import',
          name: importName,
          file: module.path,
          line: 1
        });
      }
    }

    return legacyIR;
  }

  /**
   * 📊 取得轉換統計資料
   */
  getMetrics() {
    return {
      ...this.metrics,
      efficiency: this.metrics.conversions > 0 ? 
        (this.metrics.processingTime / this.metrics.conversions).toFixed(2) + 'ms/conversion' : 
        'N/A'
    };
  }

  /**
   * 🧪 測試 IR 轉換功能
   */
  static async runConversionTest() {
    console.log('🧪 Testing IR conversion functionality...');
    
    const converter = new UnifiedIR();
    
    // 測試用的舊版 IR
    const sampleLegacyIR = {
      meta: { createdAt: new Date().toISOString() },
      entities: [
        {
          id: 'test.js:class:TestClass',
          kind: 'class',
          name: 'TestClass',
          file: 'test.js',
          line: 1,
          data: { attrs: ['value'], doc: 'Test class' }
        },
        {
          id: 'test.js:method:getValue',
          kind: 'method',
          name: 'getValue',
          file: 'test.js',
          line: 5,
          data: { params: [], doc: 'Get value method' }
        }
      ],
      relations: [
        {
          from: 'test.js:method:getValue',
          to: 'test.js:class:TestClass',
          type: 'BELONGS_TO'
        }
      ]
    };

    try {
      // 測試舊版→新版轉換
      const unified = converter.convertLegacyIR(sampleLegacyIR);
      console.log('✅ Legacy → Unified conversion successful');
      
      // 測試新版→舊版轉換
      const backToLegacy = converter.convertToLegacyFormat(unified);
      console.log('✅ Unified → Legacy conversion successful');
      
      // 顯示統計
      const metrics = converter.getMetrics();
      console.log('📊 Conversion metrics:', metrics);
      
      return {
        success: true,
        unified,
        legacy: backToLegacy,
        metrics
      };
      
    } catch (error) {
      console.error('❌ IR conversion test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * �️ 從文本創建 UnifiedIR
 */
UnifiedIR.fromText = function(text, diagramType = 'auto') {
  const ir = new UnifiedIR();
  
  // 基本屬性設置
  ir.originalText = text;
  ir.diagramType = diagramType;
  ir.hash = btoa(text).substring(0, 16); // 簡單哈希
  
  // 創建基本模組結構
  ir.project.modules['main'] = {
    name: 'main',
    filePath: 'main.mmd',
    classes: [],
    functions: [],
    dependencies: [],
    callGraph: {
      nodes: [],
      edges: []
    }
  };
  
  return ir;
};

/**
 * 更新 IR 的文本內容
 */
UnifiedIR.prototype.updateFromText = function(newText) {
  this.originalText = newText;
  this.hash = btoa(newText).substring(0, 16);
  // 可以在這裡添加重新解析邏輯
};

/**
 * 轉換回文本
 */
UnifiedIR.prototype.toText = function() {
  return this.originalText || '';
};

/**
 * 根據類型查找節點
 */
UnifiedIR.prototype.findNodesByType = function() {
  // 簡化的實現，返回空數組
  return [];
};

/**
 * 獲取 IR 的字符串表示
 */
UnifiedIR.prototype.toString = function() {
  return this.originalText || JSON.stringify(this.project);
};

/**
 * �🏭 IR 轉換工廠函數
 */
export function createIRConverter(options = {}) {
  return new UnifiedIR(options);
}

/**
 * 🔄 便利函數：快速轉換舊版 IR
 */
export function convertLegacyToUnified(legacyIR, options = {}) {
  const converter = createIRConverter(options);
  return converter.convertLegacyIR(legacyIR);
}

/**
 * 🔄 便利函數：快速轉換為舊版格式
 */
export function convertUnifiedToLegacy(unifiedIR, options = {}) {
  const converter = createIRConverter(options);
  return converter.convertToLegacyFormat(unifiedIR);
}

// 瀏覽器環境全域暴露
if (typeof window !== 'undefined') {
  window.UnifiedIR = UnifiedIR;
  window.createIRConverter = createIRConverter;
}