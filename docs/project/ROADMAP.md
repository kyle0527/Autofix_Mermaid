# ROADMAP (Strategic Overview)

> 本文件聚焦高層策略排程，搭配 `FEATURES_AND_ROADMAP.md` 的細節使用。

## 願景 (Vision)
打造可商用的「多語言程式架構 → Mermaid 圖表自動化平台」，以 IR 為核心，串接解析、修復、可視化與協作。

## 指導原則 (Principles)
1. Incremental Parsing：大專案增量更新 AST/IR。
2. Deterministic Output：相同輸入 → 相同 Mermaid 結果。
3. Pluggable Rules：修復/格式化/生成規則模組化。
4. Security by Design：避免任意輸入導致 XSS / 任意執行。
5. Open Core + Enterprise Extensions：核心 MIT，可疊加企業套件。

## 時程分階 (Phases)
| Phase | 時間 (估) | 核心主題 | 產出 | 指標 |
|-------|----------|----------|------|------|
| P1 | 0-1 月 | 多語言解析雛形 | JS/TS Grammar + IR v1 + Flowchart/Class 生成 | 單檔 1k 行解析 < 500ms |
| P2 | 1-2 月 | 規則化與格式化 | RulePack v1 + Formatter + CLI | 10+ 規則、單測 80% 覆蓋率 |
| P3 | 2-3 月 | 視圖擴充 | 呼叫圖/依賴圖 + 批次匯出 | 3 視圖切換 < 300ms |
| P4 | 3-4 月 | 協作與差異 | 專案 Workspace + IR Diff | 兩版本差異輸出 < 2s |
| P5 | 4-6 月 | SaaS 化 | REST API + RBAC + 日誌 | 每日 1k Job 稳定 |
| P6 | 6 月+ | 生態與擴散 | Plugin SDK + 市集構想 | 社群提交 Plugin >= 5 |

## 版本方向建議 (Version Tracks)
> 四個互補的版本走向，對應核心能力的擴張與商用化需求，可視情況平行或序列推進。

### 方向 A．Tree-sitter 語言插件生態
- **焦點**：建立跨語言的 Parser 插件協議，先實作 Python、JavaScript、TypeScript，並確保 Node/Web 兩端結果一致。
- **關鍵交付**：`registerParserPlugin` 框架、語言套件、語法錯誤回報、100 檔抽樣 IR diff 驗證。
- **成功指標**：1k 檔專案解析成功率 ≥ 99%、吞吐量 ≥ 2k 檔/分鐘，瀏覽器端 fallback 策略明確。
- **相依風險**：WASM grammar 與 Node 模組差異；需與 web-tree-sitter 補丁同步驗證。
- **後續行動建議**：
  1. 定義 `detect`/`parseProject` 介面與錯誤回報格式，並在 `core/parsers` 建立插件註冊流程。
  2. 以 Python 為樣板實作 JS / TS 插件，確保 Node 端與 web-tree-sitter 產出 IR 一致且有回退機制。
  3. 建立 1k 檔案級別的基準測試與日誌蒐集，量測成功率、吞吐量與資源使用。

### 方向 B．IR 關聯分析與多視圖輸出
- **焦點**：擴充 IR schema，補齊呼叫、依賴等關係，並輸出 `callGraph`、`dependencyGraph` 等 Mermaid 圖。
- **關鍵交付**：關聯分析器、Mermaid Emitter 擴充、UI/CLI 圖種切換、圖邊一致性測試。
- **成功指標**：100k 邊級專案 60 秒內完成輸出、跨語言 IR diff 差異 ≤ 0.1%。
- **相依風險**：語言解析不一致；需與方向 A 的 IR 標準化協同。
- **後續行動建議**：
  1. 在 IR schema 中新增呼叫與依賴欄位，並擴充語言解析器寫入命名空間資訊。
  2. 實作 `dependenciesAnalyzer`、`callgraphAnalyzer` 等分析模組，透過事件匯流排回寫 IR。
  3. 讓 Mermaid emitter 與 UI/CLI 支援多視圖切換，並建立 100 檔抽樣的圖邊快照測試。

