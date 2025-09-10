# AutoFix Mermaid V3.4 變更紀錄

**變更日期：** 2025年9月11日
**專案版本：** V3.4
**變更類型：** 功能增強與優化

---

## 🆕 2025年9月11日更新

### 🔧 Tree-sitter 支援完成
- ✅ **新增 web-tree-sitter.js** (72,564 bytes)
- ✅ **新增 tree-sitter.wasm** (186,526 bytes) 
- ✅ **新增 tree-sitter-python.wasm** (457,796 bytes)
- ✅ **完整的 Python 程式碼解析支援**
- ✅ **自動 fallback 機制**：無 tree-sitter 時自動降級

### 🎨 UI/UX 改進
- ✅ **修復重複的 PNG 尺寸輸入框**
- ✅ **統一尺寸控制**：移動到 PNG 背景區域
- ✅ **移除預設值 "0"**：改為 placeholder 反灰顯示
- ✅ **新增「輸出圖片」按鈕**：支援 SVG/PNG 格式選擇
- ✅ **智能按鈕啟用**：成功渲染後自動啟用輸出功能

### � 輸出功能增強
- ✅ **智能尺寸偵測**：未輸入時自動使用 SVG 實際大小
- ✅ **預設備用尺寸**：寬度 1024px，高度 768px
- ✅ **多格式輸出**：PNG、SVG、MMD、JSON 支援
- ✅ **背景色設定**：支援透明背景與自訂顏色

### 🚀 啟動方式優化
- ✅ **本地 HTTP 伺服器**：`python -m http.server 8080`
- ✅ **瀏覽器訪問**：http://localhost:8080
- ✅ **ES6 模組支援**：完整的現代 JavaScript

---

## 📋 V3.4 核心功能

### 🎯 主要特色
- **進階 Python 程式碼分析**：使用 Tree-sitter 精確解析
- **三種圖表類型**：flowchart、classDiagram、sequenceDiagram  
- **智能來源偵測**：自動/Mermaid/Python 模式
- **即時渲染**：支援實時預覽功能
- **多格式輸出**：SVG、PNG 高品質匯出

### � 技術架構
- **前端框架**：純 JavaScript ES6+ 模組
- **解析引擎**：Web Tree-sitter + Fallback 
- **圖表渲染**：Mermaid.js 官方庫
- **背景處理**：Web Worker 非同步處理
- **型別檢查**：完整 JSDoc 註解

### 📁 檔案結構
```
autofix_mermaidV3.4/
├── index.html              # 主介面
├── js/
│   ├── main.js            # 應用程式進入點
│   ├── UI.js              # 使用者介面邏輯
│   ├── Renderer.js        # Mermaid 渲染器
│   ├── worker.js          # 背景處理器
│   ├── engine.js          # 簡化解析引擎
│   ├── vendor/
│   │   ├── mermaid.min.js     # Mermaid 圖表庫
│   │   └── web-tree-sitter.js # Tree-sitter 運行時
│   └── wasm/
│       ├── tree-sitter.wasm        # 核心 WASM
│       └── tree-sitter-python.wasm # Python 解析器
├── css/
│   └── styles.css         # 介面樣式
└── engine-src/            # TypeScript 原始碼
```

---

## 🚀 啟動指南

### 📋 系統需求
- **瀏覽器**：支援 ES6 模組的現代瀏覽器
- **Python**：3.x 版本（用於本地伺服器）
- **作業系統**：Windows/macOS/Linux

### 🔧 啟動步驟

#### 方法 1：本地 HTTP 伺服器（推薦）
```powershell
# 1. 切換到專案目錄
cd "C:\D\Autofix_Mermaid\autofix_mermaidV3.4"

# 2. 啟動 Python HTTP 伺服器
python -m http.server 8080

# 3. 開啟瀏覽器訪問
# http://localhost:8080
```

#### 方法 2：直接開啟檔案
```powershell
# 直接用瀏覽器開啟 index.html
Start-Process "C:\D\Autofix_Mermaid\autofix_mermaidV3.4\index.html"
```
**注意**：ES6 模組可能需要 HTTP 伺服器才能正常運作

### 💡 使用方式

1. **選擇來源模式**：
   - 🔄 **自動**：智能偵測輸入類型
   - 📊 **Mermaid**：直接輸入 Mermaid 語法  
   - 🐍 **Python**：輸入 Python 程式碼

2. **輸入內容**：
   - 在「輸入」區域貼上程式碼
   - 或使用「專案檔案」上傳整個資料夾

3. **生成圖表**：
   - **直接渲染**：適合已有的 Mermaid 語法
   - **自動修正＋渲染**：適合 Python 程式碼轉換

4. **匯出結果**：
   - 成功渲染後，輸出按鈕會自動啟用
   - **輸出圖片**：支援 SVG/PNG 格式選擇
   - 其他格式：MMD、JSON 等

### 🎯 預設輸出設定
- **PNG 背景**：透明（可自訂顏色）
- **預設尺寸**：自動偵測 SVG 大小
- **備用尺寸**：1024×768px
- **輸出品質**：高品質 PNG (95%)

---

## 🔧 技術規格

### 📦 核心元件
- **Mermaid.js**：圖表渲染引擎
- **Web Tree-sitter**：Python 程式碼解析
- **Web Workers**：背景處理機制
- **Canvas API**：PNG 圖片輸出

### 🌐 瀏覽器相容性
- Chrome 60+
- Firefox 60+ 
- Safari 12+
- Edge 79+

---

## 🚀 部署資訊

- **專案目錄**：C:\D\Autofix_Mermaid\autofix_mermaidV3.4\
- **Git 儲存庫**：獨立管理
- **版本控制**：main 分支
- **發布日期**：2025年9月11日
- **維護者**：kyle0527
- **GitHub**：https://github.com/kyle0527/Autofix_Mermaid

