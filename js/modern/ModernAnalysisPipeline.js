/**
 * ModernAnalysisPipeline - Complete Phase 2 Integration Pipeline
 * Unified event-driven architecture with modern IR schema and output generation
 * 現代化分析管道 - Phase 2.3
 */

import { analyzePythonProject } from '../engine/python-analyzer.js';
import { globalIRAdapter } from './schema/IRAdapter.js';
import { globalMermaidEmitter } from './emitters/ModernMermaidEmitter.js';
import { globalEventBus, SystemEventTypes } from './events/EventBus.js';

export class ModernAnalysisPipeline {
  constructor(options = {}) {
    this.options = {
      languages: options.languages || ['python'],
      enableFallback: options.enableFallback !== false,
      useUnifiedIR: options.useUnifiedIR !== false,
      outputFormats: options.outputFormats || ['mermaid'],
      mermaidOptions: options.mermaidOptions || {},
      enableMonitoring: options.enableMonitoring !== false,
      detailedLogging: options.detailedLogging || false,
      minConfidence: options.minConfidence || 0.5
    };

    this.sessionId = this._generateSessionId();
    this._registerEventHandlers();
  }

  async analyze(projectPath) {
    const pipelineStart = Date.now();
    const results = {
      sessionId: this.sessionId,
      projectPath,
      languages: {},
      unifiedIR: null,
      outputs: {},
      metadata: {
        startTime: pipelineStart,
        endTime: null,
        totalDuration: 0,
        events: []
      }
    };

    try {
      globalEventBus.emit(SystemEventTypes.PIPELINE_START, {
        sessionId: this.sessionId,
        projectPath,
        options: this.options
      });

      if (this.options.detailedLogging) {
        console.log(`🚀 啟動現代化分析管道 (Session: ${this.sessionId})`);
        console.log(`📁 專案路徑: ${projectPath}`);
        console.log(`⚙️  選項:`, JSON.stringify(this.options, null, 2));
      }

      // Step 1: Language analysis
      await this._performLanguageAnalysis(projectPath, results);

      // Step 2: IR unification
      if (this.options.useUnifiedIR) {
        await this._unifyIR(results);
      }

      // Step 3: Output generation
      await this._generateOutputs(results);

      // Step 4: Completion
      results.metadata.endTime = Date.now();
      results.metadata.totalDuration = results.metadata.endTime - pipelineStart;

      globalEventBus.emit(SystemEventTypes.PIPELINE_COMPLETE, {
        sessionId: this.sessionId,
        duration: results.metadata.totalDuration,
        success: true
      });

      if (this.options.detailedLogging) {
        console.log(`✅ 分析管道完成 (${results.metadata.totalDuration}ms)`);
        this._printResultSummary(results);
      }

      return results;
    } catch (error) {
      const duration = Date.now() - pipelineStart;
      globalEventBus.emit(SystemEventTypes.PIPELINE_ERROR, {
        sessionId: this.sessionId,
        error: error.message,
        duration
      });
      console.error(`❌ 分析管道失敗 (${duration}ms): ${error.message}`);
      throw error;
    }
  }

  async _performLanguageAnalysis(projectPath, results) {
    for (const language of this.options.languages) {
      switch (language) {
        case 'python':
          await this._analyzePython(projectPath, results);
          break;
        // 未來可擴充其他語言
        default:
          console.warn(`不支援的語言: ${language}`);
      }
    }
  }

