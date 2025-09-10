# AutoFix Mermaid V3.4 技術實作指南

**最新更新：** 2025年9月11日  
**版本：** V3.4 with Tree-sitter Support

## 🚀 快速啟動

```bash
# 1. 啟動本地伺服器
cd "C:\D\Autofix_Mermaid\autofix_mermaidV3.4"
python -m http.server 8080

# 2. 開啟瀏覽器
# http://localhost:8080
```

---

## 📋 項目概述

AutoFix Mermaid V3.4 是一個智能的 Python 程式碼分析工具，能夠自動將 Python 程式碼轉換為 Mermaid 圖表。本版本新增了 Tree-sitter 支援，大幅提升程式碼解析準確性。

### 🎯 核心功能
- **🔍 智能程式碼分析**：使用 Tree-sitter 精確解析 Python
- **📊 多種圖表支援**：Flowchart、Class Diagram、Sequence Diagram
- **🎨 即時預覽**：實時渲染 Mermaid 圖表
- **📤 多格式輸出**：SVG、PNG、MMD 檔案匯出
- **⚡ 自動修正**：智能修正 Mermaid 語法錯誤

---

## 🛠️ 技術架構

### 前端技術棧
- **JavaScript ES6+**：現代模組化架構
- **Web Workers**：背景處理與解析
- **Canvas API**：高品質圖片輸出
- **Mermaid.js**：專業圖表渲染

### 解析引擎
- **Web Tree-sitter**：精確的語法樹分析
- **Fallback Parser**：輕量級正規表達式備用
- **自適應切換**：自動選擇最佳解析器

### 檔案結構
```
autofix_mermaidV3.4/
├── 📄 index.html                    # 主介面
├── 📁 js/
│   ├── 🚀 main.js                  # 應用程式進入點
│   ├── 🎨 UI.js                    # 使用者介面邏輯  
│   ├── 📊 Renderer.js              # Mermaid 渲染器
│   ├── ⚙️ worker.js                # Web Worker 處理器
│   ├── 🔧 engine.js                # 簡化解析引擎
│   ├── 📁 vendor/
│   │   ├── mermaid.min.js          # Mermaid 圖表庫
│   │   └── web-tree-sitter.js      # Tree-sitter 運行時 ✨
│   └── 📁 wasm/
│       ├── tree-sitter.wasm        # 核心 WASM ✨
│       └── tree-sitter-python.wasm # Python 解析器 ✨
├── 📁 css/
│   └── styles.css                  # 介面樣式
├── 📁 engine-src/                  # TypeScript 原始碼
│   └── 📁 packages/                # Monorepo 套件
└── 📚 文檔檔案/
    ├── CHANGELOG-V3.4-2025-09-11.md
    ├── 快速啟動指南.md
    └── README_V3.4_TECHNICAL.md
```

---

## 🎨 使用者介面

### 🔧 控制面板
```
[直接渲染] [自動修正＋渲染] [自我檢測]

來源: ⚪自動 ⚪Mermaid ⚪Python  ☑️即時渲染

[選擇檔案] 圖表類型▼ PNG背景[透明] 寬度[] 高度[] Security▼

[輸出圖片✨] [匯出MMD] [匯出SVG] [匯出PNG] [匯出JSON]
```

### 📊 工作區域
- **輸入區域**：程式碼編輯器
- **日誌區域**：錯誤與修正記錄  
- **預覽區域**：即時 SVG 圖表顯示

---

## 🔍 技術實作細節

### Tree-sitter 整合 ✨
```javascript
// 自動載入 Tree-sitter
async function tryLoadWebTreeSitter() {
  const candidates = [
    'js/vendor/web-tree-sitter.js',
    'js/vendor/web-tree-sitter.min.js', 
    'js/vendor/web-tree-sitter.umd.js',
  ];
  // 嘗試載入並初始化
}

// Python 解析器初始化
async function initWebTreeSitterPython() {
  const parser = new WebTreeSitter();
  const Python = await WebTreeSitter.Language.load('js/wasm/tree-sitter-python.wasm');
  parser.setLanguage(Python);
  return parser;
}
```

