/**
 * Python 分析器
 * 使用 Tree-sitter 解析 Python 程式碼並生成 IR
 */

// 導入依賴
import { TreeSitterLoader } from './tree-sitter-loader.js';
import { addEntity, addRelation } from './ir.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 分析 Python 專案
 */
async function analyzePythonProject(projectPath) {
  const ir = {
    entities: [],
    relations: [],
    metadata: {
      name: 'python-analysis',
      timestamp: new Date().toISOString(),
      analyzer: 'python-tree-sitter',
      version: '1.0.0'
    }
  };

  const stats = {
    filesProcessed: 0,
    entitiesFound: 0,
    relationsFound: 0,
    errorsFound: 0,
    errors: [],
    parsingMethod: 'tree-sitter',
    modulesFound: 0,
    classesFound: 0,
    functionsFound: 0,
    methodsFound: 0,
    importsFound: 0
  };

  try {
    console.log(`[Python Analyzer] 開始分析專案: ${projectPath}`);
    
    // 嘗試初始化 Tree-sitter
    let loader = null;
    let useTreeSitter = false;
    
    try {
      loader = new TreeSitterLoader();
      await loader.loadLanguage('python', 'js/wasm/tree-sitter-python.wasm');
      useTreeSitter = true;
      console.log(`[Python Analyzer] Tree-sitter 初始化成功`);
    } catch (error) {
      console.warn(`[Python Analyzer] Tree-sitter 初始化失敗，將使用正則表達式解析:`, error.message);
      useTreeSitter = false;
    }

    const files = await getAllPythonFiles(projectPath);
    console.log(`[Python Analyzer] 發現 ${files.length} 個 Python 檔案`);

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const moduleName = getPythonModuleName(filePath);
        
        if (useTreeSitter && loader) {
          await parsePythonFile(loader, ir, filePath, content, moduleName, stats);
        } else {
          parsePythonWithRegex(ir, filePath, content, moduleName, stats);
        }
        
      } catch (error) {
        stats.errorsFound++;
        stats.errors.push({
          file: filePath,
          error: error.message,
          type: 'file_read_error'
        });
        console.error(`[Python Analyzer] 無法讀取檔案 ${filePath}:`, error);
      }
    }

    // 更新統計
    stats.entitiesFound = ir.entities.length;
    stats.relationsFound = ir.relations.length;
    
    console.log(`[Python Analyzer] 完成分析 - 檔案: ${stats.filesProcessed}, 實體: ${stats.entitiesFound}, 關係: ${stats.relationsFound}`);
    
    return { ir, stats };

  } catch (error) {
    console.error('[Python Analyzer] 分析失敗:', error);
    stats.errorsFound++;
    stats.errors.push({
      error: error.message,
      type: 'analyzer_error'
    });
    
    return { ir, stats };
  }
}

/**
 * 解析單個 Python 檔案
 */
