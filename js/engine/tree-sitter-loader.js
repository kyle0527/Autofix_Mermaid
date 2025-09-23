/* eslint-disable no-unused-vars */

// js/engine/tree-sitter-loader.js - Tree-sitter 載入與管理模組
// 提供統一的 Tree-sitter WASM 載入、快取和語言支援

/**
 * Tree-sitter 載入器與管理器
 * 支援動態載入語言語法、WASM 快取、錯誤恢復
 */
class TreeSitterLoader {
  constructor() {
    this.initialized = false;
    this.TreeSitter = null;
    this.languages = new Map();
    this.parsers = new Map();
    this.loadPromises = new Map();
    
    this.config = {
      wasmPath: './js/wasm/',
      vendorPath: './js/vendor/',
      supportedLanguages: {
        javascript: 'tree-sitter-javascript.wasm',
        python: 'tree-sitter-python.wasm',
        java: 'tree-sitter-java.wasm',
        typescript: 'tree-sitter-typescript.wasm'
      }
    };
  }

  /**
   * 初始化 Tree-sitter 運行時
   */
  async initialize() {
    if (this.initialized) return this.TreeSitter;
    
    try {
      // 嘗試載入 web-tree-sitter
      if (typeof window !== 'undefined') {
        // 瀏覽器環境
        await this.loadWebTreeSitter();
      } else {
        // Node.js 環境
        await this.loadNodeTreeSitter();
      }
      
      this.initialized = true;
      console.log('✅ Tree-sitter initialized successfully');
      return this.TreeSitter;
      
    } catch (error) {
      console.warn('❌ Tree-sitter initialization failed:', error);
      throw new Error(`Tree-sitter initialization failed: ${error.message}`);
    }
  }

