/**
 * UnifiedIRSchema - 統一中間表示層架構
 * Phase 2.2: 建立標準化的 IR 結構，支援多語言和多輸出格式
 * 
 * 功能：
 * 1. 統一的實體和關係表示
 * 2. 語言無關的抽象語法樹
 * 3. 可擴展的元數據系統
 * 4. 版本相容性管理
 */

// IR Schema 版本
export const IR_SCHEMA_VERSION = '2.0.0';

/**
 * 實體類型枚舉
 */
export const EntityTypes = {
  // 程式結構
  MODULE: 'module',
  CLASS: 'class', 
  FUNCTION: 'function',
  METHOD: 'method',
  PROPERTY: 'property',
  VARIABLE: 'variable',
  CONSTANT: 'constant',
  
  // 語言特定
  INTERFACE: 'interface',
  ENUM: 'enum',
  NAMESPACE: 'namespace',
  DECORATOR: 'decorator',
  ANNOTATION: 'annotation',
  
  // 依賴關係
  IMPORT: 'import',
  EXPORT: 'export',
  DEPENDENCY: 'dependency',
  
  // 註解和文件
  COMMENT: 'comment',
  DOCSTRING: 'docstring',
  TODO: 'todo',
  
  // 測試相關
  TEST_CASE: 'test_case',
  TEST_SUITE: 'test_suite'
};

/**
 * 關係類型枚舉
 */
export const RelationTypes = {
  // 結構關係
  CONTAINS: 'contains',           // A 包含 B
  EXTENDS: 'extends',             // A 繼承 B
  IMPLEMENTS: 'implements',       // A 實現 B
  USES: 'uses',                   // A 使用 B
  DEPENDS_ON: 'depends_on',       // A 依賴 B
  
  // 呼叫關係
  CALLS: 'calls',                 // A 呼叫 B
  INVOKES: 'invokes',             // A 調用 B
  REFERENCES: 'references',       // A 引用 B
  
  // 資料流
  ASSIGNS: 'assigns',             // A 賦值給 B
  RETURNS: 'returns',             // A 返回 B
  RECEIVES: 'receives',           // A 接收 B
  
  // 控制流
  BRANCHES_TO: 'branches_to',     // A 分支到 B
  LOOPS_TO: 'loops_to',           // A 迴圈到 B
  THROWS: 'throws',               // A 拋出 B
  CATCHES: 'catches',             // A 捕獲 B
  
  // 測試關係
  TESTS: 'tests',                 // A 測試 B
  MOCKS: 'mocks'                  // A 模擬 B
};

/**
 * 實體基礎結構
 */
export class UnifiedEntity {
  constructor(data = {}) {
    // 必要欄位
    this.id = data.id || this._generateId();
    this.type = data.type || EntityTypes.VARIABLE;
    this.name = data.name || 'unnamed';
    
    // 位置資訊
    this.location = {
      file: data.file || null,
      line: data.line || null,
      column: data.column || null,
      startOffset: data.startOffset || null,
      endOffset: data.endOffset || null
    };
    
    // 語言特定資訊
    this.language = data.language || 'unknown';
    this.languageSpecific = data.languageSpecific || {};
    
    // 內容和結構
    this.content = data.content || null;
    this.signature = data.signature || null;
    this.modifiers = data.modifiers || [];     // public, private, static, etc.
    this.annotations = data.annotations || []; // @decorator, /* comment */
    
    // 關係
    this.parent = data.parent || null;
    this.children = data.children || [];
    
    // 元數據
    this.metadata = {
      created: Date.now(),
      version: IR_SCHEMA_VERSION,
      confidence: data.confidence || 1.0,     // 解析置信度 0.0-1.0
      source: data.source || 'unknown',       // 解析來源 (tree-sitter, regex, etc.)
      ...data.metadata
    };
    
    // 品質指標
    this.quality = {
      complexity: data.complexity || 0,       // 複雜度分數
      maintainability: data.maintainability || 0,
      testability: data.testability || 0
    };
  }