  async _analyzePython(projectPath, results) {
    try {
      globalEventBus.emit(SystemEventTypes.ANALYSIS_START, {
        language: 'python',
        projectPath,
        sessionId: this.sessionId
      });

      if (this.options.detailedLogging) {
        console.log(`🐍 開始 Python 分析...`);
      }

      const pythonResult = await analyzePythonProject(projectPath);
      results.languages.python = {
        success: true,
        result: pythonResult,
        stats: pythonResult.stats,
        metadata: {
          parserUsed: pythonResult.metadata?.parserUsed || 'unknown',
          fallbackCount: pythonResult.metadata?.fallbackCount || 0
        }
      };

      globalEventBus.emit(SystemEventTypes.ANALYSIS_COMPLETE, {
        language: 'python',
        sessionId: this.sessionId,
        entityCount: pythonResult.ir?.entities?.length || 0,
        relationCount: pythonResult.ir?.relations?.length || 0
      });

      if (this.options.detailedLogging) {
        console.log(`✅ Python 分析完成:`);
        console.log(`   實體: ${pythonResult.stats?.entitiesFound || 0}`);
        console.log(`   關係: ${pythonResult.stats?.relationsFound || 0}`);
        console.log(`   檔案: ${pythonResult.stats?.filesProcessed || 0}`);
        console.log(`   錯誤: ${pythonResult.stats?.errorsFound || 0}`);
      }
    } catch (error) {
      results.languages.python = { success: false, error: error.message };
      globalEventBus.emit(SystemEventTypes.ANALYSIS_ERROR, {
        language: 'python',
        sessionId: this.sessionId,
        error: error.message
      });
      if (!this.options.enableFallback) throw error;
      console.warn(`⚠️ Python 分析失敗，繼續處理其他語言: ${error.message}`);
    }
  }

  async _unifyIR(results) {
    try {
      if (this.options.detailedLogging) {
        console.log(`🔄 開始 IR 統一處理...`);
      }
      if (results.languages.python && results.languages.python.success) {
        results.unifiedIR = globalIRAdapter.convertPythonAnalysisResult(
          results.languages.python.result
        );
      }
      if (this.options.detailedLogging && results.unifiedIR) {
        console.log(`✅ IR 統一完成:`);
        console.log(`   統一實體: ${results.unifiedIR.entities.size}`);
        console.log(`   統一關係: ${results.unifiedIR.relations.size}`);
      }
    } catch (error) {
      globalEventBus.emit(SystemEventTypes.IR_UNIFICATION_ERROR, {
        sessionId: this.sessionId,
        error: error.message
      });
      console.warn(`⚠️ IR 統一失敗: ${error.message}`);
      if (!this.options.enableFallback) throw error;
    }
  }

  async _generateOutputs(results) {
    try {
      if (this.options.detailedLogging) {
        console.log(`📊 開始輸出生成...`);
      }
      for (const format of this.options.outputFormats) {
        switch (format) {
          case 'mermaid':
            await this._generateMermaidOutput(results);
            break;
          case 'json':
            this._generateJSONOutput(results);
            break;
          default:
            console.warn(`不支援的輸出格式: ${format}`);
        }
      }
    } catch (error) {
      console.error(`❌ 輸出生成失敗: ${error.message}`);
      throw error;
    }
  }

  async _generateMermaidOutput(results) {
    try {
      let mermaidResult;
      if (results.unifiedIR) {
        const emitter = new globalMermaidEmitter(this.options.mermaidOptions);
        mermaidResult = emitter.generateDiagrams(results.unifiedIR);
      } else if (results.languages.python && results.languages.python.success) {
        const { emitMermaid } = await import('../emitters/mermaid.js');
        mermaidResult = {
          diagrams: { basic: emitMermaid(results.languages.python.result.ir) },
          metadata: { generator: 'legacy' }
        };
      }
      if (mermaidResult) {
        results.outputs.mermaid = mermaidResult;
        if (this.options.detailedLogging) {
          console.log(`✅ Mermaid 輸出生成完成:`);
          console.log(`   圖表類型: ${Object.keys(mermaidResult.diagrams).join(', ')}`);
        }
      }
    } catch (error) {
      console.error(`❌ Mermaid 輸出生成失敗: ${error.message}`);
      throw error;
    }
  }