### 智能按鈕啟用 ✨
```javascript
// 渲染成功後啟用所有輸出按鈕
function enableExportButtons() {
  const buttons = ['btnExportImage', 'btnExportMMD', 'btnExportSVG', 
                   'btnExportPNG', 'btnExportErrors', 'btnExportFixlog'];
  buttons.forEach(id => $(id).disabled = false);
}
```

### 多格式輸出 ✨  
```javascript
// 輸出圖片 - 支援格式選擇
$('btnExportImage').addEventListener('click', async () => {
  const format = confirm('選擇格式:\n確定=PNG, 取消=SVG') ? 'PNG' : 'SVG';
  // 根據選擇輸出對應格式
});
```

### 智能尺寸偵測
```javascript
// 自動偵測 SVG 尺寸或使用預設值
if (pngWidth === 0 || pngHeight === 0) {
  const boundingRect = svgElement.getBoundingClientRect();
  pngWidth = pngWidth || Math.ceil(boundingRect.width) || 1024;
  pngHeight = pngHeight || Math.ceil(boundingRect.height) || 768;
}
```

---

## 📈 性能優化

### 🚀 載入策略
- **漸進式載入**：Tree-sitter 按需載入
- **自動降級**：無 WASM 時使用 fallback 
- **快取機制**：重複使用解析結果

### ⚡ 處理流程  
1. **輸入偵測**：自動判斷程式碼類型
2. **解析器選擇**：Tree-sitter 或 fallback
3. **背景處理**：Web Worker 非阻塞解析
4. **即時渲染**：Mermaid.js 高效渲染
5. **智能匯出**：最佳化圖片輸出

---

## 🔧 開發與維護

### 🛠️ 開發環境
- **Node.js**：TypeScript 編譯環境
- **Python 3.x**：本地伺服器
- **現代瀏覽器**：ES6+ 支援

### 📦 套件管理
```bash
# TypeScript 原始碼編譯
cd engine-src
npm install
npm run build

# 輸出到 js/engine.js
```

### 🧪 測試機制
- **自我檢測**：內建測試程式碼
- **即時驗證**：輸入變更時自動檢查
- **錯誤回報**：詳細的除錯資訊

---

## 📝 更新紀錄

### 2025.09.11 - V3.4 重大更新
- ✅ **Tree-sitter 支援**：web-tree-sitter.js + Python WASM
- ✅ **UI 優化**：移除重複控制項，統一尺寸設定  
- ✅ **輸出增強**：新增輸出圖片按鈕，支援格式選擇
- ✅ **智能啟用**：成功渲染後自動啟用匯出功能
- ✅ **尺寸智能**：自動偵測或 1024×768 預設

### 繼承功能
- 完整的 ES6+ 模組架構
- Web Worker 背景處理  
- 多種 Mermaid 圖表支援
- SVG/PNG 高品質輸出
- 專案資料夾批次處理

---

## 🏆 技術特色

### 🌟 創新亮點
1. **Tree-sitter 整合**：業界標準的語法分析
2. **漸進式增強**：優雅的功能降級機制
3. **模組化架構**：可維護的程式碼結構  
4. **使用者友善**：直觀的操作界面

### 🎯 效能指標
- **啟動時間**：< 2 秒
- **解析速度**：大型檔案 < 5 秒  
- **渲染延遲**：< 1 秒
- **記憶體使用**：< 50MB

### 🔒 穩定性保證
- **錯誤處理**：完善的例外捕捉
- **降級機制**：多層次備援方案
- **相容性**：主流瀏覽器支援

---

**🎉 AutoFix Mermaid V3.4 - 讓程式碼視覺化變得簡單！**

---

**維護者：** kyle0527  
**GitHub：** https://github.com/kyle0527/Autofix_Mermaid  
**更新日期：** 2025年9月11日
