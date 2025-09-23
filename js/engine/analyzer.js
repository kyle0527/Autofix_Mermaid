/* eslint-disable no-unused-vars */

// js/engine/analyzer.js - JavaScript/TypeScript PoC Analyzer
// 使用 acorn 解析 JS/TS 並產生 IR，支援類別、函數、模組依賴分析

import { createIR, addEntity, addRelation } from './ir.js';
import { parseWithTreeSitter, isTreeSitterSupported, getTreeSitterLoader } from './tree-sitter-loader.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 增強版 JavaScript 專案分析器
 * 支援 Tree-sitter 精確解析 + Fallback 正則表達式解析
 * @param {Record<string, string>|string} filesOrPath - 檔案路徑對內容的對應，或專案路徑
 * @param {Object} options - 分析選項
 * @returns {Promise<Object>} IR 格式的分析結果
 */
export async function analyzeJavaScriptProject(filesOrPath, options = {}) {
  // 判斷輸入類型並處理檔案
  let files;
  if (typeof filesOrPath === 'string') {
    // 輸入為專案路徑，需要掃描檔案
    files = await scanJavaScriptFiles(filesOrPath);
  } else {
    // 輸入為檔案物件
    files = filesOrPath || {};
  }

  const useTreeSitter = options.useTreeSitter !== false && isTreeSitterSupported('javascript');
  
  const ir = createIR({
    language: 'javascript',
    analyzer: useTreeSitter ? 'tree-sitter' : 'regex-fallback',
    version: '2.0.0',
    treeSitterEnabled: useTreeSitter
  });

  // 統計資訊
  const stats = {
    filesProcessed: 0,
    classesFound: 0,
    functionsFound: 0,
    importsFound: 0,
    methodsFound: 0,
    errorsFound: 0,
    parsingMethod: useTreeSitter ? 'tree-sitter' : 'regex-fallback',
    errors: []
  };

  // 處理每個檔案
  for (const [filePath, content] of Object.entries(files)) {
    if (!isJavaScriptFile(filePath)) continue;

    try {
      stats.filesProcessed++;
      const moduleName = getModuleName(filePath);
      
      if (useTreeSitter) {
        await parseFileWithTreeSitter(ir, filePath, content, moduleName, stats);
      } else {
        parseWithRegexFallback(ir, filePath, content, moduleName, stats);
      }
    } catch (error) {
      stats.errorsFound++;
      stats.errors.push({
        file: filePath,
        error: error.message,
        type: 'parse_error'
      });
      
      // Tree-sitter 失敗時回退到正則表達式
      if (useTreeSitter && !options.strictTreeSitter) {
        try {
          console.warn(`🔄 Tree-sitter failed for ${filePath}, falling back to regex parser`);
          const moduleName = getModuleName(filePath);
          parseWithRegexFallback(ir, filePath, content, moduleName, stats);
          stats.parsingMethod = 'tree-sitter+fallback';
        } catch (fallbackError) {
          console.error(`❌ Both parsers failed for ${filePath}:`, fallbackError);
        }
      }
    }
  }

  // 分析跨檔案關係
  analyzeRelations(ir, files);

  // 加入統計資訊到 IR
  ir.meta.stats = stats;
  
  // 更新統計資訊
  stats.entitiesFound = ir.entities.length;
  stats.relationsFound = ir.relations.length;

  console.log(`[Analyzer] 完成分析 - 檔案: ${stats.filesProcessed}, 實體: ${stats.entitiesFound}, 關係: ${stats.relationsFound}`);
  
  return { ir, stats };
}

/**
 * 檢查是否為 JavaScript/TypeScript 檔案
 */
function isJavaScriptFile(filePath) {
  return /\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(filePath);
}

/**
 * 掃描專案目錄中的所有 JavaScript/TypeScript 檔案
 */
