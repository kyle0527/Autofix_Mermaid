/**
 * ModernMermaidEmitter - 現代化 Mermaid 圖表生成器
 * Phase 2.2: 基於統一 IR Schema 的高品質 Mermaid 輸出
 * 
 * 功能：
 * 1. 多種 Mermaid 圖表類型支援 (classDiagram, flowchart, etc.)
 * 2. 智能化佈局和分組
 * 3. 可配置的樣式和主題
 * 4. 大型專案的可讀性優化
 */

import { 
  EntityTypes, 
  RelationTypes, 
  UnifiedIR 
} from '../schema/UnifiedIRSchema.js';
import { globalEventBus, SystemEventTypes } from '../events/EventBus.js';

export class ModernMermaidEmitter {
  constructor(options = {}) {
    this.options = {
      // 圖表類型偏好
      preferredDiagrams: options.preferredDiagrams || ['classDiagram', 'flowchart'],
      
      // 佈局選項
      maxEntitiesPerDiagram: options.maxEntitiesPerDiagram || 20,
      groupByFile: options.groupByFile !== false,
      groupByNamespace: options.groupByNamespace !== false,
      
      // 樣式選項
      useColors: options.useColors !== false,
      showDetails: options.showDetails !== false,
      showRelationLabels: options.showRelationLabels !== false,
      
      // 過濾選項
      excludeTypes: options.excludeTypes || [],
      includeOnlyTypes: options.includeOnlyTypes || [],
      minConfidence: options.minConfidence || 0.5,
      
      // 輸出選項
      includeMetadata: options.includeMetadata !== false,
      generateMultipleDiagrams: options.generateMultipleDiagrams || false
    };
  }

  /**
   * 從統一 IR 生成 Mermaid 圖表
   * @param {UnifiedIR} unifiedIR - 統一 IR 實例
   * @returns {Object} { diagrams, metadata }
   */
  generateDiagrams(unifiedIR) {
    if (!unifiedIR instanceof UnifiedIR) {
      throw new Error('需要 UnifiedIR 實例');
    }

    const startTime = Date.now();
    
    try {
      globalEventBus.emitWithStats(SystemEventTypes.OUTPUT_START, {
        generator: 'ModernMermaidEmitter',
        entityCount: unifiedIR.entities.size,
        relationCount: unifiedIR.relations.size
      }, { source: 'ModernMermaidEmitter' });

      const diagrams = {};
      const metadata = this._generateMetadata(unifiedIR);
      
      // 生成類別圖
      if (this.options.preferredDiagrams.includes('classDiagram')) {
        diagrams.classDiagram = this._generateClassDiagram(unifiedIR);
      }
      
      // 生成流程圖
      if (this.options.preferredDiagrams.includes('flowchart')) {
        diagrams.flowchart = this._generateFlowchart(unifiedIR);
      }
      
      // 生成依賴圖
      if (this.options.preferredDiagrams.includes('dependencyGraph')) {
        diagrams.dependencyGraph = this._generateDependencyGraph(unifiedIR);
      }

      // 如果啟用多重圖表，按檔案分組生成
      if (this.options.generateMultipleDiagrams) {
        diagrams.byFile = this._generateDiagramsByFile(unifiedIR);
      }

      const generationTime = Date.now() - startTime;

      globalEventBus.emitWithStats(SystemEventTypes.OUTPUT_GENERATED, {
        generator: 'ModernMermaidEmitter',
        diagramTypes: Object.keys(diagrams),
        diagramCount: Object.keys(diagrams).length,
        generationTime
      }, { 
        source: 'ModernMermaidEmitter',
        performance: {
          operation: 'mermaid-generation',
          duration: generationTime
        }
      });

      return { diagrams, metadata };

    } catch (error) {
      globalEventBus.emitWithStats(SystemEventTypes.OUTPUT_ERROR, {
        generator: 'ModernMermaidEmitter',
        error: error.message
      }, { source: 'ModernMermaidEmitter' });

      throw error;
    }
  }

