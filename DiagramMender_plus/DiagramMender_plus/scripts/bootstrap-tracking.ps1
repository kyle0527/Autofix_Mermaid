# scripts/bootstrap-tracking.ps1
param(
  [string]$Repo = "kyle0527/DiagramMender"
)

# ===== 0) 安全檢查 =====
gh repo view $Repo 1>$null 2>$null
if ($LASTEXITCODE -ne 0) { Write-Error "找不到 $Repo；請確認遠端 repo 是否存在、並已 gh auth login"; exit 1 }

# ===== 1) 標籤 =====
$labels = @(
  @{name="kind:task"; color="0366d6"; desc="Roadmap task"},
  @{name="phase-1";  color="1d76db"; desc="Phase 1 (Day 1–30)"},
  @{name="phase-2";  color="0052cc"; desc="Phase 2 (Day 31–60)"},
  @{name="phase-3";  color="172b4d"; desc="Phase 3 (Day 61–90)"},
  @{name="area:core"; color="5319e7"; desc="IR/Pipeline/Emitter"},
  @{name="area:parser"; color="0e8a16"; desc="Language parsers"},
  @{name="area:fix-rules"; color="e11d21"; desc="Mermaid compat rules"},
  @{name="area:renderer"; color="c2e0c6"; desc="Web/Node rendering"},
  @{name="area:ui"; color="fbca04"; desc="ui-web"},
  @{name="area:cli"; color="d93f0b"; desc="CLI"},
  @{name="docs"; color="5319e7"; desc="Documentation"},
  @{name="ci"; color="0e8a16"; desc="CI/CD"},
  @{name="testing"; color="006b75"; desc="Unit/E2E/Snapshot"}
)
foreach ($l in $labels) {
  gh label create $l.name --repo $Repo --color $l.color --description $l.desc 2>$null
}

# ===== 2) 里程碑 =====
$milestones = @(
  @{
    title = "Phase 1 — L1 Alpha (Day 1–30)"
    due_on = "2025-10-04T23:59:59Z"
    description = "Core IR/Emitter; UI→core; E2E & docs"
  },
  @{
    title = "Phase 2 — L2 Beta (Day 31–60)"
    due_on = "2025-11-03T23:59:59Z"
    description = "CLI; Fix-rules registry; class/sequence; CI"
  },
  @{
    title = "Phase 3 — L3 GA/RC (Day 61–90)"
    due_on = "2025-12-03T23:59:59Z"
    description = "SVG/PNG; cache/incremental; docs; RC"
  }
)

# 先查既有里程碑，避免重複
$existing = gh api repos/$Repo/milestones --paginate | ConvertFrom-Json
foreach ($m in $milestones) {
  if (-not ($existing | Where-Object { $_.title -eq $m.title })) {
    gh api repos/$Repo/milestones -X POST -F title="$($m.title)" -F due_on="$($m.due_on)" -F state="open" -F description="$($m.description)" 1>$null
  }
}

