/**
 * 整合分析器
 * 支援多語言程式碼分析 (JavaScript/TypeScript + Python)
 */

// 導入各語言分析器
import { analyzeJavaScriptProject } from './analyzer.js';
import { analyzePythonProject } from './python-analyzer.js';

/**
 * 多語言專案分析
 */
async function analyzeMultiLanguageProject(projectPath, options = {}) {
  const results = {
    javascript: null,
    python: null,
    combined: {
      ir: {
        entities: [],
        relations: [],
        metadata: {
          name: 'multi-language-analysis',
          timestamp: new Date().toISOString(),
          analyzer: 'multi-language',
          version: '1.0.0',
          languages: []
        }
      },
      stats: {
        totalFiles: 0,
        totalEntities: 0,
        totalRelations: 0,
        totalErrors: 0,
        languages: {}
      }
    }
  };

  console.log(`[Multi-Language Analyzer] 開始分析專案: ${projectPath}`);

  try {
    // JavaScript/TypeScript 分析
    if (options.includeJavaScript !== false) {
      try {
        console.log('🔍 分析 JavaScript/TypeScript 檔案...');
        results.javascript = await analyzeJavaScriptProject(projectPath, {
          useTreeSitter: options.useTreeSitter !== false,
          strictTreeSitter: options.strictTreeSitter || false
        });
        
        if (results.javascript && results.javascript.stats) {
          results.combined.metadata.languages.push('javascript');
          results.combined.stats.languages.javascript = results.javascript.stats;
          
          console.log(`✅ JavaScript 分析完成: ${results.javascript.stats.filesProcessed} 檔案, ${results.javascript.stats.entitiesFound} 實體`);
        } else {
          console.warn('⚠️ JavaScript 分析返回了無效結果');
        }
        
      } catch (error) {
        console.error('❌ JavaScript 分析失敗:', error);
        results.combined.stats.totalErrors++;
      }
    }

    // Python 分析
    if (options.includePython !== false) {
      try {
        console.log('🐍 分析 Python 檔案...');
        results.python = await analyzePythonProject(projectPath);
        
        if (results.python && results.python.stats) {
          results.combined.metadata.languages.push('python');
          results.combined.stats.languages.python = results.python.stats;
          
          console.log(`✅ Python 分析完成: ${results.python.stats.filesProcessed} 檔案, ${results.python.stats.entitiesFound} 實體`);
        } else {
          console.warn('⚠️ Python 分析返回了無效結果');
        }
        
      } catch (error) {
        console.error('❌ Python 分析失敗:', error);
        results.combined.stats.totalErrors++;
      }
    }

    // 合併結果
    mergeAnalysisResults(results);

    console.log(`🎯 整合分析完成 - 總檔案: ${results.combined.stats.totalFiles}, 總實體: ${results.combined.stats.totalEntities}, 總關係: ${results.combined.stats.totalRelations}`);

    return results;

  } catch (error) {
    console.error('[Multi-Language Analyzer] 整體分析失敗:', error);
    throw error;
  }
}

/**
 * 合併分析結果
 */
function mergeAnalysisResults(results) {
  const { combined } = results;

  // 合併 JavaScript 結果
  if (results.javascript && results.javascript.ir) {
    combined.ir.entities.push(...results.javascript.ir.entities);
    combined.ir.relations.push(...results.javascript.ir.relations);
    
    combined.stats.totalFiles += results.javascript.stats.filesProcessed;
    combined.stats.totalEntities += results.javascript.stats.entitiesFound;
    combined.stats.totalRelations += results.javascript.stats.relationsFound;
    combined.stats.totalErrors += results.javascript.stats.errorsFound;
  }

  // 合併 Python 結果
  if (results.python && results.python.ir) {
    combined.ir.entities.push(...results.python.ir.entities);
    combined.ir.relations.push(...results.python.ir.relations);
    
    combined.stats.totalFiles += results.python.stats.filesProcessed;
    combined.stats.totalEntities += results.python.stats.entitiesFound;
    combined.stats.totalRelations += results.python.stats.relationsFound;
    combined.stats.totalErrors += results.python.stats.errorsFound;
  }

  // 更新合併後的 metadata
  combined.ir.metadata.entitiesCount = combined.stats.totalEntities;
  combined.ir.metadata.relationsCount = combined.stats.totalRelations;
  combined.ir.metadata.filesProcessed = combined.stats.totalFiles;
}