  _generateId() {
    return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 添加子實體
   */
  addChild(entity) {
    if (entity instanceof UnifiedEntity) {
      entity.parent = this.id;
      this.children.push(entity.id);
    }
  }

  /**
   * 添加註解
   */
  addAnnotation(type, content, position = null) {
    this.annotations.push({
      type,
      content,
      position,
      timestamp: Date.now()
    });
  }

  /**
   * 轉換為舊式 IR 格式（相容性）
   */
  toLegacyFormat() {
    return {
      name: this.name,
      type: this.type,
      file: this.location.file,
      line: this.location.line,
      data: {
        type: this.type,
        language: this.language,
        content: this.content,
        signature: this.signature,
        ...this.languageSpecific
      }
    };
  }

  /**
   * 深度複製
   */
  clone() {
    return new UnifiedEntity({
      ...this,
      location: { ...this.location },
      languageSpecific: { ...this.languageSpecific },
      modifiers: [...this.modifiers],
      annotations: [...this.annotations],
      children: [...this.children],
      metadata: { ...this.metadata },
      quality: { ...this.quality }
    });
  }
}

/**
 * 關係結構
 */
export class UnifiedRelation {
  constructor(data = {}) {
    this.id = data.id || this._generateId();
    this.type = data.type || RelationTypes.USES;
    this.from = data.from;  // 源實體 ID
    this.to = data.to;      // 目標實體 ID
    
    // 關係屬性
    this.properties = data.properties || {};
    this.weight = data.weight || 1.0;        // 關係強度
    this.confidence = data.confidence || 1.0; // 關係置信度
    
    // 位置資訊（關係在程式碼中的位置）
    this.location = {
      file: data.file || null,
      line: data.line || null,
      context: data.context || null  // 程式碼上下文
    };
    
    // 元數據
    this.metadata = {
      created: Date.now(),
      version: IR_SCHEMA_VERSION,
      source: data.source || 'unknown',
      ...data.metadata
    };
  }

