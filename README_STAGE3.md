## 使用手冊（新手友善版）

### 1. 開始使用

1. 在專案根目錄執行 `npm install && npm start`，或啟動 `python -m http.server` 後造訪 `http://localhost:8080`。
2. 主畫面上方有一排工具按鈕，包含「直接渲染」、「自動修正＋渲染」、「自我檢測」等。
3. 下方有「原始碼輸入區」，可貼上 Mermaid、Python 或專案程式碼。

### 2. 基本操作

- **直接渲染**：貼上 Mermaid 代碼，按「直接渲染」即可在右側預覽 SVG 圖。
- **自動修正＋渲染**：貼上 Python 或 Mermaid 程式碼，按此按鈕，系統會自動分析、修正並產生最佳化圖表。
- **即時渲染**：勾選「即時渲染」後，輸入內容會自動更新預覽。
- **匯出功能**：可將圖表、程式碼、錯誤日誌等匯出為 MMD、SVG、PNG、JSON 檔案。

### 3. 進階功能

- **規則版本切換**：配置面板可從 manifest 選擇 RulePack/PromptPack，並顯示來源與生成時間。
- **說明文件面板**：Docs 面板會記住最後閱讀的 Markdown，重新整理後仍保留選取。
- **專案檔案匯入**：可選擇整個資料夾，批次分析多個 Python 檔案。
- **圖表與安全性設定**：可切換 flowchart/class/sequence、調整 security level（strict/loose）。
- **自我檢測**：按「自我檢測」可測試 worker、Mermaid 與模型資源是否正常。

### 4. 除錯與規則設定

- **除錯面板**：按「除錯」可開啟 log 面板，檢視分析過程、錯誤訊息與 AI/engine 回傳細節。
- **規則／配置面板**：按「規則」可開啟規則設定區（仍支援 JSON 編輯）；按「配置」可選擇 RulePack/PromptPack 版本並檢視來源、生成時間。

### 5. 常見問題

- **Q: 為何無法預覽？**
	- 請確認程式碼格式正確，或切換圖表類型再試一次。
- **Q: 如何自訂修正規則？**
	- 進入「規則」面板，編輯 JSON 規則並儲存。
- **Q: 匯出檔案失敗？**
	- 請確認瀏覽器權限，或重新整理頁面。

### 6. 進階技巧

- 可在程式碼中加註解（如 # fix: 強制使用 const），AI/engine 會自動解析並優化。
- 支援 AI/engine 切換，適合進階用戶測試不同分析路徑。

# Stage 3 Delivered
- Source Mode (Auto/Mermaid/Python)、Auto Render、Diagnostics。
- 規則/AI worker 整合：UI 可切換 engine/provider，並將 RulePack 選擇帶入 worker payload。
- 配置面板支援 manifest 驗證與版本資訊展示；Docs 面板支援懶載入與選項快取。
- AJV 驗證與 `npm test` 自動檢查：阻擋壞的 Rule/Prompt pack，並驗證預處理規則範例。

## 2025-09-12 功能更新紀錄

- 新增「除錯」與「規則」模組入口：
	- index.html 增加 `btnDebug`、`btnRules` 按鈕。
	- 新增 `debugPanel`（顯示分析/修正 log）與 `rulesPanel`（可編輯/儲存優化規則 JSON）。
	- UI.js 可控制面板開啟/關閉，並將 log 或規則內容動態顯示於對應區塊。

- UI 功能全面集中於 UI.js，舊版 UI-clean.js 已封存於 docs/legacy/ui-prototype/UI-clean.js。

- engine-esm.js（ESM 版）已建立，可直接 import/export 主要函式。

- ESLint 設定與自動修正已執行，僅剩警告。

- 新增 .github/workflows/curriculum.yml，啟用 Node.js/ESLint CI。