/**
 * 自動檢測專案語言
 */
async function detectProjectLanguages(projectPath) {
  const languages = [];
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    async function scanForLanguages(dirPath, depth = 0) {
      if (depth > 3) return; // 限制掃描深度
      
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 跳過忽略目錄
          if (!['node_modules', '.git', '__pycache__', '.venv', 'venv', 'env', 'dist', 'build'].includes(entry.name)) {
            await scanForLanguages(path.join(dirPath, entry.name), depth + 1);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
            if (!languages.includes('javascript')) {
              languages.push('javascript');
            }
          } else if (ext === '.py') {
            if (!languages.includes('python')) {
              languages.push('python');
            }
          }
        }
      }
    }
    
    await scanForLanguages(projectPath);
    
  } catch (error) {
    console.warn('語言檢測失敗，使用預設語言設定:', error.message);
  }
  
  return languages;
}

/**
 * 快速分析 (自動檢測語言)
 */
async function quickAnalyze(projectPath, options = {}) {
  console.log('🔍 自動檢測專案語言...');
  
  const detectedLanguages = await detectProjectLanguages(projectPath);
  console.log(`📋 檢測到語言: ${detectedLanguages.join(', ')}`);
  
  const analysisOptions = {
    includeJavaScript: detectedLanguages.includes('javascript'),
    includePython: detectedLanguages.includes('python'),
    useTreeSitter: options.useTreeSitter !== false,
    strictTreeSitter: options.strictTreeSitter || false
  };
  
  return await analyzeMultiLanguageProject(projectPath, analysisOptions);
}

/**
 * 獲取支援的語言列表
 */
function getSupportedLanguages() {
  return [
    {
      name: 'JavaScript/TypeScript',
      extensions: ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'],
      analyzer: 'tree-sitter + regex fallback',
      features: ['classes', 'functions', 'imports', 'exports', 'modules']
    },
    {
      name: 'Python',
      extensions: ['.py'],
      analyzer: 'tree-sitter + regex fallback', 
      features: ['classes', 'functions', 'methods', 'imports', 'modules']
    }
  ];
}

/**
 * 分析統計報告
 */
function generateAnalysisReport(results) {
  const report = {
    summary: {
      projectAnalyzed: true,
      timestamp: new Date().toISOString(),
      totalFiles: results.combined.stats.totalFiles,
      totalEntities: results.combined.stats.totalEntities,
      totalRelations: results.combined.stats.totalRelations,
      totalErrors: results.combined.stats.totalErrors,
      languages: results.combined.metadata.languages
    },
    details: {},
    recommendations: []
  };

  // 語言詳細統計
  for (const [lang, stats] of Object.entries(results.combined.stats.languages)) {
    report.details[lang] = {
      filesProcessed: stats.filesProcessed,
      entitiesFound: stats.entitiesFound,
      relationsFound: stats.relationsFound,
      errorsFound: stats.errorsFound,
      parsingMethod: stats.parsingMethod,
      breakdown: {
        modules: stats.modulesFound || 0,
        classes: stats.classesFound || 0,
        functions: stats.functionsFound || 0,
        methods: stats.methodsFound || 0,
        imports: stats.importsFound || 0
      }
    };
  }

  // 生成建議
  if (report.summary.totalErrors > 0) {
    report.recommendations.push('⚠️ 發現解析錯誤，建議檢查程式碼語法或更新分析器');
  }
  
  if (report.summary.totalEntities > 1000) {
    report.recommendations.push('📊 專案規模較大，建議分模組進行分析');
  }
  
  if (results.javascript && results.javascript.stats.parsingMethod === 'tree-sitter+fallback') {
    report.recommendations.push('🔄 JavaScript 使用了備用解析器，可能影響準確度');
  }
  
  if (results.python && results.python.stats.parsingMethod === 'tree-sitter+fallback') {
    report.recommendations.push('🐍 Python 使用了備用解析器，可能影響準確度');
  }

  return report;
}

export {
  analyzeMultiLanguageProject,
  quickAnalyze,
  detectProjectLanguages,
  getSupportedLanguages,
  generateAnalysisReport
};