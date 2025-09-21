# CONTRIBUTING

感謝你對本專案的興趣！本文件說明開發環境、提交流程、規則擴充與測試策略。

## 開發環境準備
1. Node.js 18+ (建議同時測 20 以符合 CI matrix)
2. 安裝依賴：於 `autofix_mermaidV3.7/` 內執行 `npm install`
3. 推薦安裝 VSCode 外掛：ESLint / EditorConfig / Markdownlint

## NPM Scripts
| 指令 | 說明 |
|------|------|
| `npm run lint` | 執行 ESLint 檢查 (忽略 vendor/assets) |
| `npm run test:unit` | 執行所有單元測試 (node:test) |
| `npm run test:ci` | CI 用：lint + unit |
| `npm run dev` | 啟動開發伺服器 (之後可掛前端或 Worker 測試) |

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
### 單元測試
放在 `test/unit/*.mjs`，使用 Node 原生 `node:test`。

### 快照測試 (規劃)
- 目標：對 Mermaid 文字輸出建立 `.snap` 對照
- 建議目錄：`test/snapshots/`

### 整合測試 (規劃)
- 上傳程式碼 → 解析 → 生成 Mermaid → 渲染 → 匯出 (Playwright)

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
3. 執行：`npm run test:ci`
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