  /**
   * 生成類別圖
   */
  _generateClassDiagram(unifiedIR) {
    const lines = ['classDiagram'];
    const classes = [];
    const imports = [];
    const functions = [];

    // 分類實體
    unifiedIR.entities.forEach(entity => {
      if (this._shouldIncludeEntity(entity)) {
        switch (entity.type) {
          case EntityTypes.CLASS:
            classes.push(entity);
            break;
          case EntityTypes.FUNCTION:
          case EntityTypes.METHOD:
            functions.push(entity);
            break;
          case EntityTypes.IMPORT:
            imports.push(entity);
            break;
        }
      }
    });

    // 生成類別定義
    if (classes.length > 0) {
      lines.push('    %% 類別定義');
      for (const cls of classes) {
        lines.push(`    class ${this._sanitizeId(cls.name)} {`);
        
        if (this.options.showDetails) {
          // 找到屬於此類的方法
          const classMethods = functions.filter(f => 
            f.parent === cls.id || 
            (f.location.file === cls.location.file && f.name.startsWith(cls.name))
          );
          
          classMethods.forEach(method => {
            const visibility = this._getVisibility(method);
            const signature = this._formatSignature(method);
            lines.push(`        ${visibility}${signature}`);
          });
        }
        
        lines.push('    }');
        lines.push('');
      }
    }

    // 生成獨立函數類別
    const standaloneFunctions = functions.filter(f => 
      !classes.some(cls => f.parent === cls.id || f.name.startsWith(cls.name))
    );
    
    if (standaloneFunctions.length > 0) {
      lines.push('    class Functions {');
      lines.push('        <<utility>>');
      standaloneFunctions.slice(0, 10).forEach(func => { // 限制顯示數量
        const visibility = this._getVisibility(func);
        const signature = this._formatSignature(func);
        lines.push(`        ${visibility}${signature}`);
      });
      lines.push('    }');
      lines.push('');
    }

    // 生成匯入模組
    if (imports.length > 0) {
      const uniqueModules = [...new Set(imports.map(imp => 
        imp.languageSpecific.toModule || imp.name
      ))];
      
      uniqueModules.slice(0, 8).forEach(module => { // 限制顯示數量
        lines.push(`    class ${this._sanitizeId(module)} {`);
        lines.push('        <<external>>');
        lines.push('    }');
      });
      lines.push('');
    }

    // 生成關係
    if (this.options.showRelationLabels) {
      lines.push('    %% 關係');
      this._addClassRelations(lines, unifiedIR);
    }

    // 添加樣式
    if (this.options.useColors) {
      lines.push('');
      lines.push('    %% 樣式定義');
      lines.push('    classDef classStyle fill:#e1f5fe,stroke:#01579b,stroke-width:2px');
      lines.push('    classDef externalStyle fill:#fff3e0,stroke:#e65100,stroke-width:1px');
      lines.push('    classDef utilityStyle fill:#f3e5f5,stroke:#4a148c,stroke-width:1px');
    }

    return lines.join('\n');
  }

