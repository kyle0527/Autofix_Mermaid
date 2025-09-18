# Technical Map

此文件以檔案與模組為單位，描述專案主要元件、職責與相互依賴，便於快速定位與擴充。

核心模組
- `js/autofix.js` - Autofix 引擎入口，整合偵測器、規則與輸出生成。被 `js/main.js`、`js/app.js` 與測試引用。
- `js/engine/common.js` - 共用工具（如 `guessDiagramType`、applyRegexAll）。
- `js/engine/ir.js` - 中介表示 (IR) 雛形：entities / relations 與簡單轉換器。
- `js/engine/rules-validator.js` - (新增) 用來在 loader 與 CI 中驗證 rulepack / promptpack 結構與基礎欄位。

規則與提示包
- `worker.rules-loader.stub.js` - Worker loader：fetch JSON、去重、preprocess 應用。現在會呼叫 `rules-validator`，在載入時做基本檢查並清理或警告不合法條目。
- `rules/` - 預期放置產生的 `rulepack.json` / `promptpack.json`（目前 repo 中沒有此目錄，loader 仍會嘗試讀取）。
- `rulepack.schema.json` / `promptpack.schema.json` - JSON Schema（作為參考）；驗證器目前實作最小必要欄位檢查，未直接用 AJV。

資料產生工具
- `xlsx_to_json.py` - 把 `diagram_knowledge_pack.xlsx` 中的 `RuleCatalog` 與 `AI_Prompts` 轉為 JSON。
- `json_to_xlsx.py` - 反向操作，用於 round-trip 編輯。

測試與 CI
- `test/unit/*.mjs` - Node 原生 `node:test` 單元測試（applyFixes、guessDiagramType、IR 等）。
- `.github/workflows/ci.yml` - CI pipeline（Node 18/20），新增步驟會執行 `node scripts/validate_packs.mjs` 來驗證 rules/prompt packs。
- `scripts/validate_packs.mjs` - (新增) 在 CI 或本地檢查 `rules/rulepack.json` 與 `rules/promptpack.json` 的基本正確性。

擴充點與建議
- 若需更嚴格驗證：將 `rules-validator` 改使用 `ajv` 與 schema 檔比對，並在 loader 中顯示詳細錯誤。
- 若 pack 很大或需要頻繁更新：將 `rules/` 內容作為 release artifact 或放 S3，CI pipeline 只負責 fetch + 驗證。