async function scanJavaScriptFiles(projectPath) {
  const files = {};
  
  async function scanDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // 跳過常見的忽略目錄
          if (!['node_modules', '.git', 'dist', 'build', '.vscode', 'coverage'].includes(entry.name)) {
            await scanDirectory(fullPath);
          }
        } else if (entry.isFile() && isJavaScriptFile(fullPath)) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            files[fullPath] = content;
          } catch (error) {
            console.warn(`[Scanner] 無法讀取檔案 ${fullPath}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.warn(`[Scanner] 無法掃描目錄 ${dirPath}:`, error.message);
    }
  }
  
  await scanDirectory(projectPath);
  return files;
}

/**
 * 使用 Tree-sitter 解析單一檔案
 */
async function parseFileWithTreeSitter(ir, filePath, content, stats) {
  const moduleName = getModuleName(filePath);
  
  // 加入模組實體
  const moduleId = addEntity(ir, {
    id: `module:${moduleName}`,
    kind: 'module',
    name: moduleName,
    file: filePath,
    data: {
      path: filePath,
      size: content.length,
      parser: 'tree-sitter'
    }
  });

  // 使用 Tree-sitter 解析
  const languageName = filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript' : 'javascript';
  const tree = await parseWithTreeSitter(content, languageName);
  
  if (!tree) {
    throw new Error('Tree-sitter parsing returned null');
  }

  // 遍歷 AST
  walkTreeSitterNode(ir, tree.rootNode, content, moduleName, filePath, stats);
}

/**
 * 使用正則表達式解析單一檔案 (已廢棄，請使用 parseWithRegexFallback)
 */
function parseFileWithRegex(ir, filePath, content, stats) {
  const moduleName = getModuleName(filePath);
  
  // 加入模組實體
  const moduleId = addEntity(ir, {
    id: `module:${moduleName}`,
    kind: 'module',
    name: moduleName,
    file: filePath,
    data: {
      path: filePath,
      size: content.length,
      parser: 'regex-fallback'
    }
  });

  // 使用正則表達式解析
  parseWithRegexFallback(ir, filePath, content, moduleName, stats);
}

/**
 * Tree-sitter AST 遍歷
 */
function walkTreeSitterNode(ir, node, sourceCode, moduleName, filePath, stats) {
  const nodeType = node.type;
  
  switch (nodeType) {
    case 'import_statement':
    case 'import_declaration':
      parseTreeSitterImport(ir, node, sourceCode, moduleName, filePath, stats);
      break;
      
    case 'class_declaration':
      parseTreeSitterClass(ir, node, sourceCode, moduleName, filePath, stats);
      break;
      
    case 'function_declaration':
    case 'function_expression':
    case 'arrow_function':
      parseTreeSitterFunction(ir, node, sourceCode, moduleName, filePath, stats);
      break;
      
    case 'method_definition':
      parseTreeSitterMethod(ir, node, sourceCode, moduleName, filePath, stats);
      break;
      
    case 'export_statement':
    case 'export_declaration':
      parseTreeSitterExport(ir, node, sourceCode, moduleName, filePath, stats);
      break;
  }

  // 遞歸處理子節點
  for (const child of node.children) {
    walkTreeSitterNode(ir, child, sourceCode, moduleName, filePath, stats);
  }
}

/**
 * Tree-sitter 匯入解析
 */
function parseTreeSitterImport(ir, node, sourceCode, moduleName, filePath, stats) {
  const text = sourceCode.slice(node.startIndex, node.endIndex);
  const sourceNode = node.children.find(child => 
    child.type === 'string' || child.type === 'string_literal'
  );
  
  if (sourceNode) {
    const importPath = sourceCode.slice(sourceNode.startIndex + 1, sourceNode.endIndex - 1); // 移除引號
    const importId = `import:${moduleName}:${importPath}`;
    
    addEntity(ir, {
      id: importId,
      kind: 'import',
      name: importPath,
      file: filePath,
      line: node.startPosition.row + 1,
      data: {
        type: 'es6',
        from: moduleName,
        to: importPath,
        fullStatement: text
      }
    });

    addRelation(ir, {
      from: `module:${moduleName}`,
      to: `module:${importPath}`,
      type: 'IMPORTS'
    });

    stats.importsFound++;
  }
}

/**
 * Tree-sitter 類別解析
 */
function parseTreeSitterClass(ir, node, sourceCode, moduleName, filePath, stats) {
  const nameNode = node.children.find(child => child.type === 'identifier');
  if (!nameNode) return;
  
  const className = sourceCode.slice(nameNode.startIndex, nameNode.endIndex);
  const line = node.startPosition.row + 1;
  
  // 查找繼承
  const heritageNode = node.children.find(child => 
    child.type === 'class_heritage' || child.type === 'extends_clause'
  );
  let parentClass = null;
  
  if (heritageNode) {
    const parentNode = heritageNode.children.find(child => child.type === 'identifier');
    if (parentNode) {
      parentClass = sourceCode.slice(parentNode.startIndex, parentNode.endIndex);
    }
  }

  const classId = addEntity(ir, {
    id: `class:${moduleName}.${className}`,
    kind: 'class',
    name: className,
    file: filePath,
    line,
    data: {
      module: moduleName,
      parent: parentClass,
      type: 'es6'
    }
  });

  // 繼承關係
  if (parentClass) {
    addRelation(ir, {
      from: `class:${moduleName}.${className}`,
      to: `class:${moduleName}.${parentClass}`,
      type: 'EXTENDS'
    });
  }

  stats.classesFound++;
}

/**
 * Tree-sitter 函數解析
 */
function parseTreeSitterFunction(ir, node, sourceCode, moduleName, filePath, stats) {
  // 查找函數名
  let functionName = null;
  const nameNode = node.children.find(child => child.type === 'identifier');
  
  if (nameNode) {
    functionName = sourceCode.slice(nameNode.startIndex, nameNode.endIndex);
  } else if (node.type === 'arrow_function') {
    // 箭頭函數可能沒有名稱，需要從上下文推斷
    functionName = 'anonymous';
  }

  if (functionName) {
    const line = node.startPosition.row + 1;
    
    addEntity(ir, {
      id: `function:${moduleName}.${functionName}`,
      kind: 'function',
      name: functionName,
      file: filePath,
      line,
      data: {
        module: moduleName,
        type: node.type,
        async: node.children.some(child => child.type === 'async')
      }
    });

    stats.functionsFound++;
  }
}

/**
 * Tree-sitter 方法解析
 */
function parseTreeSitterMethod(ir, node, sourceCode, moduleName, filePath, stats) {
  const nameNode = node.children.find(child => 
    child.type === 'property_identifier' || child.type === 'identifier'
  );
  
  if (nameNode) {
    const methodName = sourceCode.slice(nameNode.startIndex, nameNode.endIndex);
    const line = node.startPosition.row + 1;
    
    // 查找所屬類別 (向上查找 class_declaration)
    let className = 'Unknown';
    let currentNode = node.parent;
    
    while (currentNode) {
      if (currentNode.type === 'class_declaration') {
        const classNameNode = currentNode.children.find(child => child.type === 'identifier');
        if (classNameNode) {
          className = sourceCode.slice(classNameNode.startIndex, classNameNode.endIndex);
        }
        break;
      }
      currentNode = currentNode.parent;
    }

    addEntity(ir, {
      id: `method:${moduleName}.${className}.${methodName}`,
      kind: 'method',
      name: methodName,
      file: filePath,
      line,
      data: {
        class: className,
        module: moduleName,
        static: node.children.some(child => child.type === 'static'),
        async: node.children.some(child => child.type === 'async')
      }
    });

    // 方法屬於類別的關係
    addRelation(ir, {
      from: `method:${moduleName}.${className}.${methodName}`,
      to: `class:${moduleName}.${className}`,
      type: 'BELONGS_TO'
    });

    stats.methodsFound++;
  }
}

/**
 * Tree-sitter 匯出解析
 */
function parseTreeSitterExport(ir, node, sourceCode, moduleName, filePath, stats) {
  const text = sourceCode.slice(node.startIndex, node.endIndex);
  
  // 簡化的匯出處理
  const exportMatch = text.match(/export\s+(?:default\s+)?(?:(?:const|let|var|function|class)\s+(\w+)|(\w+))/);
  
  if (exportMatch) {
    const exportName = exportMatch[1] || exportMatch[2];
    
    addEntity(ir, {
      id: `export:${moduleName}.${exportName}`,
      kind: 'export',
      name: exportName,
      file: filePath,
      line: node.startPosition.row + 1,
      data: {
        module: moduleName,
        type: text.includes('default') ? 'default' : 'named'
      }
    });
  }
}

/**
 * 正則表達式解析器 (Fallback)
 */
function parseWithRegexFallback(ir, filePath, content, moduleName, stats) {
  const lines = content.split('\n');

  // 1. 解析 ES6/CommonJS 匯入
  parseImports(ir, content, moduleName, filePath, stats);

  // 2. 解析類別定義
  parseClasses(ir, content, moduleName, filePath, lines, stats);

  // 3. 解析函數定義
  parseFunctions(ir, content, moduleName, filePath, lines, stats);

  // 4. 解析匯出
  parseExports(ir, content, moduleName, filePath, stats);
}

/**
 * 解析匯入語句
 */
function parseImports(ir, content, moduleName, filePath, stats) {
  // ES6 import
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g;
  
  // CommonJS require
  const requireRegex = /require\s*\(['"`]([^'"`]+)['"`]\)/g;

  let match;
  
  // ES6 imports
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const importId = `import:${moduleName}:${importPath}`;
    
    addEntity(ir, {
      id: importId,
      kind: 'import',
      name: importPath,
      file: filePath,
      data: {
        type: 'es6',
        from: moduleName,
        to: importPath
      }
    });

    // 加入匯入關係
    addRelation(ir, {
      from: `module:${moduleName}`,
      to: `module:${importPath}`,
      type: 'IMPORTS'
    });

    stats.importsFound++;
  }

  // CommonJS requires
  while ((match = requireRegex.exec(content)) !== null) {
    const requirePath = match[1];
    const requireId = `import:${moduleName}:${requirePath}`;
    
    addEntity(ir, {
      id: requireId,
      kind: 'import',
      name: requirePath,
      file: filePath,
      data: {
        type: 'commonjs',
        from: moduleName,
        to: requirePath
      }
    });

    addRelation(ir, {
      from: `module:${moduleName}`,
      to: `module:${requirePath}`,
      type: 'REQUIRES'
    });

    stats.importsFound++;
  }
}

/**
 * 解析類別定義
 */
function parseClasses(ir, content, moduleName, filePath, lines, stats) {
  // ES6 class 和 function constructor
  const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
  const functionClassRegex = /function\s+(\w+)\s*\([^)]*\)\s*\{[\s\S]*?this\./;

  let match;

  // ES6 classes
  while ((match = classRegex.exec(content)) !== null) {
    const className = match[1];
    const parentClass = match[2];
    const line = getLineNumber(content, match.index);

    const classId = addEntity(ir, {
      id: `class:${moduleName}.${className}`,
      kind: 'class',
      name: className,
      file: filePath,
      line,
      data: {
        module: moduleName,
        parent: parentClass,
        type: 'es6'
      }
    });

    // 繼承關係
    if (parentClass) {
      addRelation(ir, {
        from: `class:${moduleName}.${className}`,
        to: `class:${moduleName}.${parentClass}`,
        type: 'EXTENDS'
      });
    }

    // 解析類別方法
    parseClassMethods(ir, content, className, moduleName, filePath, match.index);

    stats.classesFound++;
  }
}

/**
 * 解析函數定義
 */
function parseFunctions(ir, content, moduleName, filePath, lines, stats) {
  // function declarations, arrow functions, method definitions
  const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(|\w+\s*:\s*(?:async\s+)?function|\w+\s*:\s*\([^)]*\)\s*=>)/g;
  
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const functionName = match[1] || match[2] || extractFunctionName(match[0]);
    if (!functionName) continue;

    const line = getLineNumber(content, match.index);
    
    addEntity(ir, {
      id: `function:${moduleName}.${functionName}`,
      kind: 'function',
      name: functionName,
      file: filePath,
      line,
      data: {
        module: moduleName,
        type: detectFunctionType(match[0])
      }
    });

    stats.functionsFound++;
  }
}

