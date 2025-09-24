/* eslint-disable no-unused-vars */

// js/engine/processor.js - 主要處理引擎
// 整合分析器、生成器和修復器，提供完整的程式碼到 Mermaid 轉換流程

import fs from 'fs/promises';
import path from 'path';
import { analyzeJavaScriptProject } from './analyzer.js';
import { generateMermaidDiagram } from './emitter.js';
import { applyFixes } from '../autofix.js';

/**
 * 主要處理函數：從程式碼到 Mermaid 圖表的完整流程
 * @param {Record<string, string>|FileList} input - 檔案內容或 FileList
 * @param {Object} options - 處理選項
 * @returns {Promise<Object>} 處理結果
 */
export async function processCodeToMermaid(input, options = {}) {
  const startTime = Date.now();
  const result = {
    success: false,
    data: null,
    errors: [],
    warnings: [],
    stats: {},
    trace: []
  };

  try {
    // 階段 1: 準備輸入檔案
    result.trace.push({ stage: 'prepare', timestamp: Date.now() });
    const files = await prepareFiles(input);
    
    if (Object.keys(files).length === 0) {
      throw new Error('No valid files found for processing');
    }

    result.stats.filesCount = Object.keys(files).length;

    // 階段 2: 偵測語言和專案類型
    result.trace.push({ stage: 'detect', timestamp: Date.now() });
    const detection = detectProjectType(files);
    result.stats.detection = detection;
    
    if (!detection || !detection.language) {
      throw new Error('Unable to detect project language');
    }

    // 階段 3: 分析程式碼結構
    result.trace.push({ stage: 'analyze', timestamp: Date.now() });
    const analyzer = getAnalyzer(detection.language);
    const analysisResult = await analyzer(files, options.analyzeOptions || {});
    const ir = analysisResult?.ir || analysisResult;

    if (!ir || !ir.entities) {
      throw new Error('Analyzer did not return a valid IR structure');
    }

    result.stats.analysis = analysisResult?.stats || ir.meta?.stats || {};

    // 階段 4: 生成 Mermaid 圖表
    result.trace.push({ stage: 'generate', timestamp: Date.now() });
    const diagramType = options.diagramType || detection.recommendedDiagram || 'class';
    const generation = generateMermaidDiagram(ir, diagramType, options.generateOptions || {});
    
    // 階段 5: 應用修復規則
    result.trace.push({ stage: 'fix', timestamp: Date.now() });
    const fixResult = applyFixes(generation.code, options.fixOptions || {});
    
    // 整合結果
    result.success = true;
    result.data = {
      ir,
      analysis: analysisResult,
      mermaid: {
        raw: generation.code,
        fixed: fixResult.code,
        type: diagramType
      },
      notes: [
        ...generation.notes,
        ...fixResult.notes
      ],
      errors: fixResult.errors
    };

    result.mermaid = fixResult.code;
    result.mermaidRaw = generation.code;
    result.notes = result.data.notes;

    // 收集警告
    if (generation.notes.includes('no_classes_found')) {
      result.warnings.push('No classes detected - flowchart might be more appropriate');
    }
    if (fixResult.notes.length > 5) {
      result.warnings.push('Many syntax fixes applied - please review the output');
    }

    result.stats.processingTime = Date.now() - startTime;
    result.trace.push({ stage: 'complete', timestamp: Date.now() });

  } catch (error) {
    result.success = false;
    result.errors.push({
      type: 'processing_error',
      message: error.message,
      stack: error.stack
    });
    result.trace.push({ 
      stage: 'error', 
      timestamp: Date.now(), 
      error: error.message 
    });
  }

  return result;
}

/**
 * 準備輸入檔案
 */
async function prepareFiles(input) {
  const files = {};

  if (typeof FileList !== 'undefined' && input instanceof FileList) {
    // 處理瀏覽器 FileList
    for (let i = 0; i < input.length; i++) {
      const file = input[i];
      const relativePath = file.webkitRelativePath || file.name;

      if (isSupportedFile(relativePath)) {
        try {
          files[relativePath] = await file.text();
        } catch (error) {
          console.warn(`Failed to read file ${relativePath}:`, error);
        }
      }
    }
  } else if (input && typeof input === 'object') {
    // 處理檔案物件
    Object.assign(files, input);
  } else if (typeof input === 'string') {
    const candidatePath = await resolvePathCandidate(input);

    if (candidatePath) {
      const stat = await safeStat(candidatePath);

      if (stat?.isDirectory()) {
        await collectFilesFromDirectory(candidatePath, files);
      } else if (stat?.isFile()) {
        if (isSupportedFile(candidatePath)) {
          try {
            files[candidatePath] = await fs.readFile(candidatePath, 'utf-8');
          } catch (error) {
            console.warn(`Failed to read file ${candidatePath}:`, error);
          }
        }
      }
    }

    if (Object.keys(files).length === 0) {
      // 將輸入視為程式碼字串
      files['main.js'] = input;
    }
  }

  return files;
}

async function resolvePathCandidate(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const directStat = await safeStat(trimmed);
  if (directStat) {
    return trimmed;
  }

  try {
    const resolved = path.resolve(trimmed);
    const resolvedStat = await safeStat(resolved);
    return resolvedStat ? resolved : null;
  } catch (error) {
    return null;
  }
}

async function safeStat(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch (error) {
    return null;
  }
}

async function collectFilesFromDirectory(dirPath, files) {
  const ignoreDirs = new Set(['node_modules', '.git', '.svn', 'dist', 'build', '.venv', 'venv', 'env', '__pycache__']);

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          await collectFilesFromDirectory(fullPath, files);
        }
      } else if (entry.isFile() && isSupportedFile(fullPath)) {
        try {
          files[fullPath] = await fs.readFile(fullPath, 'utf-8');
        } catch (error) {
          console.warn(`Failed to read file ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to scan directory ${dirPath}:`, error);
  }
}

