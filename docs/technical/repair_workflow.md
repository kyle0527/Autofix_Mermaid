# Mermaid 修復流程與輸入輸出規範

本文檔說明如何使用本專案的「規則修復 + 批次驗證」工具鏈（已在 `tests/` 下提供範例腳本），以及程式需要哪些輸入、會產生哪些輸出、以及如何解讀追蹤（trace）資訊。

## 目標
- 建立可重現的工作流程：把已知「正確」的 Mermaid 範例與其「故障」變體丟進程式，讓系統用規則或啟發式修補嘗試修復，並記錄每一步發生了什麼（trace），最後用驗證器或官方 renderer 判定是否成功。

## 現有腳本（位置與用途）
- `tests/bulk_diagram_test.mjs`：從 `js/models/knowledge_index_v1.json` 擷取官方範例，生成 40 valid + 40 broken 測資，套用 `js/models/rules_v1.json` 的規則進行修補，並輸出 `tests/output/results.json`, `results.csv`, `results-trace.json`。
- `tests/fix_examples.mjs`：針對附件三題（ex1/ex2/ex3）做目標驅動的修復（heuristics + 對照 target 逐行替換），並輸出 `tests/output/fix_examples_results.json`。

## 必要輸入（程式要什麼）
1. 範例集合（正確樣本）
   - 來源：由官方範例或 Live Editor 輸出，應該是合法且可由官方 mermaid parser 解析的 Mermaid 文本（完整 block，含 `graph TD` 或其它 diagram header）。
   - 格式：純文字，若多個樣本則每個為一個 block（或放在 JSON 陣列中）。

2. 故障樣本（要修復的）
   - 來源：由人為「破壞」的正確樣本，或從 issue/回報中擷取的錯誤例子。
   - 格式：與正確樣本一樣（純文字），但可能含缺失括號、破損箭頭、雙語標籤內含特殊字元等問題。

3. 修復規則（可選）
   - 目前放在 `js/models/rules_v1.json`，規則格式採：`detect` (diagram / regex / config) 與 `fix.actions`（text_patch）
   - 如果你要新增新規則，請同時提供單元測試用例，並在 CI 中檢查 regex 可編譯。

4. （如需）官方 renderer
   - 若要精確檢驗是否能 render，請安裝 `@mermaid-js/mermaid-cli` 或用 `puppeteer + vendor/mermaid.min.js` 在 headless 瀏覽器中渲染。簡易驗證器只做括號/關鍵字/基本節點/邊檢查，不能取代官方 parser。

## 輸出說明（程式會產生哪些檔案）
- `tests/output/results.json` / `results-trace.json`：每個測試案例的詳細結果，結構如下：

  {
    id: string,
    initialValid: boolean,
    initialProblems: string[],
    rulesHit: string[],
    trace: Array<{ rule: string, changes: Array }>,
    patchesApplied: Array, // list of {id,type,pattern}
    finalValid: boolean,
    finalProblems: string[],
    codeBefore: string,
    codeAfter: string
  }

- `tests/output/results.csv`：摘要表格，方便快速過濾與統計。
- `tests/output/fix_examples_results.json`：ex1/ex2/ex3 的逐題修復結果（包含 applied trace 與最終驗證）。

## Trace 格式與如何解讀
- `trace` 會依序記錄每個被套用的 rule 與它造成的 `changes`（若有）。
- 每個 `change` 至少包含 rule id、action type（目前多為 `text_patch`）與 pattern 或 before/after snippet。
- 使用這些 trace 可以快速定位是哪個規則或哪個替換步驟造成未通過驗證（或成功）。

## 最佳實作流程（step-by-step）
1. 收集正確樣本（官方生成的，確保官方 mermaid 能 render）並放進 `tests/fixtures/official/`（每個檔案一個 block）
2. 生成故障樣本（手動或自動 mutate）並放進 `tests/fixtures/broken/`，同一 index 對應一對
3. 執行 `node tests/bulk_diagram_test.mjs`（會產生初步修復與 trace）
4. 取出失敗案例（`finalValid === false`），分析 `results-trace.json` 的 trace 找出最常見的 failure types
5. 針對常見 failure types 撰寫或調整規則（`js/models/rules_v1.json`）或針對性啟發式修補
6. 重新跑批次測試並驗證改進
7. 最後，用官方 renderer（`mermaid-cli`）做最終驗證：

```bash
# 安裝（如未安裝）
npm install -g @mermaid-js/mermaid-cli

# 範例：把 code 後再檢查是否可 render
mmdc -i tests/output/some_example.mmd -o /tmp/some_example.svg
```

## 要給程式的「具體」東西（Checklist）
- 每個測試 case：{ id, code (原始), target (可選) }
- 規則檔：`rules_v1.json`（必須 valid JSON，regex 必須可編譯）
- 最好同時包含：`configSnapshot`（若規則依賴 config）
- 指示是否啟用「保守模式」：僅做 safe text_patch（不改動結構），或開啟 aggressive mode（允許大段替換或要求 provider 產出 entire replacement）

## 快速回顧：剛才我做了哪些可重用的東西
- `tests/bulk_diagram_test.mjs`：批次測試 harness（輸入：knowledge_index，輸出：results）
- `tests/fix_examples.mjs`：ex1/ex2/ex3 的目標驅動修復流程（示例腳本與 trace）

## 下一步（如果你希望我繼續）
1. 我可以把官方 renderer（mermaid-cli）整合到測試腳本裡，讓每個 case 都用官方 parser 做最終通過/失敗判定。這需要安裝 mermaid-cli（或在 CI 中加入）。
2. 我可以自動化 failure summarization（產生 `tests/output/failure_summary.json`），列出 top failure types 與 sample ids。
3. 我可以把 rules 的變更做成可回溯的 patch 並提供 PR-style diff 供你審核。

---
在 Codespace 時間短的情況下，我已留下可立即運行的腳本與輸出位置；你回到有空的環境時，只要按上面 checklist 提供「正確樣本」與（可選）`mermaid-cli`，即可開始系統化修復與驗證循環。需要我把這份文件 commit 到 repo（已建立於 `docs/repair_workflow.md`），或再補上 `mermaid-cli` 的整合腳本嗎？