  /**
   * 載入瀏覽器版本的 Tree-sitter
   */
  async loadWebTreeSitter() {
    // 檢查是否已載入
    if (window.TreeSitter) {
      this.TreeSitter = window.TreeSitter;
      return;
    }

    // 動態載入 web-tree-sitter.js
    const script = document.createElement('script');
    script.src = `${this.config.vendorPath}web-tree-sitter.js`;
    
    await new Promise((resolve, reject) => {
      script.onload = () => {
        if (window.TreeSitter) {
          this.TreeSitter = window.TreeSitter;
          resolve();
        } else {
          reject(new Error('TreeSitter not found after loading script'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load web-tree-sitter.js'));
      document.head.appendChild(script);
    });

    // 初始化 WASM
    await this.TreeSitter.init({
      locateFile: (scriptName, scriptDirectory) => {
        if (scriptName.endsWith('.wasm')) {
          return `${this.config.wasmPath}${scriptName}`;
        }
        return `${scriptDirectory}${scriptName}`;
      }
    });
  }

  /**
   * 載入 Node.js 版本的 Tree-sitter
   */
  async loadNodeTreeSitter() {
    try {
      // 嘗試載入 tree-sitter
      const TreeSitter = require('tree-sitter');
      this.TreeSitter = TreeSitter;
    } catch (error) {
      throw new Error('tree-sitter package not found. Install with: npm install tree-sitter');
    }
  }

  /**
   * 載入特定語言的語法
   * @param {string} languageName - 語言名稱 (javascript, python, etc.)
   */
  async loadLanguage(languageName) {
    const normalizedName = languageName.toLowerCase();
    
    // 檢查是否已載入
    if (this.languages.has(normalizedName)) {
      return this.languages.get(normalizedName);
    }

    // 檢查是否正在載入
    if (this.loadPromises.has(normalizedName)) {
      return this.loadPromises.get(normalizedName);
    }

    // 開始載入
    const loadPromise = this._doLoadLanguage(normalizedName);
    this.loadPromises.set(normalizedName, loadPromise);
    
    try {
      const language = await loadPromise;
      this.languages.set(normalizedName, language);
      return language;
    } catch (error) {
      this.loadPromises.delete(normalizedName);
      throw error;
    }
  }

  /**
   * 實際載入語言語法
   */
  async _doLoadLanguage(languageName) {
    if (!this.TreeSitter) {
      await this.initialize();
    }

    const wasmFile = this.config.supportedLanguages[languageName];
    if (!wasmFile) {
      throw new Error(`Unsupported language: ${languageName}`);
    }

    try {
      if (typeof window !== 'undefined') {
        // 瀏覽器環境
        return await this.TreeSitter.Language.load(`${this.config.wasmPath}${wasmFile}`);
      } else {
        // Node.js 環境
        const languageMap = {
          javascript: 'tree-sitter-javascript',
          python: 'tree-sitter-python',
          java: 'tree-sitter-java',
          typescript: 'tree-sitter-typescript'
        };
        
        const packageName = languageMap[languageName];
        if (!packageName) {
          throw new Error(`No Node.js package for language: ${languageName}`);
        }
        
        const Language = require(packageName);
        return Language;
      }
    } catch (error) {
      throw new Error(`Failed to load ${languageName} language: ${error.message}`);
    }
  }

  /**
   * 獲取或建立解析器
   * @param {string} languageName - 語言名稱
   */
  async getParser(languageName) {
    const normalizedName = languageName.toLowerCase();
    
    // 檢查快取
    if (this.parsers.has(normalizedName)) {
      return this.parsers.get(normalizedName);
    }

    // 載入語言並建立解析器
    const language = await this.loadLanguage(normalizedName);
    const parser = new this.TreeSitter();
    parser.setLanguage(language);
    
    this.parsers.set(normalizedName, parser);
    return parser;
  }

  /**
   * 解析程式碼
   * @param {string} code - 程式碼內容
   * @param {string} languageName - 語言名稱
   */
  async parse(code, languageName) {
    try {
      const parser = await this.getParser(languageName);
      const tree = parser.parse(code);
      
      // 檢查解析錯誤
      if (tree.rootNode.hasError()) {
        const error = this.findFirstError(tree.rootNode);
        const line = error ? error.startPosition.row + 1 : 0;
        const column = error ? error.startPosition.column + 1 : 0;
        
        console.warn(`⚠️ Parse error in ${languageName} at ${line}:${column}`);
        // 不拋出錯誤，而是返回帶錯誤標記的樹
      }
      
      return tree;
    } catch (error) {
      throw new Error(`Failed to parse ${languageName} code: ${error.message}`);
    }
  }

  /**
   * 尋找第一個語法錯誤節點
   */
  findFirstError(node) {
    if (node.type === 'ERROR') return node;
    
    for (const child of node.children) {
      const error = this.findFirstError(child);
      if (error) return error;
    }
    
    return null;
  }

  /**
   * 檢查語言支援
   */
  isLanguageSupported(languageName) {
    return this.config.supportedLanguages.hasOwnProperty(languageName.toLowerCase());
  }

  /**
   * 獲取支援的語言列表
   */
  getSupportedLanguages() {
    return Object.keys(this.config.supportedLanguages);
  }

  /**
   * 清理資源
   */
  cleanup() {
    // 清理解析器
    for (const parser of this.parsers.values()) {
      try {
        parser.delete();
      } catch (error) {
        console.warn('Parser cleanup error:', error);
      }
    }
    
    this.parsers.clear();
    this.languages.clear();
    this.loadPromises.clear();
  }

  /**
   * 取得載入統計
   */
  getStats() {
    return {
      initialized: this.initialized,
      languagesLoaded: this.languages.size,
      parsersCreated: this.parsers.size,
      supportedLanguages: this.getSupportedLanguages()
    };
  }
}

// 建立全域實例
const treeSitterLoader = new TreeSitterLoader();

/**
 * 便利函數：直接解析程式碼
 */
export async function parseWithTreeSitter(code, languageName) {
  return treeSitterLoader.parse(code, languageName);
}

/**
 * 便利函數：檢查語言支援
 */
export function isTreeSitterSupported(languageName) {
  return treeSitterLoader.isLanguageSupported(languageName);
}

/**
 * 便利函數：取得載入器實例
 */
export function getTreeSitterLoader() {
  return treeSitterLoader;
}

// 匯出主要類別
export { TreeSitterLoader };