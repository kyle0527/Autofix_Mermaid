/**
 * IRAdapter - IR 格式適配器
 * Phase 2.2: 將舊式 IR 無縫轉換到統一 IR Schema
 * 
 * 功能：
 * 1. 舊式 IR → 統一 IR 自動轉換
 * 2. 語言特定解析器整合
 * 3. 相容性保證和回滾機制
 * 4. 漸進式升級支援
 */

import { 
  UnifiedIR, 
  UnifiedEntity, 
  UnifiedRelation,
  EntityTypes,
  RelationTypes
} from './UnifiedIRSchema.js';
import { globalEventBus, SystemEventTypes } from '../events/EventBus.js';

export class IRAdapter {
  constructor() {
    this.conversionStats = {
      entitiesConverted: 0,
      relationsConverted: 0,
      conversionErrors: 0,
      conversionTime: 0
    };
  }

  /**
   * 將 Python 分析器的輸出轉換為統一 IR
   * @param {Object} legacyAnalysisResult - 舊式分析結果 { ir, stats }
   * @returns {UnifiedIR} 統一 IR 實例
   */
  convertPythonAnalysisResult(legacyAnalysisResult) {
    const startTime = Date.now();
    
    try {
      globalEventBus.emitWithStats(SystemEventTypes.IR_GENERATED, {
        source: 'IRAdapter',
        conversionType: 'python-legacy-to-unified'
      }, { source: 'IRAdapter' });

      const { ir: legacyIR, stats } = legacyAnalysisResult;
      const unifiedIR = new UnifiedIR();
      
      // 設定基本元數據
      unifiedIR.metadata.languages = ['python'];
      unifiedIR.metadata.source = 'python-analyzer';
      unifiedIR.metadata.originalStats = stats;
      
      // 轉換實體
      if (legacyIR.entities && Array.isArray(legacyIR.entities)) {
        for (const legacyEntity of legacyIR.entities) {
          try {
            const unifiedEntity = this._convertLegacyEntity(legacyEntity);
            if (unifiedEntity) {
              unifiedIR.addEntity(unifiedEntity);
              this.conversionStats.entitiesConverted++;
            }
          } catch (error) {
            console.warn(`轉換實體失敗: ${legacyEntity.name}`, error.message);
            this.conversionStats.conversionErrors++;
          }
        }
      }
      
      // 轉換關係
      if (legacyIR.relations && Array.isArray(legacyIR.relations)) {
        for (const legacyRelation of legacyIR.relations) {
          try {
            const unifiedRelation = this._convertLegacyRelation(legacyRelation, unifiedIR);
            if (unifiedRelation) {
              unifiedIR.addRelation(unifiedRelation);
              this.conversionStats.relationsConverted++;
            }
          } catch (error) {
            console.warn(`轉換關係失敗: ${legacyRelation.from} -> ${legacyRelation.to}`, error.message);
            this.conversionStats.conversionErrors++;
          }
        }
      }
      
      // 記錄轉換統計
      this.conversionStats.conversionTime = Date.now() - startTime;
      
      globalEventBus.emitWithStats(SystemEventTypes.IR_GENERATED, {
        source: 'IRAdapter',
        unifiedVersion: unifiedIR.version,
        statistics: this.conversionStats,
        entityCount: unifiedIR.entities.size,
        relationCount: unifiedIR.relations.size
      }, { 
        source: 'IRAdapter',
        performance: {
          operation: 'ir-conversion',
          duration: this.conversionStats.conversionTime
        }
      });
      
      return unifiedIR;
      
    } catch (error) {
      this.conversionStats.conversionTime = Date.now() - startTime;
      
      globalEventBus.emitWithStats(SystemEventTypes.SYSTEM_ERROR, {
        operation: 'ir-conversion',
        error: error.message,
        stats: this.conversionStats
      }, { source: 'IRAdapter' });
      
      throw error;
    }
  }

  /**
   * 轉換舊式實體為統一實體
   */
  _convertLegacyEntity(legacyEntity) {
    // 推斷實體類型
    const entityType = this._inferEntityType(legacyEntity);
    
    // 解析位置資訊
    const location = this._parseLocation(legacyEntity);
    
    // 推斷語言特定資訊
    const languageSpecific = this._extractLanguageSpecific(legacyEntity);
    
    return new UnifiedEntity({
      name: legacyEntity.name || 'unnamed',
      type: entityType,
      file: legacyEntity.file || location.file,
      line: legacyEntity.line || location.line,
      location: location,
      language: 'python',
      languageSpecific: languageSpecific,
      content: legacyEntity.data?.content || legacyEntity.data?.fullStatement,
      signature: this._extractSignature(legacyEntity),
      confidence: this._calculateConfidence(legacyEntity),
      source: legacyEntity.data?.source || 'legacy-conversion',
      metadata: {
        originalData: legacyEntity.data,
        conversionTime: Date.now()
      }
    });
  }