/**
 * 解析類別方法
 */
function parseClassMethods(ir, content, className, moduleName, filePath, classStartIndex) {
  // 從類別開始位置解析方法
  const classContent = content.substring(classStartIndex);
  const methodRegex = /(\w+)\s*\([^)]*\)\s*\{/g;
  
  let match;
  while ((match = methodRegex.exec(classContent)) !== null) {
    const methodName = match[1];
    if (methodName === 'constructor' || methodName === className) continue;

    addEntity(ir, {
      id: `method:${moduleName}.${className}.${methodName}`,
      kind: 'method',
      name: methodName,
      file: filePath,
      data: {
        class: className,
        module: moduleName
      }
    });

    // 方法屬於類別的關係
    addRelation(ir, {
      from: `method:${moduleName}.${className}.${methodName}`,
      to: `class:${moduleName}.${className}`,
      type: 'BELONGS_TO'
    });
  }
}

/**
 * 解析匯出語句
 */
function parseExports(ir, content, moduleName, filePath, stats) {
  // export default, export { }, export const/function/class
  const exportRegex = /export\s+(?:default\s+)?(?:(?:const|let|var|function|class)\s+(\w+)|(\w+))/g;
  
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    const exportName = match[1] || match[2];
    
    addEntity(ir, {
      id: `export:${moduleName}.${exportName}`,
      kind: 'export',
      name: exportName,
      file: filePath,
      data: {
        module: moduleName,
        type: match[0].includes('default') ? 'default' : 'named'
      }
    });
  }
}

