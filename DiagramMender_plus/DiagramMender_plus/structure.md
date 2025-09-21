> 完整架構與決策請參考 [DiagramMender‑X Blueprint v1.2](docs/DiagramMender-X_Blueprint_v1.2_2025-09-13.md)，相關 Mermaid 原始檔見 [docs/architecture/](docs/architecture/)。

DiagramMender/
├─ packages/
│  ├─ ui-web/                  # 可跑的 ESM 網頁 Demo（暫無打包器）
│  │  ├─ index.html            # 已把標題/品牌換成 DiagramMender
│  │  ├─ styles.css
│  │  ├─ main.js
│  │  └─ src/
│  │     ├─ app.js             # import 路徑已改為新的插件位置
│  │     └─ plugins/
│  │        ├─ diagrammender-mermaid/
│  │        │  ├─ AutoFix.js   # 原 autofix_mermaidV3.2/AutoFix.js（改名、移位）
│  │        │  └─ Renderer.js  # 原 Renderer.js（改名、移位）
│  │        ├─ diagrammender-python/
│  │        │  └─ ProjectAnalyzer.js  # 原 ProjectAnalyzer.js（改名、移位）
│  │        └─ ui/
│  │           └─ UI.js        # 原 UI.js（改名、移位，並修正對 Analyzer 的 import）
│  │
│  ├─ core/                    # （占位）IR / pipeline 將在此落地
│  ├─ parsers/
│  │  └─ python/               # （占位）Python 解析插件
│  ├─ fix-rules/
│  │  └─ mermaid-compat/       # （占位）Mermaid 相容性修復規則
│  ├─ renderer/
│  │  └─ web/                  # （占位）Web 渲染封裝
│  └─ cli/                     # （占位）最小 CLI
│
├─ scripts/                    # 寫入 logs/ 與 data/ 的示範腳本（見 scripts/README.md）
│  ├─ dataStore.js
│  └─ logger.js
├─ logs/                       # `npm run log` 產生的日誌（見 logs/README.md）
├─ data/                       # `npm run store` 產生的 JSON 紀錄（見 data/README.md）
├─ docs/
│  ├─ ROADMAP.md               # 三階段規劃（概要）
│  └─ mermaid-guidelines.md    # Mermaid 十條語法規範
├─ README.md                   # 本文件
├─ package.json                # Workspaces（npm/pnpm 皆可）
└─ .gitignore

# DiagramMender — 結構與模組說明（含架構圖）

> 目標：從原始碼 **解析 → 修復 → 產生** Mermaid 圖。現況以 **Python** 為起點，採 **Monorepo（Plan B）** 分層，利於後續擴充語言與入口（UI/CLI）。

---

## 一、生成管線總覽（高階流程）