async function parsePythonFile(loader, ir, filePath, content, moduleName, stats) {
  try {
    stats.filesProcessed++;
    
    // 使用 Tree-sitter 解析
    const parseResult = await loader.parse('python', content);
    
    if (parseResult.success && parseResult.tree) {
      console.log(`[Python Analyzer] 成功解析: ${filePath}`);
      
      // 加入模組實體
      addEntity(ir, {
        id: `module:${moduleName}`,
        kind: 'module',
        name: moduleName,
        file: filePath,
        line: 1,
        data: {
          type: 'python',
          path: filePath,
          size: content.length,
          parser: 'tree-sitter'
        }
      });
      
      stats.modulesFound++;
      
      // 遍歷 AST
      walkPythonNode(ir, parseResult.tree.rootNode, content, moduleName, filePath, stats);
      
    } else {
      throw new Error('Tree-sitter 解析失敗');
    }

  } catch (error) {
    console.error(`[Python Analyzer] 解析 ${filePath} 時發生錯誤:`, error);
    
    // 回退到正則表達式解析
    try {
      console.warn(`🔄 Tree-sitter failed for ${filePath}, falling back to regex parser`);
      parsePythonWithRegex(ir, filePath, content, moduleName, stats);
      stats.parsingMethod = 'tree-sitter+fallback';
    } catch (fallbackError) {
      console.error(`❌ Both parsers failed for ${filePath}:`, fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Tree-sitter AST 遍歷 (Python)
 */
function walkPythonNode(ir, node, sourceCode, moduleName, filePath, stats) {
  const nodeType = node.type;
  
  switch (nodeType) {
    case 'import_statement':
    case 'import_from_statement':
      parsePythonImport(ir, node, sourceCode, moduleName, filePath, stats);
      break;
      
    case 'class_definition':
      parsePythonClass(ir, node, sourceCode, moduleName, filePath, stats);
      break;
      
    case 'function_definition':
      parsePythonFunction(ir, node, sourceCode, moduleName, filePath, stats);
      break;
  }

  // 遞歸處理子節點
  for (const child of node.children) {
    walkPythonNode(ir, child, sourceCode, moduleName, filePath, stats);
  }
}

/**
 * Python 匯入解析
 */
function parsePythonImport(ir, node, sourceCode, moduleName, filePath, stats) {
  const text = sourceCode.slice(node.startIndex, node.endIndex);
  const line = node.startPosition.row + 1;

  if (node.type === 'import_statement') {
    // import module
    const moduleNames = [];
    for (const child of node.children) {
      if (child.type === 'dotted_name' || child.type === 'identifier') {
        moduleNames.push(sourceCode.slice(child.startIndex, child.endIndex));
      }
    }

    for (const importedModule of moduleNames) {
      const importId = `import:${moduleName}:${importedModule}`;
      
      addEntity(ir, {
        id: importId,
        kind: 'import',
        name: importedModule,
        file: filePath,
        line,
        data: {
          type: 'python',
          from: moduleName,
          to: importedModule,
          fullStatement: text
        }
      });

      addRelation(ir, {
        from: `module:${moduleName}`,
        to: `module:${importedModule}`,
        type: 'IMPORTS'
      });
    }
    
  } else if (node.type === 'import_from_statement') {
    // from module import item
    let fromModule = null;
    const importedItems = [];
    
    for (const child of node.children) {
      if (child.type === 'dotted_name' || child.type === 'identifier') {
        if (!fromModule) {
          fromModule = sourceCode.slice(child.startIndex, child.endIndex);
        }
      } else if (child.type === 'import_list') {
        for (const item of child.children) {
          if (item.type === 'identifier') {
            importedItems.push(sourceCode.slice(item.startIndex, item.endIndex));
          }
        }
      }
    }

    if (fromModule) {
      for (const item of importedItems) {
        const importId = `import:${moduleName}:${fromModule}.${item}`;
        
        addEntity(ir, {
          id: importId,
          kind: 'import',
          name: item,
          file: filePath,
          line,
          data: {
            type: 'python',
            from: moduleName,
            fromModule,
            to: item,
            fullStatement: text
          }
        });

        addRelation(ir, {
          from: `module:${moduleName}`,
          to: `module:${fromModule}`,
          type: 'IMPORTS'
        });
      }
    }
  }

  stats.importsFound++;
}

/**
 * Python 類別解析
 */
function parsePythonClass(ir, node, sourceCode, moduleName, filePath, stats) {
  // 查找類別名稱
  const nameNode = node.children.find(child => child.type === 'identifier');
  if (!nameNode) return;
  
  const className = sourceCode.slice(nameNode.startIndex, nameNode.endIndex);
  const line = node.startPosition.row + 1;
  
  // 查找繼承 (argument_list)
  const parentClasses = [];
  const argListNode = node.children.find(child => child.type === 'argument_list');
  
  if (argListNode) {
    for (const child of argListNode.children) {
      if (child.type === 'identifier') {
        parentClasses.push(sourceCode.slice(child.startIndex, child.endIndex));
      }
    }
  }

  addEntity(ir, {
    id: `class:${moduleName}.${className}`,
    kind: 'class',
    name: className,
    file: filePath,
    line,
    data: {
      module: moduleName,
      parents: parentClasses,
      type: 'python'
    }
  });

  // 繼承關係
  for (const parent of parentClasses) {
    addRelation(ir, {
      from: `class:${moduleName}.${className}`,
      to: `class:${moduleName}.${parent}`,
      type: 'EXTENDS'
    });
  }

  stats.classesFound++;
}

/**
 * Python 函數解析
 */
function parsePythonFunction(ir, node, sourceCode, moduleName, filePath, stats) {
  // 查找函數名稱
  const nameNode = node.children.find(child => child.type === 'identifier');
  if (!nameNode) return;
  
  const functionName = sourceCode.slice(nameNode.startIndex, nameNode.endIndex);
  const line = node.startPosition.row + 1;
  
  // 檢查是否為方法 (在類別內部)
  let className = null;
  let currentNode = node.parent;
  
  while (currentNode) {
    if (currentNode.type === 'class_definition') {
      const classNameNode = currentNode.children.find(child => child.type === 'identifier');
      if (classNameNode) {
        className = sourceCode.slice(classNameNode.startIndex, classNameNode.endIndex);
      }
      break;
    }
    currentNode = currentNode.parent;
  }

  if (className) {
    // 方法
    addEntity(ir, {
      id: `method:${moduleName}.${className}.${functionName}`,
      kind: 'method',
      name: functionName,
      file: filePath,
      line,
      data: {
        class: className,
        module: moduleName,
        type: 'python',
        isStatic: functionName.startsWith('__') && functionName.endsWith('__')
      }
    });

    // 方法屬於類別的關係
    addRelation(ir, {
      from: `method:${moduleName}.${className}.${functionName}`,
      to: `class:${moduleName}.${className}`,
      type: 'BELONGS_TO'
    });

    stats.methodsFound++;
    
  } else {
    // 獨立函數
    addEntity(ir, {
      id: `function:${moduleName}.${functionName}`,
      kind: 'function',
      name: functionName,
      file: filePath,
      line,
      data: {
        module: moduleName,
        type: 'python'
      }
    });

    stats.functionsFound++;
  }
}

/**
 * 正則表達式解析器 (Python Fallback)
 */
function parsePythonWithRegex(ir, filePath, content, moduleName, stats) {
  console.log(`[Python Analyzer] 使用正則表達式解析: ${filePath}`);
  
  // 更新統計
  stats.filesProcessed++;
  
  // 加入模組實體
  addEntity(ir, {
    id: `module:${moduleName}`,
    kind: 'module',
    name: moduleName,
    file: filePath,
    line: 1,
    data: {
      type: 'python',
      path: filePath,
      size: content.length,
      parser: 'regex-fallback'
    }
  });
  
  stats.modulesFound++;

  // 使用正則表達式解析
  parsePythonImportsRegex(ir, content, moduleName, filePath, stats);
  parsePythonClassesRegex(ir, content, moduleName, filePath, stats);
  parsePythonFunctionsRegex(ir, content, moduleName, filePath, stats);
}

/**
 * 正則表達式解析 Python 匯入
 */
function parsePythonImportsRegex(ir, content, moduleName, filePath, stats) {
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;
    
    // import module
    const importMatch = line.match(/^import\s+([\w\.,\s]+)/);
    if (importMatch) {
      const imports = importMatch[1].split(',').map(s => s.trim());
      
      for (const imp of imports) {
        const importId = `import:${moduleName}:${imp}`;
        
        addEntity(ir, {
          id: importId,
          kind: 'import',
          name: imp,
          file: filePath,
          line: lineNumber,
          data: {
            type: 'python',
            from: moduleName,
            to: imp,
            fullStatement: line
          }
        });

        addRelation(ir, {
          from: `module:${moduleName}`,
          to: `module:${imp}`,
          type: 'IMPORTS'
        });
      }
      
      stats.importsFound++;
    }
    
    // from module import item
    const fromImportMatch = line.match(/^from\s+([\w\.]+)\s+import\s+([\w\.,\s\*]+)/);
    if (fromImportMatch) {
      const fromModule = fromImportMatch[1];
      const imports = fromImportMatch[2] === '*' ? ['*'] : fromImportMatch[2].split(',').map(s => s.trim());
      
      for (const imp of imports) {
        const importId = `import:${moduleName}:${fromModule}.${imp}`;
        
        addEntity(ir, {
          id: importId,
          kind: 'import',
          name: imp,
          file: filePath,
          line: lineNumber,
          data: {
            type: 'python',
            from: moduleName,
            fromModule,
            to: imp,
            fullStatement: line
          }
        });

        addRelation(ir, {
          from: `module:${moduleName}`,
          to: `module:${fromModule}`,
          type: 'IMPORTS'
        });
      }
      
      stats.importsFound++;
    }
  }
}

/**
 * 正則表達式解析 Python 類別
 */
function parsePythonClassesRegex(ir, content, moduleName, filePath, stats) {
  const classRegex = /^class\s+(\w+)(?:\(([^)]+)\))?\s*:/gm;
  let match;
  
  while ((match = classRegex.exec(content)) !== null) {
    const className = match[1];
    const inheritance = match[2];
    const line = content.substring(0, match.index).split('\n').length;
    
    const parents = inheritance ? 
      inheritance.split(',').map(s => s.trim()) : [];

    addEntity(ir, {
      id: `class:${moduleName}.${className}`,
      kind: 'class',
      name: className,
      file: filePath,
      line,
      data: {
        module: moduleName,
        parents,
        type: 'python'
      }
    });

    // 繼承關係
    for (const parent of parents) {
      addRelation(ir, {
        from: `class:${moduleName}.${className}`,
        to: `class:${moduleName}.${parent}`,
        type: 'EXTENDS'
      });
    }

    stats.classesFound++;
  }
}

/**
 * 正則表達式解析 Python 函數
 */
function parsePythonFunctionsRegex(ir, content, moduleName, filePath, stats) {
  const lines = content.split('\n');
  let currentClass = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmedLine = line.trim();
    
    // 追蹤當前類別
    const classMatch = trimmedLine.match(/^class\s+(\w+)/);
    if (classMatch) {
      currentClass = classMatch[1];
      continue;
    }
    
    // 函數定義
    const funcMatch = line.match(/^(\s*)def\s+(\w+)\s*\(/);
    if (funcMatch) {
      const indentation = funcMatch[1];
      const functionName = funcMatch[2];
      
      // 根據縮排判斷是否為方法
      const isMethod = indentation.length > 0 && currentClass;
      
      if (isMethod) {
        addEntity(ir, {
          id: `method:${moduleName}.${currentClass}.${functionName}`,
          kind: 'method',
          name: functionName,
          file: filePath,
          line: lineNumber,
          data: {
            class: currentClass,
            module: moduleName,
            type: 'python',
            isStatic: functionName.startsWith('__') && functionName.endsWith('__')
          }
        });

        addRelation(ir, {
          from: `method:${moduleName}.${currentClass}.${functionName}`,
          to: `class:${moduleName}.${currentClass}`,
          type: 'BELONGS_TO'
        });

        stats.methodsFound++;
        
      } else {
        addEntity(ir, {
          id: `function:${moduleName}.${functionName}`,
          kind: 'function',
          name: functionName,
          file: filePath,
          line: lineNumber,
          data: {
            module: moduleName,
            type: 'python'
          }
        });

        stats.functionsFound++;
        
        // 如果不在類別中，重置 currentClass
        if (indentation.length === 0) {
          currentClass = null;
        }
      }
    }
  }
}

/**
 * 輔助函數：獲取所有 Python 檔案
 */
async function getAllPythonFiles(projectPath) {
  const files = [];
  
  async function scanDirectory(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // 跳過常見的忽略目錄
        if (!['node_modules', '.git', '__pycache__', '.venv', 'venv', 'env'].includes(entry.name)) {
          await scanDirectory(fullPath);
        }
      } else if (entry.isFile() && isPythonFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  
  await scanDirectory(projectPath);
  return files;
}

/**
 * 檢查是否為 Python 檔案
 */
function isPythonFile(filePath) {
  return filePath.endsWith('.py');
}

/**
 * 獲取 Python 模組名稱
 */
function getPythonModuleName(filePath) {
  const basename = path.basename(filePath, '.py');
  return basename;
}

export {
  analyzePythonProject,
  parsePythonFile,
  isPythonFile,
  getPythonModuleName
};