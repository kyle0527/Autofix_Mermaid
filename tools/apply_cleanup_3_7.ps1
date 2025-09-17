param(
  [switch]$DryRun  # 先用 -DryRun 預覽變更
)

# === 基本設定 ===
$Repo = Get-Location
$BranchTarget = 'release/3.7'
$ArchiveDir   = '__not_shipped__'
$NowVersion   = '3.7.0'
$OldVersions  = @('3.6.0')   # 如有其它舊字串, 可再加
$ErrorActionPreference = 'Stop'

Write-Host "Repo: $Repo" -ForegroundColor Cyan

# 0) 分支與工作樹檢查
git fetch --all --tags --prune | Out-Null
$cur = (git rev-parse --abbrev-ref HEAD).Trim()
if ($cur -ne $BranchTarget) {
  Write-Host "切換到 $BranchTarget ..." -ForegroundColor Yellow
  git checkout $BranchTarget | Out-Null
}
git pull --ff-only | Out-Null

# 1) 準備集中資料夾
$dirs = @(
  "$ArchiveDir",
  "$ArchiveDir/docs",
  "$ArchiveDir/data",
  "$ArchiveDir/patches",
  "$ArchiveDir/misc"
)
foreach ($d in $dirs) { if (!(Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null } }

# 2) 刪除 py2 腳本
$py2 = @('py2mermaid.py','py2mermaid_v2.py')
foreach ($f in $py2) {
  if (Test-Path $f) {
    if ($DryRun) { Write-Host "[DryRun] Remove $f" -ForegroundColor DarkYellow }
    else { Remove-Item $f -Force }
  }
}

# 3) 調整文件：若有舊文件或大型資料，集中到 __not_shipped__
$moveList = @(
  @('docs/archives','docs'),         # 整個資料夾
  @('patches','patches'),
  @('_backup_removed','misc'),
  @('issues.json','data'),
  @('issues_2020_07.json','data'),
  @('diagram_knowledge_pack.xlsx','data')
)
foreach ($pair in $moveList) {
  $src = $pair[0]; $dst = Join-Path $ArchiveDir $pair[1]
  if (Test-Path $src) {
    if ($DryRun) { Write-Host "[DryRun] Move $src -> $dst" -ForegroundColor DarkYellow }
    else { 
      if (Test-Path $dst) { } else { New-Item -ItemType Directory -Path $dst | Out-Null }
      # 資料夾或檔案皆處理
      if ((Get-Item $src).PSIsContainer) { robocopy $src $dst /E /MOVE | Out-Null }
      else { Move-Item $src $dst }
    }
  }
}

# 4) .gitattributes：定義發佈排除
$gitattrib = @"
__not_shipped__/**         export-ignore
assets/**/*.map             export-ignore
node_modules/**             export-ignore
.github/**                  export-ignore
"@
if ($DryRun) { Write-Host "[DryRun] Write .gitattributes with export-ignore rules" -ForegroundColor DarkYellow }
else { $gitattrib | Out-File -FilePath '.gitattributes' -Encoding UTF8 }

# 5) .gitignore：確保不追蹤 node_modules
$gitignorePath = '.gitignore'
$giAdd = @"
node_modules/
"@
if (Test-Path $gitignorePath) {
  $gi = Get-Content $gitignorePath -Raw
  if ($gi -notmatch 'node_modules/') {
    if ($DryRun) { Write-Host "[DryRun] Append node_modules/ to .gitignore" -ForegroundColor DarkYellow }
    else { Add-Content $gitignorePath $giAdd }
  }
} else {
  if ($DryRun) { Write-Host "[DryRun] Create .gitignore" -ForegroundColor DarkYellow }
  else { $giAdd | Out-File $gitignorePath -Encoding UTF8 }
}

# 6) package.json 版本提升
if (Test-Path 'package.json') {
  $pkg = Get-Content 'package.json' -Raw | ConvertFrom-Json
  $pkg.version = $NowVersion
  $json = $pkg | ConvertTo-Json -Depth 100
  if ($DryRun) { Write-Host "[DryRun] Set package.json version -> $NowVersion" -ForegroundColor DarkYellow }
  else { $json | Out-File 'package.json' -Encoding UTF8 }
}

# 7) 全倉版本字串替換（排除 .git / node_modules / __not_shipped__）
$includeExt = @('*.md','*.yml','*.yaml','*.json','*.html','*.css','*.js','*.ts')
$excludes = @('\.git\\','node_modules\\',"${ArchiveDir}\\")
$files = Get-ChildItem -Recurse -File -Include $includeExt | Where-Object {
  ($_.FullName -notmatch $excludes[0]) -and
  ($_.FullName -notmatch $excludes[1]) -and
  ($_.FullName -notmatch $excludes[2])
}
foreach ($old in $OldVersions) {
  foreach ($f in $files) {
    $txt = Get-Content $f.FullName -Raw
    if ($txt -match [regex]::Escape($old)) {
      if ($DryRun) { Write-Host "[DryRun] Replace $old -> $NowVersion in $($f.FullName)" -ForegroundColor DarkYellow }
      else { ($txt -replace [regex]::Escape($old), $NowVersion) | Out-File $f.FullName -Encoding UTF8 }
    }
  }
}

# 8) 檢查是否仍有 py2mermaid 參考（排除 not_shipped 和 .git / node_modules）
$ref = Get-ChildItem -Recurse -File | Where-Object {
  ($_.FullName -notmatch $excludes[0]) -and
  ($_.FullName -notmatch $excludes[1]) -and
  ($_.FullName -notmatch $excludes[2])
} | Select-String -Pattern 'py2mermaid' -SimpleMatch
if ($ref) {
  Write-Host "仍有 py2mermaid 參考，請人工檢整（清單如下）：" -ForegroundColor Red
  $ref | ForEach-Object { Write-Host (" - " + $_.Path + " : " + $_.Line) }
  if (-not $DryRun) { Write-Host "中止提交，請先移除上述參考後重跑腳本。" -ForegroundColor Red; exit 1 }
}

# 9) npm 驗證（可選）
if (-not $DryRun) {
  try {
    npm ci
    npm run lint --if-present
    # e2e 如需：npx playwright install; npm test --if-present
  } catch {
    Write-Host "npm 驗證出錯：$($_.Exception.Message)" -ForegroundColor Yellow
  }
}

# 10) 產出提交
git add -A
if ($DryRun) {
  Write-Host "[DryRun] 將會提交訊息：" -ForegroundColor DarkYellow
  Write-Host "release(3.7): remove py2 scripts, centralize non-runtime into __not_shipped__, add export-ignore, bump to $NowVersion" -ForegroundColor DarkYellow
} else {
  git commit -m "release(3.7): remove py2 scripts, centralize non-runtime into __not_shipped__, add export-ignore, bump to $NowVersion"
}

Write-Host "完成（$($DryRun ? '預覽' : '已寫入')）。" -ForegroundColor Green
