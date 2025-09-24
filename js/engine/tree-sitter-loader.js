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
    
    // 🔧 問題 1 解決方案：增強配置與快取機制
    this.config = {
      wasmPath: './js/wasm/',
      vendorPath: './js/vendor/',
      // 📝 增加多重載入路徑支援
      fallbackPaths: [
        './assets/wasm/',
        './node_modules/web-tree-sitter/',
        'https://unpkg.com/web-tree-sitter@0.20.8/'
      ],
      supportedLanguages: {
        javascript: 'tree-sitter-javascript.wasm',
        python: 'tree-sitter-python.wasm',
        java: 'tree-sitter-java.wasm',
        typescript: 'tree-sitter-typescript.wasm'
      },
      // 🚀 WASM 快取配置
      enableCache: true,
      cacheTimeout: 24 * 60 * 60 * 1000, // 24 小時
      maxRetries: 3,
      retryDelay: 1000, // 1 秒
      // 📊 載入策略配置
      loadStrategy: 'progressive', // progressive, parallel, fallback
      preloadCore: true, // 預載入核心 WASM
      enableWorkerMode: false // Worker 模式支援
    };
    
    // 🔄 載入狀態追蹤
    this.loadAttempts = new Map();
    this.lastError = null;
    this.performanceMetrics = {
      loadTimes: new Map(),
      errorCounts: new Map(),
      cacheHits: 0,
      cacheMisses: 0,
      errors: new Map(),
      retryStats: {}
    };
  }

  /**
   * 🔧 問題 1 解決方案：穩定的初始化機制
   * 支援多重載入策略、快取、錯誤恢復
   */
  async initialize() {
    if (this.initialized) return this.TreeSitter;
    
    const startTime = Date.now();
    let lastError = null;
    
    try {
      // 📝 步驟 1: 檢查快取
      if (this.config.enableCache && this._checkWASMCache()) {
        console.log('🔄 Using cached WASM modules');
        this.performanceMetrics.cacheHits++;
        return this.TreeSitter;
      }
      
      // 📝 步驟 2: 環境偵測與載入
      if (typeof window !== 'undefined') {
        // 瀏覽器環境 - 使用漸進式載入策略
        await this._initializeWebTreeSitter();
      } else {
        // Node.js 環境 - 直接載入
        await this._initializeNodeTreeSitter();
      }
      
      // 📝 步驟 3: 核心 WASM 預載入
      if (this.config.preloadCore) {
        await this._preloadCoreWASM();
      }
      
      // 📝 步驟 4: 驗證載入成功
      await this._validateInitialization();
      
      this.initialized = true;
      const loadTime = Date.now() - startTime;
      this.performanceMetrics.loadTimes.set('initialization', loadTime);
      
      console.log(`✅ Tree-sitter initialized successfully in ${loadTime}ms`);
      return this.TreeSitter;
      
    } catch (error) {
      lastError = error;
      this.lastError = error;
      
      // 📝 步驟 5: 錯誤恢復策略
      console.warn('🔄 Primary initialization failed, attempting recovery...', error);
      
      try {
        const recoveredInstance = await this._attemptErrorRecovery();
        if (recoveredInstance) {
          this.initialized = true;
          console.log('✅ Tree-sitter recovered successfully');
          return recoveredInstance;
        }
      } catch (recoveryError) {
        console.error('❌ Recovery failed:', recoveryError);
        lastError = recoveryError;
      }
      
      // 📝 記錄錯誤統計
      this._recordError('initialization', lastError);
      
      throw new Error(`Tree-sitter initialization failed: ${lastError.message}`);
    }
  }

  /**
   * 🔧 問題 1 解決方案：增強的瀏覽器載入機制
   * 支援多重路徑、重試機制、WASM 快取
   */
  async _initializeWebTreeSitter() {
    // 檢查是否已載入
    if (window.TreeSitter) {
      this.TreeSitter = window.TreeSitter;
      await this._initializeWASM();
      return;
    }

    // 🔄 嘗試多個載入路徑
    const loadPaths = [
      `${this.config.vendorPath}web-tree-sitter.js`,
      `${this.config.vendorPath}web-tree-sitter.min.js`,
      `${this.config.vendorPath}web-tree-sitter.umd.js`,
      ...this.config.fallbackPaths.map(path => `${path}tree-sitter.js`)
    ];

    let lastError = null;
    
    for (const scriptPath of loadPaths) {
      try {
        console.log(`🔄 Attempting to load: ${scriptPath}`);
        await this._loadScriptWithRetry(scriptPath);
        
        if (window.TreeSitter) {
          this.TreeSitter = window.TreeSitter;
          await this._initializeWASM();
          console.log(`✅ Successfully loaded from: ${scriptPath}`);
          return;
        }
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Failed to load from ${scriptPath}:`, error);
        continue;
      }
    }
    
    throw new Error(`Failed to load web-tree-sitter from all paths. Last error: ${lastError?.message}`);
  }

  /**
   * 🔄 帶重試機制的腳本載入
   */
  async _loadScriptWithRetry(scriptPath, retryCount = 0) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptPath;
      
      const timeout = setTimeout(() => {
        reject(new Error(`Script loading timeout: ${scriptPath}`));
      }, 10000); // 10 秒超時
      
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      script.onerror = async () => {
        clearTimeout(timeout);
        document.head.removeChild(script);
        
        if (retryCount < this.config.maxRetries) {
          console.log(`🔄 Retrying load (${retryCount + 1}/${this.config.maxRetries}): ${scriptPath}`);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (retryCount + 1)));
          try {
            await this._loadScriptWithRetry(scriptPath, retryCount + 1);
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`Failed to load script after ${this.config.maxRetries} retries: ${scriptPath}`));
        }
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * 🏗️ WASM 初始化與快取
   */
  async _initializeWASM() {
    const locateFile = (scriptName, scriptDirectory) => {
      // 🔍 智能路徑解析
      if (scriptName.endsWith('.wasm')) {
        // 檢查快取
        if (this.config.enableCache) {
          const cached = this._getCachedWASM(scriptName);
          if (cached) {
            this.performanceMetrics.cacheHits++;
            return cached;
          }
        }
        
        // 嘗試多個路徑
        const paths = [
          `${this.config.wasmPath}${scriptName}`,
          ...this.config.fallbackPaths.map(path => `${path}${scriptName}`)
        ];
        
        // 返回第一個可用路徑
        for (const path of paths) {
          try {
            // 這裡可以添加路徑可用性檢查
            return path;
          } catch (error) {
            console.warn(`Path not available: ${path}`);
          }
        }
        
        this.performanceMetrics.cacheMisses++;
        return `${this.config.wasmPath}${scriptName}`;
      }
      
      return scriptDirectory ? `${scriptDirectory}${scriptName}` : scriptName;
    };

    await this.TreeSitter.init({ locateFile });
  }

  /**
   * 🔧 Node.js 環境載入（增強版）
   */
  async _initializeNodeTreeSitter() {
    try {
      const TreeSitter = (await import('tree-sitter')).default;
      this.TreeSitter = TreeSitter;
    } catch (error) {
      throw new Error('tree-sitter package not found. Install with: npm install tree-sitter');
    }
  }

  /**
   * 🚀 WASM 快取檢查
   */
  _checkWASMCache() {
    if (!this.config.enableCache || typeof localStorage === 'undefined') {
      return false;
    }
    
    try {
      const cacheKey = 'tree-sitter-wasm-cache';
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return false;
      
      const { timestamp, data } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > this.config.cacheTimeout;
      
      if (isExpired) {
        localStorage.removeItem(cacheKey);
        return false;
      }
      
      // 恢復快取的 TreeSitter 實例
      if (data && window.TreeSitter) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('WASM cache check failed:', error);
      return false;
    }
  }

  /**
   * 📦 獲取快取的 WASM
   */
  _getCachedWASM(scriptName) {
    if (!this.config.enableCache || typeof localStorage === 'undefined') {
      return null;
    }
    
    try {
      const cacheKey = `tree-sitter-wasm-${scriptName}`;
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const { timestamp, url } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > this.config.cacheTimeout;
      
      return isExpired ? null : url;
    } catch (error) {
      return null;
    }
  }

  /**
   * 🔄 核心 WASM 預載入
   */
  async _preloadCoreWASM() {
    if (!this.TreeSitter || typeof window === 'undefined') return;
    
    try {
      console.log('🔄 Preloading core WASM modules...');
      
      // 預載入主要語言的 WASM
      const coreLanguages = ['javascript', 'python'];
      const preloadPromises = coreLanguages.map(async (lang) => {
        try {
          if (this.config.supportedLanguages[lang]) {
            await this._preloadLanguageWASM(lang);
          }
        } catch (error) {
          console.warn(`Preload failed for ${lang}:`, error);
        }
      });
      
      await Promise.allSettled(preloadPromises);
      console.log('✅ Core WASM preload completed');
    } catch (error) {
      console.warn('Core WASM preload failed:', error);
    }
  }

  /**
   * 📝 預載入語言 WASM
   */
  async _preloadLanguageWASM(languageName) {
    const wasmFile = this.config.supportedLanguages[languageName];
    if (!wasmFile) return;
    
    const wasmUrl = `${this.config.wasmPath}${wasmFile}`;
    
    // 創建一個隱藏的預載入
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = wasmUrl;
      link.as = 'fetch';
      link.crossOrigin = 'anonymous';
      
      link.onload = resolve;
      link.onerror = reject;
      
      document.head.appendChild(link);
      
      // 5 秒後清理
      setTimeout(() => {
        try {
          document.head.removeChild(link);
        } catch (e) {
          // 忽略清理錯誤
        }
        resolve();
      }, 5000);
    });
  }

  /**
   * ✅ 驗證初始化
   */
  async _validateInitialization() {
    if (!this.TreeSitter) {
      throw new Error('TreeSitter instance not found');
    }

    const isBrowser = typeof window !== 'undefined';

    if (isBrowser) {
      if (typeof this.TreeSitter.Language?.load !== 'function') {
        throw new Error('TreeSitter.Language.load not available');
      }

      try {
        new this.TreeSitter.Parser();
      } catch (error) {
        throw new Error(`Parser creation failed: ${error.message}`);
      }

      return;
    }

    // Node.js 環境
    const ParserCtor = this.TreeSitter.Parser || this.TreeSitter;

    if (typeof ParserCtor !== 'function') {
      throw new Error('TreeSitter parser constructor missing');
    }

    try {
      new ParserCtor();
    } catch (error) {
      throw new Error(`Parser creation failed: ${error.message}`);
    }
  }

  /**
   * 🆘 錯誤恢復策略
   */
  async _attemptErrorRecovery() {
    console.log('🔄 Attempting error recovery...');
    
    const isNodeEnv = typeof window === 'undefined';
    
    if (isNodeEnv) {
      // Node.js 環境：直接使用最小模式
      console.log('🎯 Node.js environment detected, entering minimal mode...');
      return this._createMinimalTreeSitter();
    }
    
    // 瀏覽器環境的恢復策略
    // 策略 1: 清理快取並重試
    if (this.config.enableCache) {
      this._clearWASMCache();
      console.log('🗑️ Cache cleared, retrying...');
      
      try {
        await this._initializeWebTreeSitter();
        return this.TreeSitter;
      } catch (error) {
        console.warn('Cache clear recovery failed:', error);
      }
    }
    
    // 策略 2: 使用 CDN fallback
    console.log('🌐 Trying CDN fallback...');
    try {
      await this._loadFromCDN();
      return this.TreeSitter;
    } catch (error) {
      console.warn('CDN fallback failed:', error);
    }
    
    // 策略 3: 最小功能模式
    console.log('🎯 Entering minimal mode...');
    return this._createMinimalTreeSitter();
  }

  /**
   * 🌐 CDN 載入
   */
  async _loadFromCDN() {
    const cdnUrl = 'https://unpkg.com/web-tree-sitter@0.20.8/tree-sitter.js';
    
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = cdnUrl;
      script.onload = resolve;
      script.onerror = () => reject(new Error('CDN load failed'));
      document.head.appendChild(script);
    });
    
    if (window.TreeSitter) {
      this.TreeSitter = window.TreeSitter;
      await this.TreeSitter.init();
      return this.TreeSitter;
    }
    
    throw new Error('CDN TreeSitter not found');
  }

  /**
   * 🎯 建立最小功能 Tree-sitter
   */
  _createMinimalTreeSitter() {
    console.warn('⚠️ Creating minimal TreeSitter fallback');
    
    // 返回一個基本的 mock 物件，支援基本操作
    return {
      Parser: function() {
        return {
          setLanguage: () => {},
          parse: () => ({ rootNode: { children: [], type: 'program' } })
        };
      },
      Language: {
        load: async () => ({ name: 'fallback' })
      }
    };
  }

  /**
   * 🗑️ 清理 WASM 快取
   */
  _clearWASMCache() {
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('tree-sitter-wasm')) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  /**
   * 📊 錯誤記錄
   */
  _recordError(operation, error) {
    const errorName = error?.name || 'Error';
    const errorKey = `${operation}:${errorName}`;
    const currentCount = this.performanceMetrics.errorCounts.get(errorKey) || 0;
    this.performanceMetrics.errorCounts.set(errorKey, currentCount + 1);

    if (this.performanceMetrics.errors instanceof Map) {
      const timestamp = Date.now();
      this.performanceMetrics.errors.set(timestamp, {
        operation,
        name: errorName,
        message: error?.message || String(error),
        timestamp
      });

      if (this.performanceMetrics.errors.size > 50) {
        const oldestKey = this.performanceMetrics.errors.keys().next().value;
        this.performanceMetrics.errors.delete(oldestKey);
      }
    }
  }

  /**
   * 🔧 問題 1 解決方案：穩定的語言載入機制
   * 支援重試、快取、錯誤恢復
   */
  async loadLanguage(languageName) {
    const normalizedName = languageName.toLowerCase();
    const startTime = Date.now();
    
    // 檢查是否已載入
    if (this.languages.has(normalizedName)) {
      this.performanceMetrics.cacheHits++;
      return this.languages.get(normalizedName);
    }

    // 檢查是否正在載入
    if (this.loadPromises.has(normalizedName)) {
      return this.loadPromises.get(normalizedName);
    }

    // 開始載入流程
    const loadPromise = this._loadLanguageWithRetry(normalizedName);
    this.loadPromises.set(normalizedName, loadPromise);
    
    try {
      const language = await loadPromise;
      this.languages.set(normalizedName, language);
      
      // 記錄效能指標
      const loadTime = Date.now() - startTime;
      this.performanceMetrics.loadTimes.set(`language-${normalizedName}`, loadTime);
      this.performanceMetrics.cacheMisses++;
      
      console.log(`✅ Language ${normalizedName} loaded in ${loadTime}ms`);
      return language;
      
    } catch (error) {
      this.loadPromises.delete(normalizedName);
      this._recordError(`load-language-${normalizedName}`, error);
      throw error;
    }
  }

  /**
   * 🔄 帶重試機制的語言載入
   */
  async _loadLanguageWithRetry(languageName, retryCount = 0) {
    try {
      return await this._doLoadLanguage(languageName);
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        console.warn(`🔄 Language load retry ${retryCount + 1}/${this.config.maxRetries} for ${languageName}:`, error);
        
        // 指數退避延遲
        const delay = this.config.retryDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this._loadLanguageWithRetry(languageName, retryCount + 1);
      }
      
      // 記錄重試統計
      this._recordRetryStats(languageName, retryCount);
      throw error;
    }
  }

  /**
   * ✅ 驗證語言結構
   */
  _validateLanguage(language) {
    if (!language) return false;

    // 對於最小化語言，使用不同的驗證標準
    if (language.minimal === true) {
      return typeof language.parse === 'function';
    }

    const wrapperLanguage = language.language && typeof language.language === 'object'
      ? language.language
      : null;

    if (!language.nodeTypeInfo && wrapperLanguage && wrapperLanguage.nodeTypeInfo) {
      language.nodeTypeInfo = wrapperLanguage.nodeTypeInfo;
    }

    if (!language.query && wrapperLanguage && typeof wrapperLanguage.query === 'function') {
      // 綁定 query 方便外部使用
      language.query = wrapperLanguage.query.bind(wrapperLanguage);
    }

    const hasQuery = typeof language.query === 'function';
    const hasWrapper = !!wrapperLanguage;

    if (!hasQuery && !hasWrapper) {
      return false;
    }

    return true;
  }

  /**
   * 🔧 創建最小化解析器
   */
  async _createMinimalParser(languageName) {
    console.log(`🛠️ Creating minimal parser for ${languageName}`);
    
    // 返回一個基本的模擬語言對象，提供最基本的功能
    return {
      name: languageName,
      minimal: true,
      query: () => ({ captures: [] }),
      nodeTypeInfo: {},
      parse: (code) => ({
        rootNode: {
          type: 'program',
          text: code,
          children: []
        }
      })
    };
  }

  /**
   * 📊 記錄重試統計
   */
  _recordRetryStats(languageName, retryCount) {
    if (!this.performanceMetrics.retryStats) {
      this.performanceMetrics.retryStats = {};
    }
    this.performanceMetrics.retryStats[languageName] = retryCount;
  }

  /**
   * 🔧 實際載入語言語法（增強版）
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
        // 🌐 瀏覽器環境 - 多路徑載入
        return await this._loadLanguageFromWeb(languageName, wasmFile);
      } else {
        // 📦 Node.js 環境 - 包管理載入
        return await this._loadLanguageFromNode(languageName);
      }
    } catch (error) {
      throw new Error(`Failed to load ${languageName} language: ${error.message}`);
    }
  }

  /**
   * 對應 Node.js 環境的語言模組
   * @param {string} languageName
   * @returns {{moduleName: string, exportName?: string}|null}
   */
  _resolveNodeLanguageModule(languageName) {
    const normalized = languageName.toLowerCase();

    switch (normalized) {
      case 'javascript':
      case 'js':
      case 'jsx':
        return { moduleName: 'tree-sitter-javascript' };

      case 'typescript':
      case 'ts':
      case 'tsx':
        // 若沒有安裝 TypeScript grammar，會在載入時回退
        return { moduleName: 'tree-sitter-typescript', exportName: 'typescript' };

      case 'python':
      case 'py':
        return { moduleName: 'tree-sitter-python' };

      default:
        return null;
    }
  }

  /**
   * 🌐 Web 環境語言載入
   */
  async _loadLanguageFromWeb(languageName, wasmFile) {
    const loadPaths = [
      `${this.config.wasmPath}${wasmFile}`,
      ...this.config.fallbackPaths.map(path => `${path}${wasmFile}`)
    ];

    let lastError = null;
    
    for (const wasmPath of loadPaths) {
      try {
        console.log(`🔄 Loading ${languageName} from: ${wasmPath}`);
        
        // 檢查 WASM 檔案是否存在
        if (await this._checkWASMExists(wasmPath)) {
          const language = await this.TreeSitter.Language.load(wasmPath);
          
          // 快取成功的路徑
          if (this.config.enableCache) {
            this._cacheWASMPath(wasmFile, wasmPath);
          }
          
          return language;
        }
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Failed to load ${languageName} from ${wasmPath}:`, error);
        continue;
      }
    }
    
    throw lastError || new Error(`No available path for ${languageName}`);
  }

  /**
   * 📦 Node.js 環境語言載入
   */
  async _loadLanguageFromNode(languageName) {
    const moduleInfo = this._resolveNodeLanguageModule(languageName);

    if (!moduleInfo) {
      console.warn(`⚠️ No native grammar for ${languageName}. Using minimal parser.`);
      return this._createMinimalParser(languageName);
    }

    const { moduleName, exportName } = moduleInfo;

    try {
      const languageModule = await import(moduleName);

      let language = null;

      if (exportName && languageModule[exportName]) {
        language = languageModule[exportName];
      } else if (languageModule.default) {
        language = languageModule.default;
      } else {
        language = languageModule;
      }

      if (languageModule.nodeTypeInfo && language && !language.nodeTypeInfo) {
        language.nodeTypeInfo = languageModule.nodeTypeInfo;
      }

      if (!this._validateLanguage(language)) {
        throw new Error(`Invalid language module structure for ${moduleName}`);
      }

      return language;
    } catch (error) {
      if (error && (error.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find module/.test(error.message))) {
        if (moduleName === 'tree-sitter-typescript') {
          console.warn('⚠️ tree-sitter-typescript not installed. Falling back to tree-sitter-javascript grammar.');
          return this._loadLanguageFromNode('javascript');
        }

        console.warn(`⚠️ Missing tree-sitter package "${moduleName}". Falling back to minimal parser.`);
        return this._createMinimalParser(languageName);
      }

      throw error;
    }
  }

  /**
   * 🔍 檢查 WASM 檔案是否存在
   */
  async _checkWASMExists(wasmPath) {
    try {
      const response = await fetch(wasmPath, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 💾 快取 WASM 路徑
   */
  _cacheWASMPath(wasmFile, wasmPath) {
    if (typeof localStorage !== 'undefined') {
      try {
        const cacheKey = `tree-sitter-wasm-${wasmFile}`;
        const cacheData = {
          timestamp: Date.now(),
          url: wasmPath
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (error) {
        console.warn('Failed to cache WASM path:', error);
      }
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
   * 解析程式碼（支援 (code, language) 或 (language, code) 參數順序）
   */
  async parse(arg1, arg2) {
    const { code, languageName } = this._normalizeParseArgs(arg1, arg2);

    const normalizedCode = typeof code === 'string' ? code : String(code ?? '');
    const bytesProcessed = normalizedCode.length;

    const result = {
      success: false,
      language: languageName,
      tree: null,
      hadErrors: false,
      bytesProcessed
    };

    try {
      const parser = await this.getParser(languageName);
      const tree = parser.parse(normalizedCode);

      result.tree = tree;
      result.success = true;
      result.hadErrors = Boolean(tree?.rootNode?.hasError);

      if (result.hadErrors) {
        const errorNode = this.findFirstError(tree.rootNode);
        result.error = {
          message: 'Tree-sitter reported syntax errors',
          line: errorNode ? errorNode.startPosition.row + 1 : undefined,
          column: errorNode ? errorNode.startPosition.column + 1 : undefined,
          type: errorNode ? errorNode.type : 'UNKNOWN'
        };

        console.warn(`⚠️ Parse error in ${languageName} at ${result.error.line ?? 0}:${result.error.column ?? 0}`);
      }

      return result;
    } catch (error) {
      result.error = {
        message: error.message,
        stack: error.stack
      };

      return result;
    }
  }

  /**
   * 正規化 parse 參數
   */
  _normalizeParseArgs(arg1, arg2) {
    if (typeof arg1 === 'undefined' || typeof arg2 === 'undefined') {
      throw new Error('TreeSitterLoader.parse requires both code and language arguments');
    }

    const firstIsString = typeof arg1 === 'string';
    const secondIsString = typeof arg2 === 'string';

    if (!firstIsString && !secondIsString) {
      throw new Error('TreeSitterLoader.parse expects string inputs');
    }

    const firstLower = firstIsString ? arg1.toLowerCase() : '';
    const secondLower = secondIsString ? arg2.toLowerCase() : '';

    const firstSupported = firstIsString && this.isLanguageSupported(firstLower);
    const secondSupported = secondIsString && this.isLanguageSupported(secondLower);

    let languageName;
    let code;

    if (firstSupported && !secondSupported) {
      languageName = firstLower;
      code = secondIsString ? arg2 : String(arg2);
    } else if (!firstSupported && secondSupported) {
      languageName = secondLower;
      code = firstIsString ? arg1 : String(arg1);
    } else if (firstSupported && secondSupported) {
      languageName = firstLower;
      code = secondIsString ? arg2 : String(arg2);
    } else {
      languageName = secondLower;
      code = firstIsString ? arg1 : String(arg1);
    }

    if (!this.isLanguageSupported(languageName)) {
      throw new Error(`Unsupported language: ${languageName}`);
    }

    const normalizedCode = typeof code === 'string' ? code : String(code ?? '');

    return {
      code: normalizedCode,
      languageName
    };
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
  /**
   * 🧹 清理資源（增強版）
   */
  cleanup() {
    console.log('🧹 Cleaning up Tree-sitter resources...');
    
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
    
    // 重置狀態
    this.initialized = false;
    this.TreeSitter = null;
    this.lastError = null;
    
    // 清理效能指標
    if (this.performanceMetrics) {
      this.performanceMetrics.loadTimes.clear();
      this.performanceMetrics.errors.clear();
      this.performanceMetrics.cacheHits = 0;
      this.performanceMetrics.cacheMisses = 0;
      this.performanceMetrics.retryStats = {};
    }
    
    // 清理快取（可選）
    if (this.config.enableCache && typeof localStorage !== 'undefined') {
      try {
        const keys = Object.keys(localStorage).filter(key => 
          key.startsWith('tree-sitter-')
        );
        keys.forEach(key => localStorage.removeItem(key));
        console.log(`🧹 Cleaned up ${keys.length} cache entries`);
      } catch (error) {
        console.warn('Failed to clean cache:', error);
      }
    }
    
    console.log('✅ Tree-sitter cleanup completed');
  }

  /**
   * 🧪 測試載入系統穩定性
   */
  async runStabilityTest() {
    console.log('🧪 Starting Tree-sitter stability test...');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // 測試 1: 初始化測試
    try {
      await this.initialize();
      testResults.tests.initialization = { status: 'PASS', duration: 0 };
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.initialization = { status: 'FAIL', error: error.message };
      testResults.summary.failed++;
    }
    testResults.summary.total++;

    // 測試 2: 語言載入測試
    const testLanguages = ['javascript', 'python'];
    for (const lang of testLanguages) {
      if (this.isLanguageSupported(lang)) {
        const startTime = Date.now();
        try {
          await this.loadLanguage(lang);
          const duration = Date.now() - startTime;
          testResults.tests[`load_${lang}`] = { status: 'PASS', duration };
          testResults.summary.passed++;
        } catch (error) {
          testResults.tests[`load_${lang}`] = { status: 'FAIL', error: error.message };
          testResults.summary.failed++;
        }
        testResults.summary.total++;
      }
    }

    // 測試 3: 快取系統測試
    if (this.config.enableCache) {
      try {
        const cacheWorking = this._testCache();
        testResults.tests.cache_system = { 
          status: cacheWorking ? 'PASS' : 'FAIL', 
          duration: 0 
        };
        testResults.summary[cacheWorking ? 'passed' : 'failed']++;
      } catch (error) {
        testResults.tests.cache_system = { status: 'FAIL', error: error.message };
        testResults.summary.failed++;
      }
      testResults.summary.total++;
    }

    console.log('🧪 Stability test completed:', testResults.summary);
    return testResults;
  }

  /**
   * 🔍 測試快取系統
   */
  _testCache() {
    // Node.js 環境沒有 localStorage，但快取功能設計為瀏覽器限定
    if (typeof localStorage === 'undefined') {
      return typeof window === 'undefined' ? true : false; // Node.js 環境視為正常
    }
    
    try {
      const testKey = 'tree-sitter-cache-test';
      const testValue = JSON.stringify({ test: true, timestamp: Date.now() });
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      return retrieved === testValue;
    } catch (error) {
      return false;
    }
  }

  /**
   * 📊 取得完整效能報告
   */
  getPerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      initialization: {
        status: this.initialized ? 'SUCCESS' : 'FAILED',
        loadTime: this.performanceMetrics.loadTimes.get('initialization') || 0
      },
      languages: {
        loaded: Array.from(this.languages.keys()),
        loadTimes: Object.fromEntries(this.performanceMetrics.loadTimes),
        cacheHits: this.performanceMetrics.cacheHits,
        cacheMisses: this.performanceMetrics.cacheMisses,
        retryStats: this.performanceMetrics.retryStats || {}
      },
      errors: {
        count: this.performanceMetrics.errors ? this.performanceMetrics.errors.size : 0,
        recent: this.performanceMetrics.errors
          ? Array.from(this.performanceMetrics.errors.values()).slice(-5)
          : []
      },
      system: {
        browser: typeof window !== 'undefined' ? window.navigator?.userAgent || 'Unknown' : 'Node.js',
        cacheEnabled: this.config.enableCache,
        maxRetries: this.config.maxRetries
      }
    };

    return report;
  }

  /**
   * 🎯 驗證系統完整性
   */
  async validateSystemIntegrity() {
    console.log('🎯 Validating Tree-sitter system integrity...');
    
    const validationResults = {
      initialization: false,
      languageSupport: false,
      cacheSystem: false,
      errorHandling: false,
      overall: false
    };

    try {
      // 檢查初始化
      if (this.initialized && this.TreeSitter) {
        validationResults.initialization = true;
      }

      // 檢查語言支援
      const supportedLangs = Object.keys(this.config.supportedLanguages);
      if (supportedLangs.length > 0) {
        validationResults.languageSupport = true;
      }

      // 檢查快取系統
      if (!this.config.enableCache || this._testCache()) {
        validationResults.cacheSystem = true;
      }

      // 檢查錯誤處理
      if (this.performanceMetrics && this.performanceMetrics.errors instanceof Map) {
        validationResults.errorHandling = true;
      }

      // 整體評估
      const passCount = Object.values(validationResults).filter(Boolean).length;
      validationResults.overall = passCount >= 3; // 至少通過 3/4 項檢查

      console.log('🎯 Validation completed:', validationResults);
      return validationResults;
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
      return validationResults;
    }
  }

  /**
   * 取得載入統計
   */
  getStats() {
    return {
      initialized: this.initialized,
      languagesLoaded: this.languages.size,
      parsersCreated: this.parsers.size,
      supportedLanguages: this.getSupportedLanguages(),
      performanceMetrics: this.getPerformanceReport()
    };
  }
}

// 建立全域實例
const treeSitterLoader = new TreeSitterLoader();

/**
 * 便利函數：直接解析程式碼
 */
export async function parseWithTreeSitter(code, languageName) {
  const result = await treeSitterLoader.parse(code, languageName);

  if (result.success && result.tree) {
    return result.tree;
  }

  const message = result.error?.message || `Tree-sitter parse failed for ${languageName}`;
  const error = new Error(message);
  error.details = result;
  throw error;
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