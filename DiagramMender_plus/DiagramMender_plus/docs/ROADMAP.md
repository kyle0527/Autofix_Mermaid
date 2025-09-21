# ROADMAP

參考 [DiagramMender-X Blueprint v1.2](DiagramMender-X_Blueprint_v1.2_2025-09-13.md) 了解完整架構與決策。

## Phase 1 (Now) （Day 1–30）→ L1 Alpha**：打通 IR／管線，UI 改走 core API
- Keep a **working UI** under `packages/ui-web` (ESM, zero-bundler).
- Establish **IR** shape and **Emitter** interface in `packages/core`.
- Migrate Python analyzer into `packages/parsers/python` and rewire UI to import from core (via bundler or relative path).

## Phase (2 Day 31–60）→ L2 Beta**：CLI、Fix-Rules 可管、擴兩種圖型、CI 上線
- Extract AutoFix rules into `packages/fix-rules/mermaid-compat` with a registry.
- Provide **CLI** that runs `parse -> fix -> emit` on a path.

## Phase 3 （Day 61–90）→ L3 GA/RC**：SVG/PNG 匯出、效能/快取、文件齊備、釋出 RC
- Add CI (lint, unit/snapshot tests) and GH Pages for demo deployment.
- Prepare for additional languages and export formats (SVG/PNG).
# DiagramMender — 90 天路線圖（3 × 10）


## 甘特圖
```mermaid
gantt
    dateFormat  YYYY-MM-DD
    axisFormat  %m/%d
    title DiagramMender — 90天三階段計畫

    section Phase 1（L1 Alpha）
    IR/Emitter骨架(P1-01~02)        :p101, 2025-09-05, 6d
    Parser初始化/Adapter(P1-03~04)   :after p101, 6d
    Fix規則/Renderer封裝(P1-05~06)   :after p101, 6d
    E2E/Config/Docs/Gate(P1-07~10)   :after p101, 12d

    section Phase 2（L2 Beta）
    CLI雛形/規則擴充(P2-01~02)      :p201, 2025-10-05, 6d
    IR擴展/Class圖(P2-03~04)         :after p201, 9d
    Sequence圖/導出/CI(P2-05~07)     :after p201, 9d
    快照凍結/效能基線/Gate(P2-08~10) :after p201, 6d

    section Phase 3（L3 GA/RC）
    SVG匯出/圖型切換(P3-01~02)       :p301, 2025-11-04, 9d
    差異比較/快取/大型衛生(P3-03~05) :after p301, 12d
    文件/品質/網站/法務/Gate(P3-06~10):after p301, 9d

## 模組建議使用語言

| 模組 | 建議語言 | 理由概要 |
|------|----------|----------|
| `packages/core`（IR／pipeline／Emitter） | TypeScript (ESM) | 同時供 UI 與 CLI 呼叫；TypeScript 提供型別與外掛介面，維護成本低。 |
| `packages/parsers/python`（Python 解析） | TypeScript + web-tree-sitter（Python grammar） | WebAssembly 版 tree-sitter 可在瀏覽器/Node 通用，避免引入 Python runtime。 |
| `packages/fix-rules/mermaid-compat`（修復規則集） | TypeScript | 與 core 同語言便於規則註冊、型別守衛與測試。 |
| `packages/renderer/web`（Web 渲染封裝） | TypeScript | 抽象封裝 Mermaid 與未來其他渲染器，輸出格式易於替換。 |
| `packages/ui-web`（ESM Demo） | 先 JavaScript + JSDoc 型別，逐步升級至 TypeScript | 先用 JSDoc 供型別補全，後期引入 TypeScript/Vite。 |
| `packages/cli`（命令列工具） | TypeScript (Node ESM) | 需結合 core 型別介面並處理檔案 I/O，TypeScript 最穩定。 |
| 設定/Schema | JSON / JSON Schema | 統一 `diagrammender.config.json`，利用 Schema 驗證與自動補全。 |
| 文件/測試 | Markdown（docs）、Vitest/Playwright（測試） | Markdown 易維護；Vitest 做單元/快照測試，Playwright 做 UI/E2E 測試。 |

