# DiagramMender 

> **從程式碼自動產生並修復 Mermaid 圖表的工具**

DiagramMender 的目標是：  
從原始碼（目前以 Python 為主）中解析程式結構與流程，**自動生成 Mermaid 圖表**（如流程圖、架構圖），並透過內建的 **語法修復機制** 保證輸出的 Mermaid 語法正確可用。

專案採用 **Monorepo 架構**，劃分為多個模組，方便未來擴充多語言支援、規則系統、以及不同輸出方式（UI / CLI / API）。


## ✨ 專案特色

- **程式碼解析**：自動分析專案結構與函式流程。  
- **Mermaid 語法修復**：偵測並自動修復 Mermaid 常見錯誤，確保渲染穩定。  
- **模組化設計**：各功能獨立封裝，方便後續擴充與維護。  
- **UI Demo**：提供即時網頁介面，可上傳程式碼並直接看到圖表。  
- **CLI（規劃中）**：支援命令列操作，能整合 CI/CD 產出圖表。
## 📐 Mermaid 語法規範

若需撰寫或檢查 Mermaid 圖表，可參考 [docs/mermaid-guidelines.md](docs/mermaid-guidelines.md) 中整理的十條語法規範，協助維持一致且易於解析的描述方式。

## 📝 紀錄儲存

專案根目錄提供 `logs/` 目錄以儲存執行紀錄，每日生成 `diagrammender-YYYY-MM-DD.log` 檔案，並新增 `npm run log` 指令示範寫入。
另有 `data/` 目錄以保存結構化資料，`npm run store` 會在每日的 `records-YYYY-MM-DD.json` 檔案追加一筆記錄。
更多命名與使用原則請參考 `logs/README.md` 與 `data/README.md`。

## ⚙️ 設定檔

根目錄的 `diagrammender.config.json` 可調整忽略規則與輸出格式，完整欄位說明請見 [docs/configuration.md](docs/configuration.md)。

範例設定：

```json
{
  "ignore": ["**/test/**"],
  "rules": { "noGraphKeyword": true },
  "output": { "format": "json" }
}
```

CLI 使用範例：

```bash
node packages/cli/src/diagrammender.js path/to/python/project
```

CLI 會遞迴掃描指定目錄下的 `.py` 檔案（會套用 `diagrammender.config.json` 中的 `ignore` 規則），
透過 Python 解析器建立架構圖／流程圖後，再套用 `@diagrammender/fix-rules-mermaid-compat`
提供的 Mermaid 修復規則，確保輸出語法安全。依 `output.format` 決定輸出為純文字或 JSON；
JSON 會包含 `arch`、`flow`、`stats` 以及各自的修復訊息 `notes`。CLI 會優先從分析目標所在
目錄讀取設定，也可使用下列旗標覆寫行為：

- `--json` / `--text` 或 `--format <mode>`：強制指定輸出格式。
- `--config <dir>`：改從指定目錄載入 `diagrammender.config.json` 與 Schema。
- `--help`：顯示完整指令說明。

UI 使用範例：

```js
const config = await (await fetch('/diagrammender.config.json')).json();
// 將 config 傳入 UI 組件
```

若缺少設定值，CLI 會套用預設並透過 [Ajv](https://ajv.js.org/) 驗證。格式不符時將中止執行並顯示錯誤。


## 🔧 開發與測試

安裝依賴並執行單元測試：

```bash
pnpm install
npm test
```

---

## 🗂️ 專案架構

# Packages (initial)
- `packages/ui-web`: working demo UI (ES Modules, static hosting friendly).
  Uses `dompurify` for sanitizing rendered SVG, `p-limit` to throttle file analysis,
  and relies on local `@diagrammender/fix-rules-mermaid-compat`.
- `packages/parsers/python`: placeholder for the parser plugin (to be wired into core)
- `packages/fix-rules/mermaid-compat`: placeholder for fix rules
- `packages/core`: placeholder for IR and pipeline
- `packages/renderer/web`: placeholder for web renderer wrapper
- `packages/cli`: placeholder CLI

See `docs/ROADMAP.md` for phased plan, `docs/DiagramMender-X_Blueprint_v1.2_2025-09-13.md` for the locked architecture blueprint, and `docs/architecture/` for standalone diagram sources.
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

logs/：`npm run log` 會在此生成 `diagrammender-YYYY-MM-DD.log`，供除錯與追蹤。
data/：`npm run store` 會追加 JSON 紀錄於 `records-YYYY-MM-DD.json`。
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


---

## 🐍 Python CLI (Offline-Ready)

You can generate Mermaid diagrams **without any Node.js dependencies** using the included Python tools:

```bash
# Basic
python py2mermaid.py /path/to/python_project --out mermaid.md --html preview.html

# Extended (MD + MMD + HTML)
python py2mermaid_v2.py /path/to/python_project --out-md mermaid.md --out-mmd combined.mmd --out-html preview.html

# Wrapper
python run_v3_then_combine.py /path/to/python_project --out-dir out --name project
```

These commands work fully offline and embed `mermaid.min.js` into the HTML for self-contained previews.
