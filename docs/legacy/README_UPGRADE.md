# Upgrade Complete (Worker + Minimal Engine Integrated)

- UI ⇄ Worker 通訊完成；不依賴 AutoFix，統一走 `js/worker.js`。
- 內建「簡化引擎」`js/engine.js`（瀏覽器原生 JS，無需打包工具）：
  - Python 專案 **fallback 剖析器**（regex-based），不需 tree-sitter/wasm。
  - 產出 `flowchart`/`classDiagram`/`sequenceDiagram` 三類 Mermaid。
  - 基本修飾（EnsureHeader）。
- 若你要切換到 `web-tree-sitter` 與完整 TS 來源：將編譯產物覆蓋到 `js/engine.js`，並把 `.wasm` 放到 `js/wasm/`。

## 目錄
- `js/worker.js`：UI 溝通與引擎自動偵測（有引擎→用引擎；無→Mock）。
- `js/engine.js`：已實作 `self.DiagramMenderCore.runPipeline(files, options)`。
- `engine-src/`：你提供的 DiagramMender TypeScript 原始碼（未編譯）。
- `js/wasm/`：WASM 放置目錄（目前不必需）。
- `_backup_removed/AutoFix.js`：舊修正器備份。

## 立即測試
1. 開啟 `index.html`。
2. 選資料夾（或貼上 Python 程式碼），選圖表類型 → **自動修正＋渲染**。  
3. 預期：看到由 **簡化引擎** 生成的 Mermaid 圖（非固定 Mock）。

## 若要切換為「完整引擎」
1. 在本機執行打包（需 Node/TS）把 monorepo 打成單檔 IIFE：輸出檔命名為 `js/engine.js`，並賦值：
   ```js
   self.DiagramMenderCore = { runPipeline: async (files, options) => ({ code, errors, log, dtype }) };
   ```
2. 若需 `web-tree-sitter`，請將 `tree-sitter.wasm` 與 `tree-sitter-python.wasm` 置於 `js/wasm/` 並在你的引擎內載入。

