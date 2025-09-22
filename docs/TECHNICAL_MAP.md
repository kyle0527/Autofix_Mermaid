# Technical Map

此文件以檔案與模組為單位，描述專案主要元件、職責與相互依賴，便於快速定位與擴充。

核心模組
- `js/main.js` / `js/UI.js` / `js/app.js` – 前端入口。負責初始化 Mermaid、面板（Docs/Config）、狀態欄位與匯出按鈕。`js/app.js` 會從 `rules/state.js` 讀取 manifest 並快取規則版本與面板顯示狀態。
- `js/rules/state.js` / `js/rules/client.js` – 封裝 RulePack/PromptPack 的 manifest 讀取、快取與預處理（`applyPreprocessRules`）。提供給 UI 以及 worker payload 使用。
- `worker.rules-loader.stub.js` – 給 worker 與 Node 測試共用的載入邏輯：解析 manifest、fetch JSON、透過 AJV 驗證，並回傳正規化後的 rules/prompt packs。
- `js/worker.js` / `js/worker.mjs` – 維持經典 worker 與模組化 worker。經典版呼叫 legacy engine；模組版負責 AI provider 管線。兩者皆接受 UI 注入的 `rules` 設定。
- `js/engine/rules-validator.js` – 使用 AJV 編譯 `rulepack.schema.json` 與 `promptpack.schema.json`。提供 `validateRulepack` / `validatePromptpack` 供 loader、build script 與測試使用。

規則與提示包
- `rules/manifest.json` – 定義版本、來源檔與預設版本。UI 設定面板與 worker 都透過此 manifest 解析實際路徑。
- `rules/rulepack.json` / `rules/promptpack.json` – 預設快取（會由 `scripts/build-packs.mjs` 同步）。
- `rules/versions/<date>/` – 每次從 Excel 轉出的版本化結果，方便追蹤差異。

資料產生工具
- `scripts/build-packs.mjs` – 將 `__not_shipped__/data/diagram_knowledge_pack.xlsx` 轉為 RulePack/PromptPack，驗證後寫入 `rules/versions/` 並更新 manifest。支援 `--check` 模式，僅比對現有輸出是否與 Excel 一致。

測試與自動化
- `scripts/run-tests.js` – `npm test` 入口。檢查核心檔案是否存在，接著呼叫兩個測試模組並執行 `build-packs.mjs --check` 確認 Excel 與版本化 JSON 未失同步。
- `tests/schema-validation.mjs` – 以 AJV 驗證三個壞樣本，確保載入時會擋下不合法結構。
- `tests/rules-pipeline.mjs` – 驗證 manifest 選擇邏輯並套用預處理規則，確保範例圖表會被正確修正。

文件與整理
- `README.md` / `README_STAGE3.md` – 使用說明與近期成果。已更新 Quick Start、RulePack 選擇與測試流程。
- `docs/legacy/**` – 歷史文件、原型與 changelog 已集中於此，避免干擾主流程。

擴充建議
- 若要再增加測試，優先針對 worker 輸出進行快照或比較，以掌握 RulePack 更新的行為差異。
- 將 `scripts/build-packs.mjs` 串入 CI，確保上傳新的 Excel 版本時會自動產生 JSON 並驗證。
- 規劃將 classic worker 功能逐步搬到 module worker，長期目標為單一 ESM 管線。
