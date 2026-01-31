# DiagramMender‑X 規劃藍圖（Blueprint）v1.2  
*Last updated: 2025‑09‑13*

> **結論 / Decision**：本藍圖已鎖定。除非觸發「**改弦易轍條件**」（見 §11），否則不再調整整體架構與路線。

---

## 0. 摘要（Executive Summary）
**Goal**：打造一個跨語言、可插拔、具視覺回歸測試的「程式 → 架構圖自動生成與修復系統」。  
**Input**：多語言原始碼（M1 先支援 Python；後續 TS/JS）。  
**Core**：統一 Graph IR + 規則引擎（修復/樣式/一致性）+ 可替換布局（Mermaid + ELK）。  
**Output**：Mermaid / PlantUML / SVG / PNG / HTML、差異報告（可於 PR 顯示）。  
**Surfaces**：CLI、Web UI、CI/CD（GitHub Actions）。

**里程碑**：M0（修復可運行性）→ M1（端到端 MVP）→ M2（品質與回歸）→ M3（商品化）。

---

## 1. 架構總覽（Architecture Overview）

```
       Source Code (py / ts / js / ...)
                      │
                  [Parsers]
                      │  produce
                      ▼
                 Graph IR (v1)
   ┌───────────┬───────────────┬──────────────┐
   │ Normalize │  Fix Rules    │  Style Rules │
   └───────────┴───────────────┴──────────────┘
                      │
                 [Renderer(s)]
        ┌─────────────┴─────────────┐
        ▼                           ▼
   Mermaid string             PlantUML / others
        │                           │
   Web UI / CLI                SVG/PNG/PDF via CLI
        │                           │
   Visual Regression (Playwright / Jest+pixelmatch)
        │
   CI/CD（PR 註解 + 工件 artifact）
```

**模組清單（8 子系統）**
| Package | 角色 / Role | 關鍵責任 |
|---|---|---|
| `@diagrammender/core` | 管線中樞（parse→normalize→fix→style→render） | 定義 IR / Pipeline / Validator / Serializer |
| `@diagrammender/parser-python` | Python → IR | 由輕量 AST/regex 起步，後續 tree‑sitter/原生 AST |
| `@diagrammender/fix-rules-mermaid-compat` | 規則引擎（Mermaid 相容/一致性） | 規則優先級、可開關、變更報告 |
| `@diagrammender/renderer-mermaid` | IR → Mermaid（純字串） | SSR/CLI 友善 |
| `@diagrammender/renderer-web` | Browser 渲染（mermaid v11 + 可選 ELK） | UI 預覽、互動 |
| `@diagrammender/ui-web` | 操作介面 | 左：輸入；中：預覽；右：規則面板與 diff |
| `@diagrammender/cli` | 自動化入口 | 單檔/專案產圖、格式轉換、差異報告 |
| `@diagrammender/testkit` | 測試與回歸 | 單元＋視覺回歸、基線工件管理 |

---

## 2. 技術決策與約束（Tech Decisions & Constraints）

1. **套件管理器**：預設 **pnpm workspaces**（需 `pnpm-workspace.yaml`）。  
2. **Mermaid**：釘選 **v11.x**；大型圖可選配 `@mermaid-js/layout-elk`。  
3. **離線產圖**：CI 優先使用 `@mermaid-js/mermaid-cli`（`mmdc`）；Node API 為次選。  
4. **視覺回歸**：優先 **Playwright `toHaveScreenshot()`**；Jest 備援 `jest-image-snapshot` + `pixelmatch`。  
5. **CI**：GitHub Actions 釘選 `actions/checkout@v4`、`actions/upload-artifact@v4`；PR 留言用 octokit 或成熟 Action。  
6. **Parser 策略**：短期 stub → 中期 **tree‑sitter / web‑tree‑sitter**；Parser 僅負責→IR，不做修復/樣式。  
7. **環境一致性**：Dockerize 渲染與回歸測試（字型、DPI、mermaid 版本固定）。

---

## 3. Graph IR 1.0（Schema & Contracts）

**TypeScript 介面（建議）：**
```ts
export interface Graph {
  irVersion: "1.0";
  nodes: Node[];
  edges: Edge[];
  meta?: Record<string, unknown>;
}

export interface Node {
  id: string;                 // stable unique
  label: string;              // human‑readable
  kind: "module" | "class" | "func" | "file" | "pkg" | string;
  attrs?: Record<string, unknown>;
  src?: SourceInfo;           // origin traceability
}

export interface Edge {
  from: string;
  to: string;
  type: "calls" | "imports" | "extends" | "uses" | "contains" | string;
  attrs?: Record<string, unknown>;
  src?: SourceInfo;
}

export interface SourceInfo {
  lang: "py" | "ts" | "js" | string;
  file: string;
  range?: { start: number; end: number };  // byte/char offset
  hash?: string;                            // content hash (short)
}
```

**不變式（Invariants）**
- Node ID **唯一**且**穩定**（以 `<lang>:<path>#<symbol>` 生成）。  
- Edge `from/to` 指向已存在節點；型別受控於字典（可擴充）。  
- `meta` 包含生成版本、時間、來源檔案集合摘要。

