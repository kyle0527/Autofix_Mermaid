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
