/**
 * 🔧 解析器整合介面
 * 
 * 將現有的解析器整合到多語言協調系統中
 * 提供適配器模式來包裝現有解析器
 */

import { 
  registerParser, 
  globalParserCoordinator 
} from './parser-coordination.js';

import { 
  propagateError 
} from './error-propagation.js';

/**
 * 🔧 解析器適配器基類
 */
export class ParserAdapter {
  constructor(options = {}) {
    this.id = options.id || this._generateId();
    this.name = options.name || 'Unknown Parser';
    this.version = options.version || '1.0.0';
    this.languages = options.languages || [];
    this.parser = options.parser || null;
    this.capabilities = {
      treeSitter: false,
      fallback: true,
      incremental: false,
      ...options.capabilities
    };
  }

  /**
   * 🆔 生成 ID
   */
  _generateId() {
    return `adapter_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * 🔍 偵測語言
   */
  async detect(files) {
    // 基本的檔案副檔名偵測
    const detectedLanguages = new Map();
    
    for (const filePath of Object.keys(files)) {
      const ext = this._getFileExtension(filePath);
      const language = this._mapExtensionToLanguage(ext);
      
      if (language && this.languages.includes(language)) {
        const count = detectedLanguages.get(language) || 0;
        detectedLanguages.set(language, count + 1);
      }
    }
    
    if (detectedLanguages.size === 0) {
      return null;
    }
    
    // 選擇最多的語言
    const [bestLang, count] = [...detectedLanguages.entries()]
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      lang: bestLang,
      confidence: count > 1 ? 'high' : 'medium',
      reason: `Found ${count} ${bestLang} files`,
      matchedFiles: Object.keys(files)
        .filter(f => this._mapExtensionToLanguage(this._getFileExtension(f)) === bestLang)
        .slice(0, 5)
    };
  }

  /**
   * 🔧 解析專案
   */
  async parseProject(files, options = {}) {
    if (!this.parser) {
      throw propagateError(new Error('No parser implementation provided'), {
        stage: 'parsing',
        component: 'parser_adapter',
        parserId: this.id
      });
    }
    
    try {
      // 調用原始解析器
      let result;
      if (typeof this.parser.parseProject === 'function') {
        result = await this.parser.parseProject(files, options);
      } else if (typeof this.parser.parse === 'function') {
        result = await this.parser.parse(files, options);
      } else if (typeof this.parser === 'function') {
        result = await this.parser(files, options);
      } else {
        throw new Error('Invalid parser implementation');
      }
      
      // 標準化結果格式
      return this._standardizeResult(result, files);
      
    } catch (error) {
      throw propagateError(error, {
        stage: 'parsing',
        component: 'parser_adapter',
        parserId: this.id,
        parserName: this.name
      });
    }
  }

  /**
   * 📄 取得檔案副檔名
   */
  _getFileExtension(filePath) {
    const parts = filePath.split('.');
    return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';
  }

  /**
   * 🗺️ 副檔名到語言的映射
   */
  _mapExtensionToLanguage(ext) {
    const mapping = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php'
    };
    return mapping[ext];
  }

  /**
   * 📊 標準化解析結果
   */
  _standardizeResult(result, files) {
    // 如果結果已經是標準格式，直接返回
    if (result && result.project && result.project.modules) {
      return result;
    }
    
    // 轉換為標準格式
    return {
      project: {
        name: result.name || 'Unknown Project',
        version: '1.0.0',
        modules: this._convertToModules(result, files),
        dependencies: result.dependencies || [],
        metadata: {
          parser: this.name,
          version: this.version,
          timestamp: new Date().toISOString(),
          ...result.metadata
        }
      }
    };
  }

  /**
   * 📦 轉換為模組格式
   */
  _convertToModules(result, files) {
    // 如果結果已經有模組格式
    if (result.modules) {
      return result.modules;
    }
    
    // 如果結果是檔案映射格式
    if (result.files) {
      return Object.entries(result.files).map(([path, content]) => ({
        path: path,
        name: this._getModuleName(path),
        functions: content.functions || [],
        classes: content.classes || [],
        variables: content.variables || [],
        imports: content.imports || [],
        exports: content.exports || []
      }));
    }
    
    // 如果結果是 IR 格式
    if (result.entities) {
      return [{
        path: 'main',
        name: 'main',
        entities: result.entities,
        relations: result.relations || []
      }];
    }
    
    // 預設格式：為每個輸入檔案建立一個模組
    return Object.keys(files).map(filePath => ({
      path: filePath,
      name: this._getModuleName(filePath),
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      exports: []
    }));
  }

  /**
   * 📝 取得模組名稱
   */
  _getModuleName(filePath) {
    return filePath
      .split('/')
      .pop()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_]/g, '_');
  }
}

/**
 * 🔧 JavaScript/TypeScript 解析器適配器
 */
export class JavaScriptParserAdapter extends ParserAdapter {
  constructor(parser, options = {}) {
    super({
      name: 'JavaScript/TypeScript Parser',
      version: '1.0.0',
      languages: ['javascript', 'typescript'],
      capabilities: {
        treeSitter: true,
        fallback: true,
        incremental: false
      },
      parser: parser,
      ...options
    });
  }

  async detect(files) {
    const jsFiles = Object.keys(files).filter(f => 
      /\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(f)
    );
    
    if (jsFiles.length === 0) {
      return null;
    }
    
    // 判斷是 JavaScript 還是 TypeScript
    const tsFiles = jsFiles.filter(f => /\.(ts|tsx)$/i.test(f));
    const language = tsFiles.length > 0 ? 'typescript' : 'javascript';
    
    return {
      lang: language,
      confidence: 'high',
      reason: `Found ${jsFiles.length} ${language} files`,
      matchedFiles: jsFiles.slice(0, 5)
    };
  }
}

/**
 * 🐍 Python 解析器適配器
 */
export class PythonParserAdapter extends ParserAdapter {
  constructor(parser, options = {}) {
    super({
      name: 'Python Parser',
      version: '1.0.0',
      languages: ['python'],
      capabilities: {
        treeSitter: true,
        fallback: true,
        incremental: false
      },
      parser: parser,
      ...options
    });
  }

  async detect(files) {
    const pyFiles = Object.keys(files).filter(f => 
      /\.py$/i.test(f)
    );
    
    if (pyFiles.length === 0) {
      return null;
    }
    
    return {
      lang: 'python',
      confidence: 'high',
      reason: `Found ${pyFiles.length} Python files`,
      matchedFiles: pyFiles.slice(0, 5)
    };
  }
}

/**
 * 🔧 正規表示式後備解析器適配器
 */
export class RegexFallbackAdapter extends ParserAdapter {
  constructor(options = {}) {
    super({
      name: 'Regex Fallback Parser',
      version: '1.0.0',
      languages: ['*'], // 支援所有語言
      capabilities: {
        treeSitter: false,
        fallback: true,
        incremental: false,
        universal: true
      },
      ...options
    });
  }

  async detect(files) {
    // 總是返回低信心度的偵測結果
    return {
      lang: 'unknown',
      confidence: 'low',
      reason: 'Fallback parser for unknown formats',
      matchedFiles: Object.keys(files).slice(0, 3)
    };
  }

  async parseProject(files) {
    const modules = [];
    
    for (const [filePath, content] of Object.entries(files)) {
      const module = {
        path: filePath,
        name: this._getModuleName(filePath),
        functions: this._extractFunctions(content),
        classes: this._extractClasses(content),
        variables: this._extractVariables(content),
        imports: this._extractImports(content),
        exports: this._extractExports(content)
      };
      
      modules.push(module);
    }
    
    return {
      project: {
        name: 'Regex Parsed Project',
        version: '1.0.0',
        modules: modules,
        metadata: {
          parser: this.name,
          version: this.version,
          timestamp: new Date().toISOString(),
          method: 'regex_fallback'
        }
      }
    };
  }

  /**
   * 🔍 提取函數
   */
  _extractFunctions(content) {
    const functions = [];
    
    // JavaScript/TypeScript 函數
    const jsFunctionRegex = /(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*(?:=\s*(?:async\s+)?(?:function\s*)?\s*\(|[=:]\s*(?:async\s+)?\(|\()/g;
    let match;
    while ((match = jsFunctionRegex.exec(content)) !== null) {
      functions.push({
        name: match[1],
        type: 'function',
        location: this._getLocation(content, match.index)
      });
    }
    
    // Python 函數
    const pyFunctionRegex = /def\s+(\w+)\s*\(/g;
    while ((match = pyFunctionRegex.exec(content)) !== null) {
      functions.push({
        name: match[1],
        type: 'function',
        location: this._getLocation(content, match.index)
      });
    }
    
    return functions;
  }

  /**
   * 🏗️ 提取類別
   */
  _extractClasses(content) {
    const classes = [];
    
    // JavaScript/TypeScript 類別
    const jsClassRegex = /class\s+(\w+)/g;
    let match;
    while ((match = jsClassRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        type: 'class',
        location: this._getLocation(content, match.index)
      });
    }
    
    // Python 類別
    const pyClassRegex = /class\s+(\w+)/g;
    while ((match = pyClassRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        type: 'class',
        location: this._getLocation(content, match.index)
      });
    }
    
    return classes;
  }

  /**
   * 📦 提取變數
   */
  _extractVariables(content) {
    const variables = [];
    
    // JavaScript/TypeScript 變數
    const jsVarRegex = /(?:const|let|var)\s+(\w+)\s*=/g;
    let match;
    while ((match = jsVarRegex.exec(content)) !== null) {
      variables.push({
        name: match[1],
        type: 'variable',
        location: this._getLocation(content, match.index)
      });
    }
    
    return variables;
  }

  /**
   * 📥 提取導入
   */
  _extractImports(content) {
    const imports = [];
    
    // JavaScript/TypeScript 導入
    const jsImportRegex = /import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = jsImportRegex.exec(content)) !== null) {
      imports.push({
        module: match[1],
        type: 'import'
      });
    }
    
    // Python 導入
    const pyImportRegex = /(?:from\s+(\w+(?:\.\w+)*)\s+import|import\s+(\w+(?:\.\w+)*))/g;
    while ((match = pyImportRegex.exec(content)) !== null) {
      imports.push({
        module: match[1] || match[2],
        type: 'import'
      });
    }
    
    return imports;
  }

  /**
   * 📤 提取導出
   */
  _extractExports(content) {
    const exports = [];
    
    // JavaScript/TypeScript 導出
    const jsExportRegex = /export\s+(?:default\s+)?(?:function\s+|class\s+|const\s+|let\s+|var\s+)?(\w+)/g;
    let match;
    while ((match = jsExportRegex.exec(content)) !== null) {
      exports.push({
        name: match[1],
        type: 'export'
      });
    }
    
    return exports;
  }

  /**
   * 📍 取得位置資訊
   */
  _getLocation(content, index) {
    const lines = content.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }
}

/**
 * 🔧 解析器整合管理器
 */
export class ParserIntegrationManager {
  constructor() {
    this.adapters = new Map();
    this.initialized = false;
  }

  /**
   * 🚀 初始化整合
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    console.log('🔧 初始化解析器整合...');
    
    try {
      // 註冊後備解析器
      await this._registerFallbackParser();
      
      // 註冊現有解析器
      await this._registerExistingParsers();
      
      this.initialized = true;
      console.log('✅ 解析器整合初始化完成');
      
    } catch (error) {
      throw propagateError(error, {
        stage: 'initialization',
        component: 'parser_integration_manager',
        operation: 'initialize'
      });
    }
  }

  /**
   * 📝 註冊後備解析器
   */
  async _registerFallbackParser() {
    const fallbackAdapter = new RegexFallbackAdapter({
      priority: -1000 // 最低優先級
    });
    
    const parserId = registerParser({
      name: fallbackAdapter.name,
      version: fallbackAdapter.version,
      languages: ['*'],
      capabilities: fallbackAdapter.capabilities,
      priority: -1000,
      parser: fallbackAdapter
    });
    
    this.adapters.set('fallback', parserId);
    console.log('🛡️ 註冊後備解析器');
  }

  /**
   * 🔧 註冊現有解析器
   */
  async _registerExistingParsers() {
    // 嘗試載入 JavaScript/TypeScript 解析器
    try {
      const { analyzeJavaScriptProject } = await import('./analyzer.js');
      const jsAdapter = new JavaScriptParserAdapter(
        { parse: analyzeJavaScriptProject },
        { priority: 100 }
      );
      
      const jsId = registerParser({
        name: jsAdapter.name,
        version: jsAdapter.version,
        languages: jsAdapter.languages,
        capabilities: jsAdapter.capabilities,
        priority: 100,
        parser: jsAdapter
      });
      
      this.adapters.set('javascript', jsId);
      console.log('🟨 註冊 JavaScript/TypeScript 解析器');
      
    } catch (error) {
      console.warn('⚠️ JavaScript 解析器載入失敗:', error.message);
    }
    
    // 嘗試載入 Python 解析器
    try {
      const { analyzePythonProject } = await import('./python-analyzer.js');
      const pyAdapter = new PythonParserAdapter(
        { parse: analyzePythonProject },
        { priority: 90 }
      );
      
      const pyId = registerParser({
        name: pyAdapter.name,
        version: pyAdapter.version,
        languages: pyAdapter.languages,
        capabilities: pyAdapter.capabilities,
        priority: 90,
        parser: pyAdapter
      });
      
      this.adapters.set('python', pyId);
      console.log('🐍 註冊 Python 解析器');
      
    } catch (error) {
      console.warn('⚠️ Python 解析器載入失敗:', error.message);
    }
  }

  /**
   * 📋 取得已註冊的適配器
   */
  getRegisteredAdapters() {
    return Array.from(this.adapters.entries()).map(([name, id]) => ({
      name: name,
      parserId: id,
      parser: globalParserCoordinator.parsers.get(id)
    }));
  }

  /**
   * 🔧 手動註冊解析器
   */
  registerCustomParser(name, parserImpl, options = {}) {
    const adapter = new ParserAdapter({
      name: name,
      parser: parserImpl,
      ...options
    });
    
    const parserId = registerParser({
      name: adapter.name,
      version: adapter.version,
      languages: adapter.languages,
      capabilities: adapter.capabilities,
      priority: options.priority || 0,
      parser: adapter
    });
    
    this.adapters.set(name, parserId);
    console.log(`🔧 註冊自訂解析器: ${name}`);
    
    return parserId;
  }
}

/**
 * 🏭 全域解析器整合管理器實例
 */
export const globalParserIntegration = new ParserIntegrationManager();

/**
 * 🔗 便利函數：初始化解析器整合
 */
export async function initializeParserIntegration() {
  return globalParserIntegration.initialize();
}

/**
 * 🔗 便利函數：註冊自訂解析器
 */
export function registerCustomParser(name, parserImpl, options = {}) {
  return globalParserIntegration.registerCustomParser(name, parserImpl, options);
}

// 瀏覽器環境全域暴露
if (typeof window !== 'undefined') {
  window.ParserAdapter = ParserAdapter;
  window.JavaScriptParserAdapter = JavaScriptParserAdapter;
  window.PythonParserAdapter = PythonParserAdapter;
  window.RegexFallbackAdapter = RegexFallbackAdapter;
  window.ParserIntegrationManager = ParserIntegrationManager;
  window.globalParserIntegration = globalParserIntegration;
  window.initializeParserIntegration = initializeParserIntegration;
  window.registerCustomParser = registerCustomParser;
}