  /**
   * 生成流程圖
   */
  _generateFlowchart(unifiedIR) {
    const lines = ['flowchart TD'];
    const processed = new Set();

    lines.push('    %% 模組和依賴關係');

    // 獲取所有匯入關係
    const importRelations = Array.from(unifiedIR.relations.values())
      .filter(relation => relation.type === RelationTypes.DEPENDS_ON);

    // 建立節點和邊
    importRelations.forEach(relation => {
      const fromEntity = unifiedIR.entities.get(relation.from);
      const toEntity = unifiedIR.entities.get(relation.to);

      if (fromEntity && toEntity && this._shouldIncludeEntity(fromEntity) && this._shouldIncludeEntity(toEntity)) {
        const fromId = this._sanitizeId(fromEntity.name);
        const toId = this._sanitizeId(toEntity.name);
        const relationKey = `${fromId}->${toId}`;

        if (!processed.has(relationKey)) {
          // 添加節點定義（如果還沒有）
          if (!processed.has(fromId)) {
            lines.push(`    ${fromId}[${fromEntity.name}]`);
            processed.add(fromId);
          }
          if (!processed.has(toId)) {
            const shape = this._getNodeShape(toEntity);
            lines.push(`    ${toId}${shape}`);
            processed.add(toId);
          }

          // 添加關係邊
          const label = this.options.showRelationLabels ? `|${relation.type}|` : '';
          lines.push(`    ${fromId} -->${label} ${toId}`);
          processed.add(relationKey);
        }
      }
    });

    // 如果沒有關係，顯示基本結構
    if (importRelations.length === 0) {
      const entities = Array.from(unifiedIR.entities.values())
        .filter(e => this._shouldIncludeEntity(e))
        .slice(0, this.options.maxEntitiesPerDiagram);

      entities.forEach(entity => {
        const id = this._sanitizeId(entity.name);
        const shape = this._getNodeShape(entity);
        lines.push(`    ${id}${shape}`);
      });
    }

    // 添加樣式
    if (this.options.useColors) {
      lines.push('');
      lines.push('    %% 樣式定義');
      lines.push('    classDef moduleStyle fill:#e8f5e8,stroke:#2e7d32');
      lines.push('    classDef externalStyle fill:#fff8e1,stroke:#f57f17');
      lines.push('    classDef classStyle fill:#e3f2fd,stroke:#1976d2');
    }

    return lines.join('\n');
  }

  /**
   * 生成依賴圖
   */
  _generateDependencyGraph(unifiedIR) {
    const lines = ['graph LR'];
    
    lines.push('    %% 專案依賴結構');

    // 按檔案分組實體
    const fileGroups = new Map();
    unifiedIR.entities.forEach(entity => {
      if (this._shouldIncludeEntity(entity) && entity.location.file) {
        const fileName = this._getFileName(entity.location.file);
        if (!fileGroups.has(fileName)) {
          fileGroups.set(fileName, []);
        }
        fileGroups.get(fileName).push(entity);
      }
    });

    // 生成檔案節點
    fileGroups.forEach((entities, fileName) => {
      const fileId = this._sanitizeId(fileName);
      const entityCount = entities.length;
      lines.push(`    ${fileId}["${fileName}<br/>(${entityCount} 個實體)"]`);
    });

    // 生成檔案間依賴關係
    const processedPairs = new Set();
    unifiedIR.relations.forEach(relation => {
      const fromEntity = unifiedIR.entities.get(relation.from);
      const toEntity = unifiedIR.entities.get(relation.to);

      if (fromEntity && toEntity && fromEntity.location.file && toEntity.location.file) {
        const fromFile = this._getFileName(fromEntity.location.file);
        const toFile = this._getFileName(toEntity.location.file);
        
        if (fromFile !== toFile) {
          const pairKey = `${fromFile}->${toFile}`;
          if (!processedPairs.has(pairKey)) {
            const fromId = this._sanitizeId(fromFile);
            const toId = this._sanitizeId(toFile);
            lines.push(`    ${fromId} --> ${toId}`);
            processedPairs.add(pairKey);
          }
        }
      }
    });

    return lines.join('\n');
  }

  /**
   * 按檔案生成多個圖表
   */
  _generateDiagramsByFile(unifiedIR) {
    const diagrams = {};

    // 按檔案分組
    const fileGroups = new Map();
    unifiedIR.entities.forEach(entity => {
      if (entity.location.file) {
        const fileName = this._getFileName(entity.location.file);
        if (!fileGroups.has(fileName)) {
          fileGroups.set(fileName, []);
        }
        fileGroups.get(fileName).push(entity);
      }
    });

    // 為每個檔案生成圖表
    fileGroups.forEach((entities, fileName) => {
      if (entities.length > 0) {
        const fileIR = this._createFileIR(entities, unifiedIR);
        diagrams[fileName] = {
          classDiagram: this._generateClassDiagram(fileIR),
          entityCount: entities.length
        };
      }
    });

    return diagrams;
  }

