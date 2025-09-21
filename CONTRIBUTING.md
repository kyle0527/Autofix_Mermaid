# CONTRIBUTING

感謝你對本專案的興趣！本文件說明開發環境、提交流程、規則擴充與測試策略。

## 開發環境準備
1. Node.js 18+（建議也在 Node 20 上驗證，以符合未來 CI 規畫）
2. 安裝依賴：於專案根目錄執行 `npm install`
3. 推薦安裝 VSCode 外掛：ESLint / EditorConfig / Markdownlint

## NPM Scripts
| 指令 | 說明 |
|------|------|
| `npm run lint` | 執行 ESLint 檢查（使用 flat config，已忽略 vendor/assets） |
| `npm test` | 執行 schema 驗證與規則預處理測試（`scripts/run-tests.js`） |
| `npm run build:packs` | 從 Excel 重新產生 RulePack/PromptPack 並更新 manifest |
| `npm run dev` | 啟動開發伺服器（供前端或 Worker 手動測試） |

## 程式碼風格
- 使用 ESLint 既有規則，提交前請確保無 error（warning 可接受但建議處理）
- 命名：
  - 檔案：小寫 + `-` 分隔 (`rule-runner.js`)
  - 類別：PascalCase
  - 常數：`UPPER_SNAKE_CASE`
- 避免大檔案 ( > 500 行 )，必要時拆分模組

## 分支策略 (建議)
- `main`：穩定分支
- `feature/*`：功能開發
- `fix/*`：缺陷修補
- `docs/*`：文檔調整
- Commit 使用 Conventional Commits：
  - `feat: add JS grammar loader`
  - `fix: handle empty code in guessDiagramType`
  - `docs: update roadmap`
  - `refactor: extract rule executor`
  - `test: add IR diff tests`

## 測試策略
### 既有測試
- Schema 驗證：`tests/schema-validation.mjs` 透過 AJV 編譯 `rulepack.schema.json` 與 `promptpack.schema.json`，並對三個壞樣本確認錯誤訊息。
- 規則預處理：`tests/rules-pipeline.mjs` 驗證 manifest 版本選擇與 `applyPreprocessRules` 對示例圖表的修改結果。

### 計畫中的擴充
- 單元測試：以 `node:test` 建立較小顆粒度的函式測試，建議放在 `tests/unit/`。
- 快照測試：對 Mermaid 輸出建立 `.snap` 對照（建議目錄 `tests/snapshots/`）。
- 整合測試：以 Playwright 驗證「上傳程式 → 解析 → 渲染 → 匯出」全流程。

## IR 擴充指引
`js/engine/ir.js` (將新增)：
```js
export function createIR() { return { entities: [], relations: [], meta: {} }; }
export function addEntity(ir, entity) { ir.entities.push(entity); }
```
新增欄位請：
1. 更新 IR Schema (未來 `schemas/ir.schema.json`)
2. 增測試：確保新欄位不破壞既有流程

## 規則 (Rules) 與自動修復
- 規則結構建議：
```js
{
  id: 'ensureDiagramDeclaration',
  applies(code){ return !/^\s*(flowchart|graph|classDiagram)/.test(code); },
  run(code){ return { code: 'flowchart\n' + code, note: 'ensureDiagramDeclaration' }; }
}
```
- 後續可改為 async 以支援 AI/LLM 輔助規則

## 安全考量
- 禁用 `eval` / `new Function`
- Mermaid 輸出前可做基本轉義與白名單檢查
- 未來上傳 ZIP 時要檢查副檔名與大小限制

## 提交流程
1. Fork / 建立分支
2. 實作 + 加測試 + 更新文件
3. 執行：`npm run lint` 與 `npm test`
4. 發 PR，描述：動機 / 變更 / 驗證方式 / 風險
5. Reviewer 檢查後合併

## 問題回報
- 使用 GitHub Issues，請提供：重現步驟、預期行為、實際結果、環境資訊

## 未來可能加入的協作工具
- Changesets (版本與發佈自動化)
- Commitlint + Husky (提交前檢查)
- size-limit (Bundle 體積監控)

---
歡迎參與，讓架構可視化更順手！