  _generateJSONOutput(results) {
    try {
      const jsonOutput = {
        sessionId: results.sessionId,
        projectPath: results.projectPath,
        languages: Object.keys(results.languages),
        statistics: this._generateStatistics(results),
        timestamp: Date.now()
      };
      if (results.unifiedIR) {
        jsonOutput.unifiedIR = {
          version: results.unifiedIR.version,
          entities: Array.from(results.unifiedIR.entities.values()).map(e => e.toLegacyFormat()),
          relations: Array.from(results.unifiedIR.relations.values()).map(r => r.toLegacyFormat())
        };
      }
      results.outputs.json = jsonOutput;
    } catch (error) {
      console.error(`❌ JSON 輸出生成失敗: ${error.message}`);
      throw error;
    }
  }

  _generateStatistics(results) {
    const stats = {
      totalDuration: results.metadata.totalDuration,
      languagesProcessed: Object.keys(results.languages).length,
      successfulLanguages: Object.values(results.languages).filter(l => l.success).length,
      failedLanguages: Object.values(results.languages).filter(l => !l.success).length
    };
    Object.values(results.languages).forEach(langResult => {
      if (langResult.success && langResult.stats) {
        stats.filesProcessed = (stats.filesProcessed || 0) + (langResult.stats.filesProcessed || 0);
        stats.entitiesFound = (stats.entitiesFound || 0) + (langResult.stats.entitiesFound || 0);
        stats.relationsFound = (stats.relationsFound || 0) + (langResult.stats.relationsFound || 0);
        stats.errorsFound = (stats.errorsFound || 0) + (langResult.stats.errorsFound || 0);
      }
    });
    return stats;
  }

  _printResultSummary(results) {
    console.log('\n=== 分析結果摘要 ===');
    console.log(`會話 ID: ${results.sessionId}`);
    console.log(`專案: ${results.projectPath}`);
    console.log(`總耗時: ${results.metadata.totalDuration}ms`);

    console.log('\n語言分析:');
    Object.entries(results.languages).forEach(([lang, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${lang}: ${result.success ? '成功' : result.error}`);
    });

    console.log('\n輸出格式:');
    Object.keys(results.outputs).forEach(format => {
      console.log(`  ✅ ${format}`);
    });

    const stats = this._generateStatistics(results);
    console.log('\n統計資訊:');
    console.log(`  檔案: ${stats.filesProcessed || 0}`);
    console.log(`  實體: ${stats.entitiesFound || 0}`);
    console.log(`  關係: ${stats.relationsFound || 0}`);
    console.log(`  錯誤: ${stats.errorsFound || 0}`);

    if (results.unifiedIR) {
      console.log(`\n統一 IR:`);
      console.log(`  版本: ${results.unifiedIR.version}`);
      console.log(`  實體: ${results.unifiedIR.entities.size}`);
      console.log(`  關係: ${results.unifiedIR.relations.size}`);
    }

    console.log('===================\n');
  }

  _registerEventHandlers() {
    globalEventBus.on(SystemEventTypes.ANALYSIS_COMPLETE, (data) => {
      if (data.sessionId === this.sessionId && this.options.detailedLogging) {
        console.log(`分析完成: ${data.language}`);
      }
    });

    globalEventBus.on(SystemEventTypes.IR_UNIFICATION_COMPLETE, (data) => {
      if (data.sessionId === this.sessionId && this.options.detailedLogging) {
        console.log(`IR 統一完成 - 版本: ${data.version}`);
      }
    });
  }

  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // API
  async quickAnalyze(projectPath) {
    return this.analyze(projectPath);
  }

  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      options: this.options,
      created: new Date().toISOString()
    };
  }

  onEvent(eventType, handler) {
    globalEventBus.on(eventType, handler);
  }

  offEvent(eventType, handler) {
    globalEventBus.off(eventType, handler);
  }
}

// 建立全域管道實例
export const globalAnalysisPipeline = new ModernAnalysisPipeline();
export default globalAnalysisPipeline;