  /**
   * 生成元數據
   */
  _generateMetadata(unifiedIR) {
    return {
      timestamp: Date.now(),
      schemaVersion: unifiedIR.version,
      generator: 'ModernMermaidEmitter',
      options: this.options,
      statistics: {
        totalEntities: unifiedIR.entities.size,
        totalRelations: unifiedIR.relations.size,
        entitiesByType: unifiedIR.metadata.statistics.entitiesByType,
        relationsByType: unifiedIR.metadata.statistics.relationsByType,
        languages: unifiedIR.metadata.languages,
        files: unifiedIR.metadata.files.length
      }
    };
  }

  // 輔助方法
  _shouldIncludeEntity(entity) {
    // 置信度過濾
    if (entity.metadata.confidence < this.options.minConfidence) {
      return false;
    }

    // 類型過濾
    if (this.options.excludeTypes.includes(entity.type)) {
      return false;
    }

    if (this.options.includeOnlyTypes.length > 0 && 
        !this.options.includeOnlyTypes.includes(entity.type)) {
      return false;
    }

    return true;
  }

  _sanitizeId(name = '') {
    return String(name)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1') || 'Unknown';
  }

  _getVisibility(entity) {
    if (entity.name.startsWith('_')) {
      return entity.name.startsWith('__') ? '-' : '#'; // private : protected
    }
    return '+'; // public
  }

  _formatSignature(entity) {
    if (entity.signature) {
      return entity.signature.replace(/^(def|class)\s+/, '');
    }
    return `${entity.name}()`;
  }

  _getNodeShape(entity) {
    switch (entity.type) {
      case EntityTypes.CLASS:
        return `[${entity.name}]`;
      case EntityTypes.FUNCTION:
      case EntityTypes.METHOD:
        return `(${entity.name})`;
      case EntityTypes.IMPORT:
        return `{${entity.name}}`;
      default:
        return `[${entity.name}]`;
    }
  }

  _getFileName(filePath) {
    return filePath ? filePath.split(/[/\\]/).pop() : 'unknown';
  }

  _addClassRelations(lines, unifiedIR) {
    const processed = new Set();
    
    unifiedIR.relations.forEach(relation => {
      const fromEntity = unifiedIR.entities.get(relation.from);
      const toEntity = unifiedIR.entities.get(relation.to);

      if (fromEntity && toEntity) {
        const fromId = this._sanitizeId(fromEntity.name);
        const toId = this._sanitizeId(toEntity.name);
        const relationKey = `${fromId}-${toId}`;

        if (!processed.has(relationKey)) {
          const arrow = this._getRelationArrow(relation.type);
          lines.push(`    ${fromId} ${arrow} ${toId}`);
          processed.add(relationKey);
        }
      }
    });
  }

  _getRelationArrow(relationType) {
    switch (relationType) {
      case RelationTypes.EXTENDS:
        return '--|>';
      case RelationTypes.IMPLEMENTS:
        return '..|>';
      case RelationTypes.CONTAINS:
        return '*-->';
      case RelationTypes.USES:
        return '-->';
      case RelationTypes.DEPENDS_ON:
        return '..>';
      default:
        return '-->';
    }
  }

  _createFileIR(entities, originalIR) {
    // 為特定檔案的實體創建一個簡化的 IR
    const fileIR = new UnifiedIR();
    
    entities.forEach(entity => {
      fileIR.addEntity(entity.clone());
    });

    // 添加相關關係
    originalIR.relations.forEach(relation => {
      const fromInFile = entities.find(e => e.id === relation.from);
      const toInFile = entities.find(e => e.id === relation.to);
      
      if (fromInFile && toInFile) {
        fileIR.addRelation(relation);
      }
    });

    return fileIR;
  }
}

// 建立全域現代化 Mermaid 生成器
export const globalMermaidEmitter = new ModernMermaidEmitter();

export default globalMermaidEmitter;