  _generateId() {
    return `relation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 轉換為舊式 IR 格式
   */
  toLegacyFormat() {
    return {
      from: this.from,
      to: this.to,
      type: this.type,
      data: {
        ...this.properties,
        weight: this.weight,
        confidence: this.confidence
      }
    };
  }
}

/**
 * 統一 IR 容器
 */
export class UnifiedIR {
  constructor() {
    this.version = IR_SCHEMA_VERSION;
    this.entities = new Map();  // id -> UnifiedEntity
    this.relations = new Map(); // id -> UnifiedRelation
    this.metadata = {
      created: Date.now(),
      languages: [],
      files: [],
      statistics: {
        totalEntities: 0,
        totalRelations: 0,
        entitiesByType: {},
        relationsByType: {}
      }
    };
    this.indexes = {
      byType: new Map(),        // type -> Set<entityId>
      byFile: new Map(),        // file -> Set<entityId>
      byLanguage: new Map(),    // language -> Set<entityId>
      byName: new Map()         // name -> Set<entityId>
    };
  }

  /**
   * 添加實體
   */
  addEntity(entityData) {
    const entity = entityData instanceof UnifiedEntity 
      ? entityData 
      : new UnifiedEntity(entityData);
    
    this.entities.set(entity.id, entity);
    this._updateIndexes(entity);
    this._updateStatistics();
    
    return entity;
  }

  /**
   * 添加關係
   */
  addRelation(relationData) {
    const relation = relationData instanceof UnifiedRelation
      ? relationData
      : new UnifiedRelation(relationData);
    
    // 驗證關係的實體存在
    if (!this.entities.has(relation.from) || !this.entities.has(relation.to)) {
      console.warn(`關係 ${relation.id} 引用了不存在的實體`);
      return null;
    }
    
    this.relations.set(relation.id, relation);
    this._updateStatistics();
    
    return relation;
  }

  /**
   * 根據類型查詢實體
   */
  getEntitiesByType(type) {
    const entityIds = this.indexes.byType.get(type) || new Set();
    return Array.from(entityIds).map(id => this.entities.get(id));
  }

  /**
   * 根據檔案查詢實體
   */
  getEntitiesByFile(file) {
    const entityIds = this.indexes.byFile.get(file) || new Set();
    return Array.from(entityIds).map(id => this.entities.get(id));
  }

  /**
   * 根據名稱查詢實體
   */
  getEntitiesByName(name) {
    const entityIds = this.indexes.byName.get(name) || new Set();
    return Array.from(entityIds).map(id => this.entities.get(id));
  }

  /**
   * 獲取實體的所有關係
   */
  getEntityRelations(entityId, direction = 'all') {
    const relations = Array.from(this.relations.values());
    
    switch (direction) {
      case 'outgoing':
        return relations.filter(r => r.from === entityId);
      case 'incoming':
        return relations.filter(r => r.to === entityId);
      default:
        return relations.filter(r => r.from === entityId || r.to === entityId);
    }
  }

  /**
   * 轉換為舊式 IR 格式（相容性）
   */
  toLegacyFormat() {
    return {
      entities: Array.from(this.entities.values()).map(e => e.toLegacyFormat()),
      relations: Array.from(this.relations.values()).map(r => r.toLegacyFormat()),
      metadata: this.metadata
    };
  }

  /**
   * 從舊式 IR 格式匯入
   */
  static fromLegacyFormat(legacyIR) {
    const unifiedIR = new UnifiedIR();
    
    // 匯入實體
    if (legacyIR.entities) {
      legacyIR.entities.forEach(entity => {
        unifiedIR.addEntity({
          name: entity.name,
          type: entity.type,
          file: entity.file,
          line: entity.line,
          content: entity.data?.content,
          language: entity.data?.language || 'unknown',
          languageSpecific: entity.data || {},
          source: 'legacy_import'
        });
      });
    }
    
    // 匯入關係
    if (legacyIR.relations) {
      legacyIR.relations.forEach(relation => {
        // 需要根據名稱找到對應的實體 ID
        const fromEntity = unifiedIR.getEntitiesByName(relation.from)[0];
        const toEntity = unifiedIR.getEntitiesByName(relation.to)[0];
        
        if (fromEntity && toEntity) {
          unifiedIR.addRelation({
            type: relation.type,
            from: fromEntity.id,
            to: toEntity.id,
            properties: relation.data || {},
            source: 'legacy_import'
          });
        }
      });
    }
    
    return unifiedIR;
  }

  // 私有方法
  _updateIndexes(entity) {
    // 按類型索引
    if (!this.indexes.byType.has(entity.type)) {
      this.indexes.byType.set(entity.type, new Set());
    }
    this.indexes.byType.get(entity.type).add(entity.id);
    
    // 按檔案索引
    if (entity.location.file) {
      if (!this.indexes.byFile.has(entity.location.file)) {
        this.indexes.byFile.set(entity.location.file, new Set());
      }
      this.indexes.byFile.get(entity.location.file).add(entity.id);
    }
    
    // 按語言索引
    if (!this.indexes.byLanguage.has(entity.language)) {
      this.indexes.byLanguage.set(entity.language, new Set());
    }
    this.indexes.byLanguage.get(entity.language).add(entity.id);
    
    // 按名稱索引
    if (!this.indexes.byName.has(entity.name)) {
      this.indexes.byName.set(entity.name, new Set());
    }
    this.indexes.byName.get(entity.name).add(entity.id);
  }

  _updateStatistics() {
    this.metadata.statistics.totalEntities = this.entities.size;
    this.metadata.statistics.totalRelations = this.relations.size;
    
    // 按類型統計實體
    this.metadata.statistics.entitiesByType = {};
    this.indexes.byType.forEach((entityIds, type) => {
      this.metadata.statistics.entitiesByType[type] = entityIds.size;
    });
    
    // 按類型統計關係
    this.metadata.statistics.relationsByType = {};
    this.relations.forEach(relation => {
      const type = relation.type;
      this.metadata.statistics.relationsByType[type] = 
        (this.metadata.statistics.relationsByType[type] || 0) + 1;
    });
    
    // 更新語言和檔案列表
    this.metadata.languages = Array.from(this.indexes.byLanguage.keys());
    this.metadata.files = Array.from(this.indexes.byFile.keys());
  }
}

export default {
  IR_SCHEMA_VERSION,
  EntityTypes,
  RelationTypes,
  UnifiedEntity,
  UnifiedRelation,
  UnifiedIR
};