---

## 4. Pipeline 合約（Core API）

```ts
// Core 入口：傳回可渲染束（含中間產物與報告）
export interface RunOptions {
  lang: "py" | "ts" | "js";
  files: Array<{ path: string; content?: string }>; // 可直接給內容或由 path 讀取
  rules?: RuleConfig;           // 啟閉 / 權重 / preset
  renderer?: "mermaid";         // 後續可擴充 plantuml, graphviz
  layoutPreset?: "auto" | "elk" | "dagre" | string;
}

export interface DiagramBundle {
  ir: Graph;
  mermaid?: string;             // 若 renderer=mermaid
  reports: {
    changes: ChangeReport;      // Fix/Style 前後差異摘要
    stats: Record<string, number>;
    logs: Array<{ level: "info"|"warn"|"error"; msg: string }>;
  };
}

export function runPipeline(opts: RunOptions): Promise<DiagramBundle>;
```

---

## 5. 規則引擎（Rules）

**目標**：能被序列化、可 preset、可追蹤「改了什麼 & 為何」。

**範例設定（YAML/JSON 皆可）：**
```yaml
preset: "strict"
rules:
  - name: "normalize-edge-direction"
    enabled: true
    options: { preferLeftToRight: true }
  - name: "dedupe-anonymous-functions"
    enabled: true
  - name: "sanitize-node-label"
    enabled: true
    options: { trim: true, collapseWhitespace: true, maxLen: 40 }
layout:
  engine: "elk"            # auto|elk|dagre
  options:
    elk.hierarchyHandling: "INCLUDE_CHILDREN"
```

**報告格式（摘要）**
```json
{
  "rulesApplied": [
    { "name": "sanitize-node-label", "changes": 14 },
    { "name": "normalize-edge-direction", "changes": 8 }
  ],
  "nodeDelta": { "added": 2, "removed": 1, "changed": 9 },
  "edgeDelta": { "added": 3, "removed": 0, "changed": 5 }
}
```

---

## 6. 介面與使用（Interfaces）

### 6.1 CLI（@diagrammender/cli）
```
diagrammender <path|glob> \
  --lang py \
  --out out/ \
  --format mmd,svg \
  --rules preset:strict \
  --layout elk \
  --baseline .diagram-baseline/ \
  --report report.json
```

- `--format`: `mmd|svg|png|pdf`（多選以逗號分隔）  
- `--baseline`: 開啟視覺回歸，輸出 diff 圖與統計  
- `--rules`: `preset:<name>` 或指向一個 YAML/JSON

### 6.2 Web UI（@diagrammender/ui-web）
- 左：上傳/貼上程式碼或選擇檔案/專案  
- 中：即時預覽（Mermaid v11；大型圖可切換 ELK）  
- 右：規則面板（開關/權重/預設組合），差異摘要（前/後）  
- 工具列：匯出 `.mmd` / `.svg` / `.png`、儲存設定檔、下載報告

---

## 7. 里程碑與交付（Milestones & Deliverables）

### M0 — 可運行性修復（Blocking）
- 修正 JSON 語法錯誤（root、`packages/core`、`packages/ui-web` 尾逗點）。  
- 新增 `pnpm-workspace.yaml`；root `scripts` 最小集合：`build|dev|test`。  
- `ui-web` 以 `npx serve` 能啟動 Demo。

**KPI**
- `pnpm i` 成功；至少一條端到端（UI 或 CLI）能輸出圖。

### M1 — 端到端 MVP
- `core`：落地 IR 與 `runPipeline()`。  
- `parser-python`：輕量 AST/regex，產出小圖 IR（def/class/call/import）。  
- `fix-rules-mermaid-compat`：2 條實做規則（去雜訊、方向標準化）。  
- `renderer-mermaid`：IR→Mermaid 字串。  
- `cli`：`diagrammender file.py > out.mmd` 成功。  
- `ui-web`：上傳/貼上 → 看到圖；規則啟閉可見差異。

**KPI**
- 單檔 Python → `.mmd`；UI 可操作；變更報告可見。

### M2 — 品質與回歸
- Playwright 視覺回歸；GitHub Action 上傳工件與 PR 註解。  
- Parser Python 更細化（呼叫鏈/類別/模組關係）。  
- 大圖處理：子圖/分頁/分層（layout hints）。

**KPI**
- 10 個樣本專案穩定產圖；同輸入像素差 < 2%。

### M3 — 商品化/擴展
- 新語言：TS/JS Parser。  
- 規則 preset：`readable | strict | publish`。  
- 可選：雲端渲染 API；VS Code 擴充。

**KPI**
- 第二語言上線；`preset:publish` 通過內部一致性審核。

---

## 8. 專案初始化（Setup & Commands）

**選 pnpm（推薦）**
```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "packages/**"
```

**Root `package.json` 片段**
```json
{
  "private": true,
  "name": "diagrammender-x",
  "scripts": {
    "build": "pnpm -r run build",
    "dev": "pnpm --filter @diagrammender/ui-web dev",
    "test": "pnpm -r run test"
  },
  "workspaces": ["packages/*"]
}
```

