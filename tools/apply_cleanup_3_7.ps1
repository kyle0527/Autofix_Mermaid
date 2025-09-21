param(
  [string]$TargetBranch = 'release/3.7',
  [string]$ReleaseZip   = 'release-3.7.zip'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Err ($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

# 0) 基本檢查與切分支
git rev-parse --is-inside-work-tree | Out-Null
git fetch --all --tags --prune | Out-Null

$cur = (git rev-parse --abbrev-ref HEAD).Trim()
if ($cur -ne $TargetBranch) {
  Warn "Switching to $TargetBranch ..."
  git checkout $TargetBranch | Out-Null
}
git pull --ff-only | Out-Null

# 1) 清掉殘留的 py2mermaid 文字參考（不動 __not_shipped__ / .git / node_modules）
$excludeRegexes = @('\.git\\','node_modules\\','__not_shipped__\\')

# 1.1 run_v3_then_combine.py：更新註解敘述（若存在）
if (Test-Path '.\run_v3_then_combine.py') {
  $txt = Get-Content .\run_v3_then_combine.py -Raw
  $txt = $txt -replace 'Step 1: run py2mermaid[_\w\d\-]*.*','Step 1: run the built-in parser/engine to generate MD/HTML'
  $txt | Set-Content -Encoding UTF8 .\run_v3_then_combine.py
  Info "Updated comment in run_v3_then_combine.py"
}

# 1.2 js/prompt.txt：刪除任何含 py2mermaid 的行（若存在）
if (Test-Path '.\js\prompt.txt') {
  $p = Get-Content .\js\prompt.txt -Raw
  $p2 = ($p -replace '(?im)^.*py2mermaid.*$\r?\n?','')
  $p2 | Set-Content -Encoding UTF8 .\js\prompt.txt
  Info "Purged py2mermaid lines in js/prompt.txt"
}

# 1.3 二次掃描殘留字樣
$scanFiles = Get-ChildItem -Recurse -File | Where-Object {
  ($_.FullName -notmatch $excludeRegexes[0]) -and
  ($_.FullName -notmatch $excludeRegexes[1]) -and
  ($_.FullName -notmatch $excludeRegexes[2])
}
$refs = $scanFiles | Select-String -SimpleMatch 'py2mermaid'
if ($refs) {
  Err "Residual 'py2mermaid' references still found. Please fix manually and re-run:"
  $refs | ForEach-Object { Write-Host (" - " + $_.Path + " : " + $_.Line) }
  exit 1
}

# 2) 行尾規則（可穩定 CRLF/LF 警告）：若沒有則補上
$gitattribPath = '.gitattributes'
$needEol = $true
if (Test-Path $gitattribPath) {
  $ga = Get-Content $gitattribPath -Raw
  if ($ga -match '\* *text=auto') { $needEol = $false }
}
if ($needEol) {
  $append = @"
*               text=auto
*.sh            eol=lf
*.js            eol=lf
*.ts            eol=lf
*.css           eol=lf
*.html          eol=lf
*.md            eol=lf
"@
  Add-Content $gitattribPath $append
  Info "Appended EOL normalization rules to .gitattributes"
}

# 3) 顯示將要提交的變更摘要
git status
git diff --stat

# 4) 提交並推送
git add -A
$hasChanges = (git diff --cached --name-only) -ne $null
if (-not $hasChanges) {
  Warn "No staged changes. Nothing to commit."
} else {
  git commit -m "chore(3.7): purge residual py2mermaid refs; normalize line-endings rules"
  Info "Committed."
}
git push -u origin $TargetBranch
Info "Pushed to origin/$TargetBranch"

# 5) 用 .gitattributes export-ignore 產生發佈包（不帶 __not_shipped__/ *.map / node_modules）
if (Test-Path $ReleaseZip) { Remove-Item $ReleaseZip -Force }
git archive -o $ReleaseZip HEAD
Info "Release zip created: $ReleaseZip"

# 6) 快速驗證：zip 內容不得含 __not_shipped__ / *.map / node_modules
$tempCheck = Join-Path $env:TEMP ('release_check_' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempCheck | Out-Null
try {
  # Windows 有 tar；或用 Expand-Archive（但 git archive 產的是 tar-like zip，這裡用 tar）
  tar -xf $ReleaseZip -C $tempCheck

  $bad1 = Get-ChildItem -Recurse "$tempCheck\__not_shipped__" -ErrorAction SilentlyContinue
  $bad2 = Get-ChildItem -Recurse $tempCheck | Where-Object { $_.FullName -match '\\assets\\.*\.map$' }
  $bad3 = Get-ChildItem -Recurse "$tempCheck\node_modules" -ErrorAction SilentlyContinue

  if ($bad1 -or $bad2 -or $bad3) {
    Err "Validation failed: release zip still contains excluded content."
    if ($bad1) { Err " - __not_shipped__ present" }
    if ($bad2) { Err " - *.map present under assets/" }
    if ($bad3) { Err " - node_modules present" }
    exit 1
  } else {
    Info "Validation OK: release zip has no __not_shipped__/ *.map / node_modules."
  }
}
finally {
  Remove-Item $tempCheck -Recurse -Force
}

Info "All done."