/**
 * 偵測專案類型和語言
 */
function detectProjectType(files) {
  const filePaths = Object.keys(files);
  const extensions = filePaths.map(path => {
    const match = path.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }).filter(Boolean);

  const extensionCounts = extensions.reduce((acc, ext) => {
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});

  // JavaScript/TypeScript 偵測
  const jsExtensions = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
  const jsCount = jsExtensions.reduce((sum, ext) => sum + (extensionCounts[ext] || 0), 0);

  // Python 偵測
  const pyCount = extensionCounts['py'] || 0;

  // 其他語言偵測
  const javaCount = extensionCounts['java'] || 0;
  const csharpCount = (extensionCounts['cs'] || 0) + (extensionCounts['csproj'] || 0);

  let language = 'unknown';
  let confidence = 0;
  let recommendedDiagram = 'flowchart';

  if (jsCount > 0) {
    language = 'javascript';
    confidence = Math.min(jsCount / filePaths.length, 0.9);
    recommendedDiagram = hasClasses(files) ? 'class' : 'flowchart';
  } else if (pyCount > 0) {
    language = 'python';
    confidence = Math.min(pyCount / filePaths.length, 0.9);
    recommendedDiagram = 'class';
  } else if (javaCount > 0) {
    language = 'java';
    confidence = Math.min(javaCount / filePaths.length, 0.9);
    recommendedDiagram = 'class';
  } else if (csharpCount > 0) {
    language = 'csharp';
    confidence = Math.min(csharpCount / filePaths.length, 0.9);
    recommendedDiagram = 'class';
  }

  return {
    language,
    confidence,
    recommendedDiagram,
    extensions: extensionCounts,
    reason: `Detected based on file extensions: ${Object.keys(extensionCounts).join(', ')}`
  };
}

/**
 * 檢查是否包含類別定義
 */
function hasClasses(files) {
  for (const content of Object.values(files)) {
    if (/class\s+\w+/i.test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * 獲取對應的分析器
 */
function getAnalyzer(language) {
  const analyzers = {
    'javascript': analyzeJavaScriptProject,
    'typescript': analyzeJavaScriptProject, // 使用相同的分析器
    'python': analyzePythonProject, // 需要實作
    'java': analyzeJavaProject, // 需要實作
    'csharp': analyzeCSharpProject // 需要實作
  };

  return analyzers[language] || analyzeJavaScriptProject;
}

/**
 * Python 專案分析器 (暫時使用簡化版本)
 */
function analyzePythonProject(files, options = {}) {
  // 暫時返回基本的 IR 結構
  // 後續整合現有的 Python 分析器
  return {
    meta: { 
      language: 'python', 
      stats: { 
        filesProcessed: Object.keys(files).length,
        classesFound: 0,
        functionsFound: 0,
        importsFound: 0,
        errors: []
      } 
    },
    entities: [],
    relations: []
  };
}

/**
 * Java 專案分析器佔位符
 */
function analyzeJavaProject(files, options = {}) {
  return {
    meta: { 
      language: 'java', 
      stats: { 
        filesProcessed: Object.keys(files).length,
        classesFound: 0,
        functionsFound: 0,
        importsFound: 0,
        errors: []
      } 
    },
    entities: [],
    relations: []
  };
}

/**
 * C# 專案分析器佔位符
 */
function analyzeCSharpProject(files, options = {}) {
  return {
    meta: { 
      language: 'csharp', 
      stats: { 
        filesProcessed: Object.keys(files).length,
        classesFound: 0,
        functionsFound: 0,
        importsFound: 0,
        errors: []
      } 
    },
    entities: [],
    relations: []
  };
}

/**
 * 檢查檔案是否支援
 */
function isSupportedFile(filePath) {
  const supportedExtensions = [
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',  // JavaScript/TypeScript
    'py', 'pyi',                              // Python
    'java',                                   // Java
    'cs',                                     // C#
    'go',                                     // Go
    'rs',                                     // Rust
    'cpp', 'cc', 'cxx', 'h', 'hpp'          // C++
  ];

  const extension = filePath.split('.').pop()?.toLowerCase();
  return supportedExtensions.includes(extension);
}

/**
 * 批次處理多個專案
 */
export async function batchProcess(projects, options = {}) {
  const results = [];
  
  for (const project of projects) {
    const result = await processCodeToMermaid(project.files, {
      ...options,
      projectName: project.name
    });
    
    results.push({
      name: project.name,
      ...result
    });
  }
  
  return results;
}

/**
 * 獲取支援的圖表類型
 */
export function getSupportedDiagramTypes() {
  return [
    { type: 'class', name: 'Class Diagram', description: 'Shows classes and their relationships' },
    { type: 'flowchart', name: 'Flowchart', description: 'Shows program flow and logic' },
    { type: 'dependency', name: 'Dependency Graph', description: 'Shows module dependencies' },
    { type: 'call', name: 'Call Graph', description: 'Shows function call relationships' },
    { type: 'sequence', name: 'Sequence Diagram', description: 'Shows interactions over time' }
  ];
}

/**
 * 驗證處理選項
 */
export function validateOptions(options) {
  const errors = [];
  const warnings = [];
  
  if (options.diagramType && !['class', 'flowchart', 'dependency', 'call', 'sequence'].includes(options.diagramType)) {
    errors.push(`Unsupported diagram type: ${options.diagramType}`);
  }
  
  return { errors, warnings };
}

// 匯出主要函數
export { processCodeToMermaid as default };