/**
 * 分析跨檔案關係
 */
function analyzeRelations(ir, files) {
  // 建立函數呼叫關係
  for (const entity of ir.entities) {
    if (entity.kind === 'function' || entity.kind === 'method') {
      analyzeFunctionCalls(ir, entity, files);
    }
  }
}

/**
 * 分析函數呼叫關係
 */
function analyzeFunctionCalls(ir, functionEntity, files) {
  const filePath = functionEntity.file;
  const content = files[filePath];
  if (!content) return;

  // 簡化的函數呼叫檢測
  const callRegex = /(\w+)\s*\(/g;
  let match;
  
  while ((match = callRegex.exec(content)) !== null) {
    const calledFunction = match[1];
    
    // 尋找被呼叫的函數
    const targetFunction = ir.entities.find(e => 
      (e.kind === 'function' || e.kind === 'method') && 
      e.name === calledFunction
    );

    if (targetFunction) {
      addRelation(ir, {
        from: functionEntity.id,
        to: targetFunction.id,
        type: 'CALLS'
      });
    }
  }
}

/**
 * 輔助函數
 */
function getModuleName(filePath) {
  return filePath
    .replace(/\\/g, '/')
    .replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/i, '')
    .replace(/^\.?\//, '');
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function extractFunctionName(matchText) {
  const nameMatch = matchText.match(/(\w+)/);
  return nameMatch ? nameMatch[1] : null;
}

function detectFunctionType(matchText) {
  if (matchText.includes('=>')) return 'arrow';
  if (matchText.includes('async')) return 'async';
  if (matchText.includes('function')) return 'declaration';
  return 'expression';
}

// 匯出主要函數
export { analyzeJavaScriptProject as default };