```mermaid
flowchart LR
  A[Source Code<br/>專案原始碼] --> B[Parsers<br/>各語言解析插件]
  B --> C[IR<br/>中介表示（core）]
  C --> D[Fix Engine<br/>規則引擎／相容修復（fix-rules）]
  D --> E[Emitter<br/>IR→Mermaid（core）]
  E --> F[Renderer<br/>Web/Node（renderer）]
  F --> G[[UI（ui-web）]]
  E --> H[[CLI（cli）]]

graph TD
  CORE[packages/core<br/>IR & Pipeline & Emitter]
  PYPARSER[packages/parsers/python<br/>Python 解析插件]
  FIXRULES[packages/fix-rules/mermaid-compat<br/>Mermaid 相容規則集]
  RENDERWEB[packages/renderer/web<br/>Web 渲染封裝]
  UIWEB[packages/ui-web<br/>ESM Demo UI]
  CLICMD[packages/cli<br/>命令列工具]

  PYPARSER --> CORE
  FIXRULES --> CORE
  CORE --> RENDERWEB
  CORE --> CLICMD
  RENDERWEB --> UIWEB

flowchart LR
  UIJS[UI.js<br/>事件/檔案上傳] --> APP[app.js<br/>協調流程]
  APP --> ANALYZER[ProjectAnalyzer.js<br/>Python 專案分析]
  ANALYZER --> AUTOFIX[AutoFix.js<br/>Mermaid 語法/相容修復]
  AUTOFIX --> RENDER[Renderer.js<br/>呼叫 Mermaid 渲染]
  RENDER --> DOM[頁面圖區]
四、目錄與各項目功能（每項 1–2 句）

對應你目前的目錄樹；占位的部分為 M1/M2 將落地之處。

根目錄

README.md：專案首頁（定位、路線圖、操作說明）；日後對外也沿用此檔作說明入口。

package.json：workspaces 管理檔；宣告各套件、腳本與 License（MIT）。

.gitignore：忽略 node_modules、臨時產物與快照檔，保持版本庫乾淨。

docs/ROADMAP.md：M0→M1→M2 的里程碑與工作清單，作為每輪迭代依據。
docs/mermaid-guidelines.md：整理十條 Mermaid 語法規範供參考。

logs/：`npm run log` 會在此生成 `diagrammender-YYYY-MM-DD.log`，供除錯與追蹤（詳見 logs/README.md）。
data/：`npm run store` 會追加 JSON 紀錄於 `records-YYYY-MM-DD.json`（詳見 data/README.md）。
scripts/logger.js：示範寫入日誌的 Node 腳本。
scripts/dataStore.js：示範寫入結構化紀錄的 Node 腳本。

packages/ui-web（可執行的 ESM 網頁 Demo）

index.html：Demo 首頁與資源掛載點；開頁即可測試整體流程。

styles.css：頁面樣式與排版；維持簡潔可讀的預設視覺。

main.js：頁面入口腳本；初始化並導向 src/app.js。

src/app.js：UI 與插件的協調器；觸發「分析 → 修復 → 渲染」的最小流程。

src/plugins/ui/UI.js：負責檔案/資料夾上傳、按鈕事件、錯誤提示與結果區塊切換。

src/plugins/diagrammender-python/ProjectAnalyzer.js：對 Python 專案做靜態分析（匯入關係/主流程）；暫時提供 Mermaid 所需資訊。

src/plugins/diagrammender-mermaid/AutoFix.js：Mermaid 語法與相容性修復；補缺、統一寫法，提升渲染成功率。

src/plugins/diagrammender-mermaid/Renderer.js：封裝 Mermaid 在瀏覽器端的渲染流程與掛載點管理。

packages/core（占位：M1 會落地）

IR／Pipeline 協調器：定義統一 IR 與 parse→fix→emit 管線；對外提供 core.parse()/core.emit() 等 API。

Emitter 介面：將 IR 轉成 Mermaid（後續可擴 PlantUML/Graphviz 等），統一錯誤與診斷輸出。

packages/parsers/python（占位：M1 會遷入）

Python Parser Plugin：把現有 ProjectAnalyzer 模組化為 parser 插件；僅做靜態分析，不執行使用者程式。

packages/fix-rules/mermaid-compat（占位：M1/M2 會建立）

Mermaid 規則集與註冊表：把 AutoFix 拆成多規則檔；提供啟用/排序/版本相容策略，讓 core 批次套用。

packages/renderer/web（占位：M1 會建立）

Web 渲染封裝：統一在瀏覽器端呼叫 Mermaid／其他渲染器；提供可測試的抽象 API。

packages/cli（占位：M2 會建立）

命令列工具：diagrammender <path> --format mermaid --out out.mmd；供 headless 產圖與 CI/CD 整合。

五、（可選）立即可做的小調整

先抽 IR 與 Emitter（core）：ui-web 只拿 IR 與 Mermaid 文本，不再在 UI 層組字串。

AutoFix 規則化（fix-rules）：由註冊表統一套用，可針對 Mermaid 版本差異擴充。

將 ProjectAnalyzer 遷入 parsers/python：以 core API 對接，減少 UI 與分析器的耦合。

renderer/web 抽象化：日後可替換渲染引擎或加入 PNG/SVG 匯出而不動 UI。

六、驗收通則（精簡版）

IR 穩定：Parser/FixRule 只對 IR/Emitter 互動，禁止跨層硬拼字串。

規則可管：修復規則獨立檔、可排序/開關，並具快照測試。

雙入口可用：UI 與 CLI 均能完成「輸入 → 輸出」；至少一套 E2E 可重現。

| 套件/部分                                      | 建議語言                                             | 理由（1–2 句）                                                              |
| ------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `packages/core`（IR／pipeline／Emitter）       | **TypeScript (ESM)**                             | 需同時被 UI（瀏覽器）與 CLI（Node）呼叫；TS 提供型別與良好外掛介面定義，維護成本最低。                     |
| `packages/parsers/python`（Python 解析）       | **TypeScript + web-tree-sitter（Python grammar）** | 用 tree-sitter 的 WebAssembly 版本可在瀏覽器/Node 兩邊通吃；避免把 Python runtime 帶進前端。 |
| `packages/fix-rules/mermaid-compat`（修復規則集） | **TypeScript**                                   | 與 core 同語言方便做規則註冊表、型別守衛與單元/快照測試。                                       |
| `packages/renderer/web`（Web 渲染封裝）          | **TypeScript**                                   | 封裝 Mermaid 與未來其他渲染器；TS 介面可抽象輸出（mmd/SVG/PNG），利於替換。                      |
| `packages/ui-web`（ESM Demo）                | **先 JS + JSDoc 型別，逐步升級至 TS**                     | 你已能用原生 ESM 跑起來；先用 JSDoc 補型別不需要打包器，等 M1 再切 TS/Vite。                     |
| `packages/cli`（命令列工具）                      | **TypeScript (Node ESM)**                        | CLI 要吃 core 的型別介面、做檔案 I/O 與 headless 匯出；TS 最穩。                         |
| 設定/Schema                                  | **JSON / JSON Schema**                           | 統一定義 `diagrammender.config.json`；用 schema 做驗證與 IDE 自動補全。               |
| 文件/測試                                      | **Markdown（docs）、Vitest/Playwright（測試）**         | Markdown 易維護；Vitest 做單元/快照，Playwright 做 UI/E2E。                        |