### 方向 C．互動視覺化與批次匯出
- **焦點**：提供節點過濾、聚合、自訂佈局與局部重繪機制，完成 PDF/ZIP 批次匯出。
- **關鍵交付**：前端狀態管理與 Renderer 優化、`export.zip` 打包流程（含 mmd/svg/ir/report）、Playwright 互動測試。
- **成功指標**：10 萬節點圖操作回應 ≤ 200ms，分段重繪 CPU 降低 ≥ 40%。
- **相依風險**：一次性重繪造成卡頓；需先建立性能監控與 requestIdleCallback 策略。
- **後續行動建議**：
  1. 擴充前端狀態管理，支援度數、社群、命名空間等條件過濾與聚合，並導入局部重繪策略。
  2. 將多圖輸出、IR JSON、`REPORT.md` 串成統一的批次匯出流程，加入 PDF/ZIP 支援。
  3. 建立 Playwright/Smoke 測試與性能儀表，驗證 10 萬節點互動延遲與 CPU 使用率。

### 方向 D．商用工作區與雲端 API
- **焦點**：定義 Workspace 資料模型、版本化儲存與差異分析 API，導入 Token RBAC。
- **關鍵交付**：`/workspaces/{id}/ir`、`/views/{kind}`、`/diff` API、壓縮儲存與匯出流程、CLI diff 整合。
- **成功指標**：1k 版本快照查詢 P95 ≤ 300ms、100k 節點 diff P95 ≤ 3s。
- **相依風險**：大圖版本化成本高；需透過 struct-of-arrays + 分桶索引壓測驗證。
- **後續行動建議**：
  1. 以現有事件匯流排/結果儲存雛形擴充 Workspace 資料模型，定義版本化與壓縮策略。
  2. 實作核心 API（IR 上傳、視圖擷取、Diff）並結合 CLI diff，加入 Token 型 RBAC 與操作審計。
  3. 建立 1k 版本 × 100k 節點的壓測腳本，量測查詢與 diff P95 延遲並記錄資源曲線。

## 關鍵補丁優先順序（必備能力）
1. **瀏覽器端 web-tree-sitter 實裝**：確保前端可直接載入 WASM grammar，並在失敗時回退 heuristic parser；需建立 Node/Web IR 差異比對報表。
2. **Worker 重用與快取策略**：導入版本簽名與池化機制，避免分析任務每次重新下載/初始化，追蹤三次連跑的耗時與網路量以驗證 ≥ 35% 的效率提升。
3. **CLI 差異分析 (`diagrammender diff`)**：建立 JSON/Markdown 報告與 `--diagram` 可視化輸出，作為 Workspace 版本化與 CI 回歸檢查的基礎。
4. **正確的檔案映射策略**：針對 Mermaid 與各語言程式碼輸入輸出對應 `files.<ext>`，並加入 E2E 測試驗證 Worker 兩條路徑結果一致。

## 跨主線協同建議
- **共用事件匯流排與結果儲存**：解析、分析、可視化與匯出模組應訂閱同一事件來源，降低資料轉換成本並利於擴充語言插件。
- **自動化驗證矩陣**：在 CI 建立「語言 × 圖種 × 執行環境」的快照測試，掌握跨端差異並早期發現回歸。
- **性能與品質儀表板**：針對成功率、吞吐、圖輸出時間、互動延遲與 API 延遲等指標設立監控，確保達成各版本方向的 KPI。

## 關鍵技術里程碑
- IR Schema 定版 (含 Entities/Relations/Metadata)
- 插件載入 (動態 import + sandbox)
- Mermaid Lint + Formatter
- 差異分析演算法 (Relation Graph Diff)
- 渲染性能優化 (分層虛擬化 / Lazy Render)
- API Gateway + Queue (未來 SaaS)

## 風險矩陣 (Top 5)
| 風險 | 等級 | 緩解 |
|------|------|------|
| Grammar 數量 → 載入延遲 | 中 | Lazy + CDN + Cache Manifest |
| Mermaid 圖表複雜度 | 高 | 分群/折疊/分頁輸出 |
| 規則衝突 | 中 | Rule ordering + 測試快照 |
| 商用授權界線 | 中 | Open Core Policy 文件化 |
| 性能 (大專案) | 高 | Incremental IR + Worker Pool |

## 初始 KPI (建議)
- 解析成功率：> 95% (主語言無語法錯誤情況)
- 修復適用率：> 80% 目標案例可自動產生合規 Mermaid
- 單元測試覆蓋：行數 70% / 關鍵模組 90%
- 首屏渲染：< 2s (中型專案, 50 類別)
- 匯出成功率：> 99%

## 未來探索 (Exploration)
- AI 輔助：自然語言 → 指定生成 Mermaid 視圖
- 逆向模式：Mermaid → 程式骨架 (實驗性)
- 分散式解析：多 Worker 併行大型專案
- LLM + IR Summarization：自動產生架構說明文件

## 更新紀錄
- 2025-09-18：初版建立

---
> 若需調整或新增項目，請提交 Issue 標籤 `roadmap`。