**快速驗證 UI（無需完整建置）**
```bash
npx serve packages/ui-web -l 5173
# 打開 http://localhost:5173
```

**建議 Docker（渲染/回歸一致性）**
```Dockerfile
FROM mcr.microsoft.com/playwright:v1.48.0-jammy
RUN npm i -g @mermaid-js/mermaid-cli@11 && \
    npm i -g pnpm@9
# 安裝字型、設定時區/locale 視需要
```

---

## 9. CI / CD（GitHub Actions 範例）

```yaml
name: diagram-ci
on:
  pull_request:
    paths:
      - "packages/**"
      - "tools/**"
jobs:
  build-and-visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm i -g pnpm@9 @mermaid-js/mermaid-cli@11
      - run: pnpm i
      - run: pnpm -r run build
      - run: pnpm -r run test # 其中包含 Playwright 視覺回歸
      - uses: actions/upload-artifact@v4
        with:
          name: diagram-diffs
          path: out/diffs/**
      # 可選：用 octokit 自動在 PR 留言附縮圖與連結
```

---

## 10. 風險與緩解（Risks & Mitigations）

| 風險 | 影響 | 緩解 |
|---|---|---|
| Parser 實作成本高 | 無法覆蓋語言特性 | 先 stub → 漸進 AST；導入 tree‑sitter |
| 大圖可讀性差 | 產物不具可用性 | ELK/分層/子圖、preset:large |
| 渲染不一致 | 回歸測試不穩 | Dockerize + 字型釘選 + 版本鎖定 |
| 使用者誤用規則 | 圖表失真 | 規則預設組合 + 變更報告 + UI 提示 |
| CLI 依賴環境 | CI 失敗 | Docker/Action 釘選版本、cache node_modules |

---

## 11. 反向驗證／改弦易轍條件（When We Must Change Course）
- 像素級一致性為硬要求 → **Playwright 截圖即最終產物**，CLI 退居輔助。  
- 圖量級遠超 dagre → 大型圖 **強制 ELK** + 子圖策略；必要時評估其他 layout。  
- 協作方強制工具（Yarn4 / npm workspaces）→ 切換 workspace 工具但維持模組邏輯不變。

---

## 12. 標準評估通則（V1.2）— 驗收門檻
1. **Blocking 可運行性**：pnpm 工作區可 `install`；UI 或 CLI 至少一條端到端可輸出圖；渲染與測試環境版本鎖定。  
2. **IR 一致性**：IR 有 schema 與版本；Parser/Rules/Renderer 各司其職。  
3. **規則引擎**：可序列化、可 preset、可輸出差異報告（節點/邊/樣式）。  
4. **視覺回歸**：Playwright 或 Jest 方案；CI 產出 diff 與工件。  
5. **CI/CD**：`actions/checkout@v4`、`upload-artifact@v4`；PR 自動留言（含縮圖與連結）。  
6. **文件**：README（安裝/使用/IR/規則 preset）、Roadmap、貢獻指南。

> 任一 Blocking 未過 ⇒ **不可交付**；其餘缺陷 ⇒ 標註 Pre‑Alpha/Alpha 並列出補強單。

---

## 13. 被排除的錯誤邏輯（Exclusions）
- 「Node API 版 mermaid 比 CLI 更穩」→ 排除；CI 以 CLI 更可控。  
- 「ELK 內建於所有 Mermaid 發布」→ 排除；多數情況需另裝 `@mermaid-js/layout-elk`。  
- 「pnpm 僅靠 root `package.json` 的 workspaces 即可」→ 排除；需 `pnpm-workspace.yaml`。

---

## 14. 目錄與檔案建議（Scaffold）
```
/packages
  /core
  /parser-python
  /fix-rules
    /mermaid-compat
  /renderer-mermaid
  /renderer-web
  /ui-web
  /cli
/testkit
/tools
.github/workflows/diagram.yml
pnpm-workspace.yaml
```

---

## 15. 附錄（Appendix）

**A. `pnpm-workspace.yaml`**
```yaml
packages:
  - "packages/*"
  - "packages/**"
```

**B. `rules.preset.yaml`**
```yaml
preset: "readable"
rules:
  - name: "sanitize-node-label"
    enabled: true
    options: { collapseWhitespace: true, maxLen: 40 }
  - name: "normalize-edge-direction"
    enabled: true
layout:
  engine: "dagre"
```

**C. CLI 快速上手**
```bash
# 單檔→mmd
diagrammender src/app.py --lang py --format mmd --out out/

# 專案→mmd+svg，開啟 ELK 與 strict 規則
diagrammender src/**/*.py --lang py --format mmd,svg --layout elk --rules preset:strict
```

**D. Changelog**  
- v1.2（2025‑09‑13）：鎖定藍圖；微調 6 項工具/版本策略；補充 CI 與回歸測試範例。  
- v1.1：新增規則引擎報告格式、IR 追溯欄位。  
- v1.0：初版藍圖與模組分層。

---

**License / Contributing**：待 M1 完成後補充。

> 本文件以 **中文為主、英文為輔**；技術名詞使用慣用英文，以避免歧義。