# ===== 3) 30 個 Issue 定義 =====
$issues = @(
  # ---- Phase 1 ----
  @{ code="P1-01"; title="IR 最小規格"; phase="phase-1"; milestone="Phase 1 — L1 Alpha (Day 1–30)"; labels=@("kind:task","phase-1","area:core"); body="**Goal:** 定義 IR 節點/邊與診斷格式。`core` 作為單一真相來源。\n**Acceptance:** 有型別與最小單元測試；能表示 flow 的基本元素。" },
  @{ code="P1-02"; title="Emitter 骨架（IR→Mermaid）"; phase="phase-1"; milestone="同上"; labels=@("kind:task","phase-1","area:core"); body="**Goal:** `emitMermaid()` 產出最小 Flowchart。\n**Acceptance:** 支援標題/註解/ID 穩定化；快照測試建立。" },
  @{ code="P1-03"; title="Python Parser 初始化（tree-sitter）"; phase="phase-1"; milestone="同上"; labels=@("kind:task","phase-1","area:parser"); body="**Goal:** 建立 web-tree-sitter + python grammar；抓取 import 依賴。\n**Acceptance:** 小型樣例可產 IR；單元測試覆蓋基本節點。" },
  @{ code="P1-04"; title="UI→core 過渡 Adapter"; phase="phase-1"; milestone="同上"; labels=@("kind:task","phase-1","area:ui","area:core"); body="**Goal:** `ui-web` 不再手拼字串，改呼叫 `core.parse/emit`。\n**Acceptance:** Demo 正常；移除 UI 對分析/emit 的硬耦合。" },
  @{ code="P1-05"; title="AutoFix 拆為規則 + 註冊表（第一批 3 條）"; phase="phase-1"; milestone="同上"; labels=@("kind:task","phase-1","area:fix-rules"); body="**Goal:** 缺字首、箭頭、樣式三條規則；建立註冊表。\n**Acceptance:** 可依序套用/開關；快照覆蓋。" },
  @{ code="P1-06"; title="Renderer 封裝（web）"; phase="phase-1"; milestone="同上"; labels=@("kind:task","phase-1","area:renderer","area:ui"); body="**Goal:** 封裝 Mermaid 介面；UI 只傳 mmd + 掛載點。\n**Acceptance:** 渲染錯誤可回報；導出 mmd 文字。" },
  @{ code="P1-07"; title="E2E：資料夾→mmd 快照"; phase="phase-1"; milestone="同上"; labels=@("kind:task","phase-1","testing"); body="**Goal:** 加一套端對端，固定快照。\n**Acceptance:** 重跑結果一致；CI 可跑。" },
  @{ code="P1-08"; title="Config 與忽略規則"; phase="phase-1"; milestone="同上"; labels=@("kind:task","phase-1","docs"); body="**Goal:** `diagrammender.config.json` 與 exclude 規則。\n**Acceptance:** 文件更新；示例可用。" },
  @{ code="P1-09"; title="文件與樣例補齊"; phase="phase-1"; milestone="同上"; labels=@("kind:task","phase-1","docs"); body="**Goal:** README/structure/ROADMAP 對齊現況；補最小樣例專案。\n**Acceptance:** 新手可照文檔跑起來。" },
  @{ code="P1-10"; title="L1 Gate（Alpha）"; phase="phase-1"; milestone="同上"; labels=@("kind:task","phase-1","ci","testing","docs"); body="**Goal:** 收斂與打標籤 `v0.1.0-alpha`。\n**Acceptance:** 覆蓋≥40%、E2E 綠、Docs 同步。" },

  # ---- Phase 2 ----
  @{ code="P2-01"; title="CLI 雛形"; phase="phase-2"; milestone="Phase 2 — L2 Beta (Day 31–60)"; labels=@("kind:task","phase-2","area:cli","area:core"); body="**Goal:** `diagrammender <path> --out out.mmd`；支援 stdout。\n**Acceptance:** 在 CI 上能跑；輸出穩定。" },
  @{ code="P2-02"; title="Fix-Rules 擴充 5 條"; phase="phase-2"; milestone="同上"; labels=@("kind:task","phase-2","area:fix-rules","testing"); body="**Goal:** 節點命名、重複邊、方向、群組、標籤清理。\n**Acceptance:** 快照覆蓋；可配置排序。" },
  @{ code="P2-03"; title="IR 擴展（scope/call）"; phase="phase-2"; milestone="同上"; labels=@("kind:task","phase-2","area:core"); body="**Goal:** 為 class/sequence 鋪路；加入作用域/呼叫邊。\n**Acceptance:** 單元測試通過；不破壞現有快照。" },
  @{ code="P2-04"; title="Class 圖最小可用"; phase="phase-2"; milestone="同上"; labels=@("kind:task","phase-2","area:core"); body="**Goal:** 模組/類別/關聯 → Mermaid class。\n**Acceptance:** 範例輸出穩定；文件更新。" },
  @{ code="P2-05"; title="Sequence 圖最小可用"; phase="phase-2"; milestone="同上"; labels=@("kind:task","phase-2","area:core"); body="**Goal:** 主流程呼叫鏈 → Mermaid sequence。\n**Acceptance:** 範例輸出穩定；快照建立。" },
  @{ code="P2-06"; title="導出 mmd（UI/CLI）"; phase="phase-2"; milestone="同上"; labels=@("kind:task","phase-2","area:ui","area:cli"); body="**Goal:** UI 一鍵下載 `.mmd`；CLI 指定 out 路徑。\n**Acceptance:** 兩端皆可成功導出。" },
  @{ code="P2-07"; title="CI（最小）"; phase="phase-2"; milestone="同上"; labels=@("kind:task","phase-2","ci"); body="**Goal:** GitHub Actions 跑 lint/unit/e2e。\n**Acceptance:** PR Gate 生效；主線綠燈。" },
  @{ code="P2-08"; title="快照基線凍結"; phase="phase-2"; milestone="同上"; labels=@("kind:task","phase-2","testing"); body="**Goal:** 3 組樣例凍結快照；破壞性需註記。\n**Acceptance:** 變更流程文件化。" },
  @{ code="P2-09"; title="效能基線"; phase="phase-2"; milestone="同上"; labels=@("kind:task","phase-2","testing"); body="**Goal:** 5k/20k 行基準解析/emit 耗時。\n**Acceptance:** 有數據與基準表。" },
  @{ code="P2-10"; title="L2 Gate（Beta）"; phase="phase-2"; milestone="同上"; labels=@("kind:task","phase-2","ci","testing","docs"); body="**Goal:** 打標籤 `v0.2.0-beta`。\n**Acceptance:** CLI/兩圖型/CI/Docs 均就緒。" },

  # ---- Phase 3 ----
  @{ code="P3-01"; title="Headless 匯出 SVG"; phase="phase-3"; milestone="Phase 3 — L3 GA/RC (Day 61–90)"; labels=@("kind:task","phase-3","area:cli","area:renderer"); body="**Goal:** CLI 以 Playwright/Puppeteer 匯出 SVG。\n**Acceptance:** 範例專案可自動產生 SVG。" },
  @{ code="P3-02"; title="圖型切換（config）"; phase="phase-3"; milestone="同上"; labels=@("kind:task","phase-3","area:core","area:ui","area:cli"); body="**Goal:** config 指定 flow/class/sequence；UI/CLI 同步。\n**Acceptance:** 三圖可選；文件更新。" },
  @{ code="P3-03"; title="差異比較（基礎）"; phase="phase-3"; milestone="同上"; labels=@("kind:task","phase-3","area:core"); body="**Goal:** 兩路徑/commit 產圖，標示新增/移除/變更（文字層）。\n**Acceptance:** 有比對報表；示例與說明。" },
  @{ code="P3-04"; title="快取與增量"; phase="phase-3"; milestone="同上"; labels=@("kind:task","phase-3","area:core"); body="**Goal:** mtime/哈希快取，降低重跑時間。\n**Acceptance:** 大專案重跑時間顯著下降。" },
  @{ code="P3-05"; title="大型專案衛生策略"; phase="phase-3"; milestone="同上"; labels=@("kind:task","phase-3","area:core"); body="**Goal:** 節點/邊上限、截斷與摘要策略。\n**Acceptance:** 超限時有降噪產出與告警。" },
  @{ code="P3-06"; title="文件強化"; phase="phase-3"; milestone="同上"; labels=@("kind:task","phase-3","docs"); body="**Goal:** 操作手冊、設定 Schema、故障排除。\n**Acceptance:** 新手 10 分鐘內可跑通。" },
  @{ code="P3-07"; title="品質門檻"; phase="phase-3"; milestone="同上"; labels=@("kind:task","phase-3","testing","ci"); body="**Goal:** 覆蓋≥60%、大倉解析≤N 秒、RC 清單過關。\n**Acceptance:** 報表與徽章可見。" },
  @{ code="P3-08"; title="網站/示範"; phase="phase-3"; milestone="同上"; labels=@("kind:task","phase-3","docs","area:renderer","area:ui"); body="**Goal:** GitHub Pages demo 或示範影片/截圖。\n**Acceptance:** 公開可訪問連結。" },
  @{ code="P3-09"; title="法務/授權"; phase="phase-3"; milestone="同上"; labels=@("kind:task","phase-3","docs"); body="**Goal:** LICENSE、第三方授權表、商業條款占位。\n**Acceptance:** 版權資訊齊全。" },
  @{ code="P3-10"; title="L3 Gate（GA/RC）"; phase="phase-3"; milestone="同上"; labels=@("kind:task","phase-3","ci","testing","docs"); body="**Goal:** 釋出 `v1.0.0-rc`（或 GA）。\n**Acceptance:** 介面凍結、快照凍結、公告完成。" }
)

# 里程碑標題簡寫處理
function Resolve-Milestone {
  param([string]$Title)
  if ($Title -eq "同上") { return "Phase 1 — L1 Alpha (Day 1–30)" }
  return $Title
}

# ===== 4) 建立 Issues =====
foreach ($i in $issues) {
  $ms = Resolve-Milestone $i.milestone
  $labelArgs = @()
  foreach ($lb in $i.labels) { $labelArgs += @("--label", $lb) }
  gh issue create --repo $Repo --title "[$($i.code)] $($i.title)" --body $i.body --milestone "$ms" @labelArgs 1>$null
}

Write-Host "✅ 已在 $Repo 建立標籤、里程碑與 30 個 Issue。"