  /**
   * 推斷實體類型
   */
  _inferEntityType(legacyEntity) {
    const name = legacyEntity.name || '';
    const data = legacyEntity.data || {};
    const type = legacyEntity.type;
    
    // 根據現有 type 欄位
    if (type === 'class') return EntityTypes.CLASS;
    if (type === 'function' || type === 'method') return EntityTypes.FUNCTION;
    if (type === 'import') return EntityTypes.IMPORT;
    
    // 根據語言特定資訊推斷
    if (data.fullStatement) {
      if (data.fullStatement.startsWith('class ')) return EntityTypes.CLASS;
      if (data.fullStatement.startsWith('def ')) return EntityTypes.FUNCTION;
      if (data.fullStatement.startsWith('import ') || data.fullStatement.startsWith('from ')) {
        return EntityTypes.IMPORT;
      }
    }
    
    // 根據命名慣例推斷
    if (/^[A-Z][A-Za-z0-9]*$/.test(name)) {
      // 可能是類名
      return EntityTypes.CLASS;
    }
    
    if (name.includes('__') && (name.startsWith('__') || name.endsWith('__'))) {
      // 特殊方法
      return EntityTypes.METHOD;
    }
    
    // 標準庫模組
    if (['os', 'sys', 'ast', 'argparse', 'pathlib', 'typing'].includes(name)) {
      return EntityTypes.IMPORT;
    }
    
    // 關係實體（from/to 存在）
    if (data.from && data.to) {
      return EntityTypes.IMPORT;
    }
    
    // 預設為變數
    return EntityTypes.VARIABLE;
  }

  /**
   * 解析位置資訊
   */
  _parseLocation(legacyEntity) {
    return {
      file: legacyEntity.file || null,
      line: legacyEntity.line || null,
      column: null,  // 舊式 IR 沒有 column 資訊
      startOffset: null,
      endOffset: null
    };
  }

  /**
   * 提取語言特定資訊
   */
  _extractLanguageSpecific(legacyEntity) {
    const data = legacyEntity.data || {};
    
    return {
      // Python 特定欄位
      fullStatement: data.fullStatement,
      module: data.module,
      path: data.path,
      size: data.size,
      
      // 匯入相關
      fromModule: data.from,
      toModule: data.to,
      
      // 其他原始資料
      originalType: legacyEntity.type,
      rawData: data
    };
  }

  /**
   * 提取函數/方法簽名
   */
  _extractSignature(legacyEntity) {
    const data = legacyEntity.data || {};
    const fullStatement = data.fullStatement;
    
    if (fullStatement) {
      // 提取函數簽名
      const funcMatch = fullStatement.match(/def\s+(\w+)\s*\([^)]*\)/);
      if (funcMatch) {
        return funcMatch[0];
      }
      
      // 提取類定義
      const classMatch = fullStatement.match(/class\s+(\w+)(?:\([^)]*\))?/);
      if (classMatch) {
        return classMatch[0];
      }
    }
    
    return null;
  }

  /**
   * 計算轉換置信度
   */
  _calculateConfidence(legacyEntity) {
    let confidence = 0.5; // 基礎置信度
    
    const data = legacyEntity.data || {};
    
    // 有完整語句 +0.3
    if (data.fullStatement) {
      confidence += 0.3;
    }
    
    // 有位置資訊 +0.1
    if (legacyEntity.file && legacyEntity.line) {
      confidence += 0.1;
    }
    
    // 有明確類型 +0.1
    if (legacyEntity.type && legacyEntity.type !== 'python') {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 轉換舊式關係為統一關係
   */
  _convertLegacyRelation(legacyRelation, unifiedIR) {
    // 找到對應的實體
    const fromEntities = unifiedIR.getEntitiesByName(legacyRelation.from);
    const toEntities = unifiedIR.getEntitiesByName(legacyRelation.to);
    
    if (fromEntities.length === 0 || toEntities.length === 0) {
      console.warn(`關係轉換失敗：找不到實體 ${legacyRelation.from} -> ${legacyRelation.to}`);
      return null;
    }
    
    // 使用第一個匹配的實體（可能需要更智能的匹配策略）
    const fromEntity = fromEntities[0];
    const toEntity = toEntities[0];
    
    // 推斷關係類型
    const relationType = this._inferRelationType(legacyRelation, fromEntity, toEntity);
    
    return new UnifiedRelation({
      type: relationType,
      from: fromEntity.id,
      to: toEntity.id,
      properties: legacyRelation.data || {},
      confidence: 0.8, // 關係轉換的預設置信度
      source: 'legacy-conversion',
      metadata: {
        originalRelation: legacyRelation,
        conversionTime: Date.now()
      }
    });
  }

  /**
   * 推斷關係類型
   */
  _inferRelationType(legacyRelation, fromEntity, toEntity) {
    // 根據實體類型推斷關係
    if (fromEntity.type === EntityTypes.IMPORT || toEntity.type === EntityTypes.IMPORT) {
      return RelationTypes.DEPENDS_ON;
    }
    
    if (fromEntity.type === EntityTypes.CLASS && toEntity.type === EntityTypes.METHOD) {
      return RelationTypes.CONTAINS;
    }
    
    if (fromEntity.type === EntityTypes.FUNCTION && toEntity.type === EntityTypes.FUNCTION) {
      return RelationTypes.CALLS;
    }
    
    // 根據舊式關係類型
    if (legacyRelation.type) {
      switch (legacyRelation.type.toLowerCase()) {
        case 'import':
        case 'imports':
          return RelationTypes.DEPENDS_ON;
        case 'uses':
          return RelationTypes.USES;
        case 'contains':
          return RelationTypes.CONTAINS;
        case 'calls':
          return RelationTypes.CALLS;
        default:
          return RelationTypes.REFERENCES;
      }
    }
    
    // 預設關係類型
    return RelationTypes.REFERENCES;
  }

  /**
   * 獲取轉換統計
   */
  getConversionStats() {
    return { ...this.conversionStats };
  }

  /**
   * 重置統計
   */
  resetStats() {
    this.conversionStats = {
      entitiesConverted: 0,
      relationsConverted: 0,
      conversionErrors: 0,
      conversionTime: 0
    };
  }
}

// 建立全域適配器實例
export const globalIRAdapter = new IRAdapter();

export default globalIRAdapter;