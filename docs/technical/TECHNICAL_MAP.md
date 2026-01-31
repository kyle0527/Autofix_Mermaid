# Technical Map

此文件以檔案與模組為單位，描述專案主要元件、職責與相互依賴，便於快速定位與擴充。

核心模組
- `js/main.js` / `js/UI.js` / `js/app.js` – 前端入口。負責初始化 Mermaid、面板（Docs/Config）、狀態欄位與匯出按鈕。`js/app.js` 會從 `rules/state.js` 讀取 manifest 並快取規則版本與面板顯示狀態。

程式碼分析引擎（新增）
- `js/engine/tree-sitter-loader.js` – Tree-sitter WASM 載入器與語言管理。提供 `TreeSitterLoader` 單例類別，支援 JavaScript 與 Python 語言解析器的統一載入與快取。
- `js/engine/analyzer.js` – JavaScript/TypeScript 程式碼分析器（已增強）。實作混合解析策略：優先使用 Tree-sitter，失敗時降級至正則表達式。支援雙重輸入模式（檔案物件或專案路徑）。
- `js/engine/python-analyzer.js` – 完整 Python 程式碼分析器。支援 Tree-sitter AST 遍歷與強健的正則表達式後備機制，可識別類別、函數、匯入與裝飾器。
- `js/engine/multi-analyzer.js` – 多語言專案協調器。自動偵測專案語言、整合各語言分析結果，並提供統一的 IR 輸出格式。
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

程式碼分析測試（新增）
- `test/unit/tree-sitter-integration.test.mjs` – Tree-sitter 整合測試套件。驗證 JavaScript、Python 與多語言專案分析功能，測試成功率 75%（3/4 通過）。
- `test/unit/fallback-integration.test.mjs` – 後備機制專項測試。專注於驗證當 Tree-sitter 失效時的正則表達式解析後備策略。

文件與整理
- `README.md` / `README_STAGE3.md` – 使用說明與近期成果。已更新 Quick Start、RulePack 選擇與測試流程。
- `docs/legacy/**` – 歷史文件、原型與 changelog 已集中於此，避免干擾主流程。

建置配置與相容性
- `engine-src/packages/parsers/*/tsconfig.json` – TypeScript 編譯配置（已現代化）。將 `moduleResolution` 從過時的 `"node"` 升級為現代的 `"bundler"`，確保與 TypeScript 5.x 完全相容。
- **依賴項目**: `tree-sitter ^0.21.1` – 支援 JavaScript 與 Python 的 WASM 解析器，Node.js v22.19.0 環境。

擴充建議
- 若要再增加測試，優先針對 worker 輸出進行快照或比較，以掌握 RulePack 更新的行為差異。
- 將 `scripts/build-packs.mjs` 串入 CI，確保上傳新的 Excel 版本時會自動產生 JSON 並驗證。
- 規劃將 classic worker 功能逐步搬到 module worker，長期目標為單一 ESM 管線。
- **新增語言支援**: 考慮整合 C++、Java、Go 等語言的 Tree-sitter 解析器。
- **效能優化**: 實作 WASM 快取與延遲載入機制，提升大型專案分析速度。
