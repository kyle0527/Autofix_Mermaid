# Autofix Mermaid 版本管理指南

## 📁 專案結構概述

```
C:\D\Autofix_Mermaid\              # 主專案目錄（穩定不變）
├── VERSION_MANAGEMENT_GUIDE.md    # 本指南文件
├── autofix_mermaidV3.3\          # 當前版本目錄
│   ├── .git\                     # Git 儲存庫
│   ├── index.html               # 主要檔案
│   ├── js/                      # JavaScript 檔案
│   ├── css/                     # 樣式檔案
│   ├── engine-src/              # 引擎原始碼
│   └── ...                      # 其他專案檔案
└── autofix_mermaidV3.4\          # 未來版本目錄（計劃中）
```

## 🎯 版本管理策略優勢

### ✅ 優點
1. **主目錄穩定性** - `Autofix_Mermaid` 名稱永不改變
2. **版本隔離** - 每個版本獨立存在，互不干擾
3. **向前兼容** - 可同時維護多個版本
4. **清晰識別** - 從目錄名直接看出版本號
5. **Git 標籤追蹤** - 使用標籤系統管理版本歷史

### ⚠️ 注意事項
1. **避免版本混淆** - 確保在正確的版本目錄中工作
2. **統一命名規則** - 嚴格遵循 `autofix_mermaidVx.x` 格式
3. **文件同步** - 重要文檔需要在各版本間同步更新
4. **磁碟空間** - 多版本會占用更多空間

### 🚨 **重要發現：GitHub儲存庫共用的問題**

**2025-09-11 實戰經驗總結：**

#### 🔴 **當前方式的缺點**
1. **版本混淆風險** - 兩個本地目錄指向同一個GitHub儲存庫
2. **Git歷史污染** - V3.3目錄包含V3.4的提交歷史
3. **開發工作流程混亂** - 在V3.3目錄的修改會影響main分支（V3.4）
4. **磁碟空間浪費** - 重複的.git目錄和檔案

#### ✅ **改進後的最佳實務**
1. **主要開發線** - GitHub main分支專注最新版本（V3.4+）
2. **標籤管理** - 使用Git標籤存取歷史版本（v3.3, v3.4等）
3. **Fork策略** - 需要特殊版本時才Fork新儲存庫
4. **簡化優先** - 避免過度複雜化，專注主要開發

## 🚀 新版本發布流程

### 🎯 **最佳實務流程（2025-09-11驗證）**

**核心原則**：複製→改名→上推→開始開發

#### **步驟詳解**

##### 步驟 1: 複製當前穩定版本
```powershell
# 在主目錄中執行
C:\D\Autofix_Mermaid> xcopy autofix_mermaidV3.3 autofix_mermaidV3.4 /E /I
```

##### 步驟 2: 進入新版本目錄
```powershell
C:\D\Autofix_Mermaid> cd autofix_mermaidV3.4
```

##### 步驟 3: 更新版本文件
```powershell
# 建立新版本的更新日誌
echo "# AutoFix Mermaid V3.4 變更紀錄..." > CHANGELOG-V3.4-2025-09-11.md

# 備份舊版本文檔
copy CHANGELOG-2025-09-11.md CHANGELOG-V3.3-backup.md
```

##### 步驟 4: 提交新版本（重要：先上推再開發）
```powershell
# 新增所有檔案
git add .

# 提交版本升級
git commit -m "Release V3.4: Version upgrade with enhanced documentation

- Created V3.4 specific changelog
- Maintained all V3.3 functionality and improvements  
- Enhanced version management system"

# 推送到GitHub
git push origin main
```

##### 步驟 5: 建立版本標籤
```powershell
# 建立當前版本標籤
git tag -a v3.4 -m "Autofix Mermaid V3.4 Release"
git push origin v3.4

# 追溯建立前版本標籤（一次性操作）
git tag -a v3.3 1d9a6a2 -m "Autofix Mermaid V3.3 Release - Original version"  
git push origin v3.3
```

##### 步驟 6: 開始新功能開發
```powershell
# 現在可以安全地進行新功能開發
# 所有修改都會在V3.4版本中，不會影響V3.3歷史
```

### 🧠 **版本管理哲學與最佳實務**

#### **核心理念：簡化優於複雜化**

**2025-09-11 深度討論成果：**

##### 🎯 **版本演進邏輯**
```
V3.3 (穩定版) → V3.4 (新版本) → V3.5 (未來版本)
     ↓              ↓              ↓
  停止開發       主要開發線      規劃階段
 (維護模式)     (活躍開發)     (需求分析)
```

##### 🤔 **關鍵問題：為什麼還要修改舊版本？**

**實際情況分析：**
- ✅ **正常情況**：版本升級後，舊版本進入維護模式
- ✅ **用戶選擇**：保守用戶繼續使用V3.3，進步用戶升級V3.4
- ⚠️ **特殊情況**：只在以下情況修改舊版本
  - 嚴重安全漏洞修復
  - 長期支援版本 (LTS) 維護  
  - 企業客戶關鍵修復需求

##### 🎯 **Fork策略：按需建立特殊版本**

**何時使用Fork？**
```
主儲存庫：
https://github.com/kyle0527/Autofix_Mermaid (專注最新版開發)

特殊版本Fork（按需建立）：
├── Autofix_Mermaid_V3.3_Backup     # 備份保存
├── Autofix_Mermaid_Lite            # 精簡版
├── Autofix_Mermaid_Pro             # 專業版
├── Autofix_Mermaid_Enterprise      # 企業客製版
└── Autofix_Mermaid_Experimental    # 實驗性功能
```

**Fork的優勢：**
- ✅ **完全獨立** - 不會互相污染
- ✅ **明確目標** - 每個Fork有特定用途
- ✅ **團隊協作** - 可以分配不同開發團隊
- ✅ **版本清晰** - 用戶可以明確選擇需要的版本

##### 💡 **簡化版本管理建議**

**推薦的精簡結構：**
```
C:\D\Autofix_Mermaid\
├── VERSION_MANAGEMENT_GUIDE.md    # 版本管理指南
└── autofix_mermaid\              # 單一目錄，專注最新版
    ├── .git\                     # 單一Git儲存庫
    └── [專案檔案...]             # 當前開發版本檔案
```

**好處：**
- 🎯 **專注開發** - 不被多版本分散注意力
- 🎯 **避免混淆** - 單一工作目錄，清晰明確
- 🎯 **按需複雜化** - 需要特殊版本時才Fork
- 🎯 **維護簡單** - 減少管理負擔

### 方案 A：向上推送（經典流程）
```

### 方案 B：分支管理（進階）
```powershell
# 在當前版本目錄中建立新分支
git checkout -b release/v3.4
git push -u origin release/v3.4

# 或使用標籤
git tag -a v3.3 -m "Version 3.3 release"
git push origin v3.3
```

## 📋 日常開發工作流程

### 1. 確認工作目錄
```powershell
# 確保在正確的版本目錄中
pwd
# 應該顯示：C:\D\Autofix_Mermaid\autofix_mermaidV3.x
```

### 2. 檢查 Git 狀態
```powershell
git status
git branch
```

### 3. 提交變更
```powershell
git add .
git commit -m "描述性提交訊息"
git push
```

### 4. 版本更新檢查清單
- [ ] 更新 `CHANGELOG-YYYY-MM-DD.md`
- [ ] 更新版本號相關檔案
- [ ] 測試所有核心功能
- [ ] 檢查相依性和套件版本
- [ ] 更新文檔和 README
- [ ] 執行完整測試

## 🔧 VS Code 設定建議

### 工作區設定
1. **開啟正確的根目錄**：
   - 開啟 `C:\D\Autofix_Mermaid\autofix_mermaidV3.x` 作為工作區
   - 這樣 Git 功能才能正常運作

2. **多版本開發**：
   - 可同時開啟多個 VS Code 視窗
   - 每個視窗對應一個版本目錄

3. **推薦的工作區結構**：
```
.vscode/
├── settings.json        # 工作區設定
├── launch.json         # 偵錯設定
├── tasks.json          # 建置任務
└── extensions.json     # 推薦插件清單
```

### 建議的 .gitignore 設定
```gitignore
# 編譯輸出
dist/
build/
engine-src/packages/*/dist/
*.js.map

# 依賴套件
node_modules/

# TypeScript 快取
*.tsbuildinfo

# 系統檔案
.DS_Store
Thumbs.db

# IDE 設定（可選保留）
.vscode/settings.json
.idea/

# 測試覆蓋率報告
coverage/

# 日誌檔案
*.log
npm-debug.log*
yarn-debug.log*

# 環境變數
.env
.env.local

# 暫存檔案
*.tmp
*.temp

# 作業系統產生的檔案
*~
.DS_Store?
ehthumbs.db
Thumbs.db
```

### 建議的任務設定 (.vscode/tasks.json)
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build TypeScript Engine",
      "type": "shell",
      "command": "npm",
      "args": ["run", "build"],
      "options": {
        "cwd": "${workspaceFolder}/engine-src"
      },
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      }
    },
    {
      "label": "Start Live Server",
      "type": "shell",
      "command": "live-server",
      "args": ["--port=3000", "--open=/index.html"],
      "options": {
        "cwd": "${workspaceFolder}"
      },
      "group": "test",
      "isBackground": true
    },
    {
      "label": "Clean Build",
      "type": "shell",
      "command": "rimraf",
      "args": ["dist", "packages/*/dist"],
      "options": {
        "cwd": "${workspaceFolder}/engine-src"
      },
      "group": "build"
    }
  ]
}
```

## 🗂️ 檔案組織最佳實務

### 必須同步的檔案
- `VERSION_MANAGEMENT_GUIDE.md` （本檔案）
- `README.md`
- 授權文件
- 設定檔案範本

### 版本特定檔案
- `CHANGELOG-YYYY-MM-DD.md`
- 編譯輸出檔案
- 版本特定的設定

## �️ Windows 環境設定指南

### 必要軟體安裝

#### 1. Node.js 環境
```powershell
# 1. 安裝 Node.js (推薦 LTS 版本)
# 下載：https://nodejs.org/
# 或使用 Chocolatey
choco install nodejs

# 2. 驗證安裝
node --version
npm --version
```

#### 2. TypeScript 編譯環境
```powershell
# 全域安裝 TypeScript
npm install -g typescript

# 驗證安裝
tsc --version
```

#### 3. Python 環境 (用於程式碼分析)
```powershell
# 1. 安裝 Python 3.8+
# 下載：https://www.python.org/downloads/
# 或使用 Chocolatey
choco install python

# 2. 驗證安裝
python --version
pip --version
```

#### 4. Git 版本控制
```powershell
# 1. 安裝 Git for Windows
# 下載：https://git-scm.com/download/win
# 或使用 Chocolatey
choco install git

# 2. 設定 Git 使用者資訊
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### VS Code 必要插件

#### 🎯 必裝插件
1. **TypeScript Hero** (`rbbit.typescript-hero`)
   - TypeScript 程式碼重構和自動導入

2. **ESLint** (`dbaeumer.vscode-eslint`)
   - JavaScript/TypeScript 程式碼檢查

3. **Prettier** (`esbenp.prettier-vscode`)
   - 程式碼格式化

4. **GitLens** (`eamodio.gitlens`)
   - 增強 Git 功能顯示

5. **Auto Rename Tag** (`formulahendry.auto-rename-tag`)
   - HTML 標籤自動重新命名

6. **Python** (`ms-python.python`)
   - Python 程式碼支援和偵錯

7. **Mermaid Preview** (`vstirbu.vscode-mermaid-preview`)
   - Mermaid 圖表預覽

#### 🔧 建議插件
8. **Live Server** (`ritwickdey.liveserver`)
   - 本地開發伺服器

9. **Bracket Pair Colorizer** (`coenraads.bracket-pair-colorizer`)
   - 括號配對著色

10. **Path Intellisense** (`christian-kohler.path-intellisense`)
    - 路徑自動完成

11. **HTML CSS Support** (`ecmel.vscode-html-css`)
    - HTML 中的 CSS 支援

#### 🚀 進階插件
12. **REST Client** (`humao.rest-client`)
    - API 測試

13. **Thunder Client** (`rangav.vscode-thunder-client`)
    - 輕量級 API 測試

### 插件安裝命令

```powershell
# 批次安裝所有必要插件
code --install-extension rbbit.typescript-hero
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension eamodio.gitlens
code --install-extension formulahendry.auto-rename-tag
code --install-extension ms-python.python
code --install-extension vstirbu.vscode-mermaid-preview
code --install-extension ritwickdey.liveserver
code --install-extension christian-kohler.path-intellisense
code --install-extension ecmel.vscode-html-css
```

### 專案相依性安裝

#### TypeScript 專案設定
```powershell
# 進入引擎原始碼目錄
cd "C:\D\Autofix_Mermaid\autofix_mermaidV3.3\engine-src"

# 安裝相依套件
npm install

# 安裝額外的 Python 解析相依套件 (可選)
npm install tree-sitter tree-sitter-python

# 編譯 TypeScript 專案
npm run build
```

#### 開發伺服器設定
```powershell
# 安裝全域開發工具
npm install -g live-server
npm install -g http-server

# 啟動本地開發伺服器
cd "C:\D\Autofix_Mermaid\autofix_mermaidV3.3"
live-server --port=3000
# 或
http-server -p 3000
```

### VS Code 設定檔配置

#### 工作區設定 (.vscode/settings.json)
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "eslint.workingDirectories": ["engine-src"],
  "python.defaultInterpreterPath": "python",
  "files.associations": {
    "*.mmd": "mermaid",
    "*.mermaid": "mermaid"
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  },
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

#### 偵錯設定 (.vscode/launch.json)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Chrome",
      "request": "launch",
      "type": "chrome",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    },
    {
      "name": "Python: Current File",
      "type": "python",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal"
    }
  ]
}
```

### 環境驗證檢查清單

#### ✅ 基本環境檢查
```powershell
# 檢查所有必要工具
node --version          # >= 14.0.0
npm --version          # >= 6.0.0
python --version       # >= 3.8.0
git --version          # >= 2.20.0
tsc --version          # >= 4.0.0
code --version         # 最新版本
```

#### ✅ 專案檔案檢查
- [ ] `package.json` 存在於 `engine-src/` 目錄
- [ ] `tsconfig.base.json` 配置正確
- [ ] `mermaid.min.js` 存在於 `js/vendor/` 目錄
- [ ] `index.html` 可以正常開啟
- [ ] Git 儲存庫初始化完成

#### ✅ 功能測試
```powershell
# 測試 TypeScript 編譯
cd engine-src
npm run build

# 測試網頁伺服器
live-server --port=3000

# 測試 Mermaid 渲染
# 開啟 http://localhost:3000 並測試功能
```

## �🚨 常見問題與解決方案

### Q1: Git 顯示錯誤的目錄
**問題**：在根目錄執行 Git 命令出現 "not a git repository"
**解決**：確保在有 `.git` 資料夾的版本目錄中執行命令

### Q2: VS Code 無法顯示 Git 狀態
**問題**：左下角沒有 Git 分支資訊
**解決**：檢查是否開啟了正確的版本目錄作為工作區根目錄

### Q3: TypeScript 編譯錯誤
**問題**：`tsc` 命令無法找到或編譯失敗
**解決**：
```powershell
# 確認 TypeScript 安裝
npm install -g typescript

# 檢查 tsconfig.json 配置
cd engine-src
tsc --showConfig
```

### Q4: Mermaid 無法載入
**問題**：網頁顯示 "Mermaid library not loaded" 錯誤
**解決**：
1. 檢查 `js/vendor/mermaid.min.js` 檔案是否存在
2. 確認網路路徑正確
3. 使用開發者工具檢查控制台錯誤

### Q5: Python 解析器無法運作
**問題**：程式碼分析功能失效
**解決**：
```powershell
cd engine-src
npm install tree-sitter tree-sitter-python
npm run build
```

### Q6: 本地伺服器無法啟動
**問題**：`live-server` 或 `http-server` 無法執行
**解決**：
```powershell
# 重新安裝開發伺服器
npm uninstall -g live-server
npm install -g live-server

# 或使用 Python 內建伺服器
python -m http.server 3000
```

### Q7: VS Code 插件無法正常運作
**問題**：已安裝插件但功能異常
**解決**：
1. 重新載入 VS Code 視窗 (`Ctrl+Shift+P` → "Reload Window")
2. 檢查插件是否在當前工作區啟用
3. 查看輸出面板的錯誤訊息
4. 重新安裝問題插件

### Q8: 版本間檔案混淆
**問題**：不確定在哪個版本中修改檔案
**解決**：
1. 檢查終端機的當前目錄 (`pwd`)
2. 檢查 VS Code 視窗標題
3. 使用 `git remote -v` 確認遠端儲存庫

### Q9: 多版本 Git 衝突
**問題**：不同版本的 Git 操作互相干擾
**解決**：每個版本使用獨立的 Git 儲存庫，避免共用遠端分支

## 📞 技術支援

### 緊急情況處理
1. **備份當前工作**：定期備份整個專案目錄
2. **版本復原**：從 Git 歷史或備份復原
3. **文檔參考**：參考本指南和 Git 官方文檔

### 聯絡資訊
- GitHub: https://github.com/kyle0527/Autofix_Mermaid
- 專案維護者: kyle0527

## 🏗️ 專案架構分析

### 技術棧概覽
- **前端**: HTML5, CSS3, ES6+ JavaScript (模組化)
- **後端引擎**: TypeScript (Monorepo 架構)
- **圖表渲染**: Mermaid.js v11.10.0
- **程式分析**: Python AST 解析 + Tree-sitter (可選)
- **建置工具**: TypeScript Compiler, npm workspaces

### 目錄結構說明
```
autofix_mermaidV3.3/
├── index.html              # 主要網頁介面
├── css/styles.css          # 樣式檔案
├── js/                     # 前端 JavaScript
│   ├── main.js            # 主要入口點 (ES6 模組)
│   ├── Renderer.js        # Mermaid 渲染器
│   ├── UI.js              # 使用者介面控制
│   ├── engine.js          # 核心引擎邏輯
│   ├── worker.js          # Web Worker 背景處理
│   ├── worker-clean.js    # 清理版 Worker
│   ├── UI-clean.js        # 清理版 UI
│   └── vendor/
│       └── mermaid.min.js # Mermaid 圖表庫
├── engine-src/            # TypeScript 引擎原始碼
│   ├── package.json       # 根套件配置 (workspaces)
│   ├── tsconfig.base.json # 基礎 TypeScript 配置
│   └── packages/          # 模組化套件
│       ├── types/         # 型別定義
│       ├── core/          # 核心處理邏輯
│       ├── cli/           # 命令列介面
│       ├── parsers/       # 程式碼解析器
│       │   └── python/    # Python 程式碼解析
│       ├── analyzers/     # 程式碼分析器
│       ├── emitters/      # 圖表生成器
│       │   └── mermaid/   # Mermaid 格式輸出
│       ├── fix-rules/     # 自動修正規則
│       │   └── mermaid-compat/ # Mermaid 相容性修正
│       └── renderer/      # 渲染引擎
│           └── web/       # Web 渲染器
└── samples/               # 範例檔案
    └── python-demo/       # Python 程式碼範例
```

### 核心功能模組

#### 1. 程式碼解析 (Parser)
- **Python AST 解析**: 分析 Python 原始碼結構
- **Tree-sitter 支援**: 更精確的語法分析 (可選)
- **多檔案專案處理**: 支援整個專案目錄分析

#### 2. 程式分析 (Analyzer) 
- **控制流程圖 (CFG)**: 分析程式執行流程
- **呼叫圖 (Call Graph)**: 分析函數間的呼叫關係
- **類別關係分析**: 分析物件導向程式結構

#### 3. 圖表生成 (Emitter)
- **流程圖 (Flowchart)**: 程式邏輯流程視覺化
- **類別圖 (Class Diagram)**: 物件導向結構圖
- **時序圖 (Sequence Diagram)**: 互動流程圖

#### 4. 自動修正 (Fix Rules)
- **Mermaid 語法修正**: 確保輸出符合 Mermaid 規範
- **標籤轉義**: 處理特殊字元和符號
- **節點 ID 唯一性**: 避免重複 ID 衝突
- **參與者自動加入**: 時序圖自動補充參與者

### 開發工作流程

#### 本地開發
```powershell
# 1. 啟動 TypeScript 編譯監視
cd engine-src
npm run build

# 2. 啟動本地伺服器 
cd ..
live-server --port=3000

# 3. 開啟瀏覽器測試
# http://localhost:3000
```

#### 生產建置
```powershell
# 編譯 TypeScript 引擎
cd engine-src
npm run build

# 檢查輸出檔案
ls packages/*/dist/
```

### 整合測試檢查清單

#### ✅ 前端功能測試
- [ ] 網頁正常載入 (index.html)
- [ ] Mermaid 圖表渲染正常
- [ ] 檔案上傳功能正常
- [ ] 即時渲染功能正常
- [ ] PNG 匯出功能正常

#### ✅ 後端引擎測試
- [ ] TypeScript 編譯無錯誤
- [ ] Python 程式碼解析正常
- [ ] 圖表生成功能正常
- [ ] 自動修正規則生效

#### ✅ 整合測試
- [ ] 前後端資料傳遞正常
- [ ] Worker 背景處理正常
- [ ] 錯誤處理機制有效
- [ ] 效能表現符合預期

---

## 🎓 **實戰經驗總結 (2025-09-11)**

### 🏆 **V3.3 → V3.4 升級實戰報告**

#### ✅ **成功執行的最佳實務**

**1. 複製→改名→上推→開發流程**
- ✅ **步驟**: `xcopy autofix_mermaidV3.3 autofix_mermaidV3.4 /E /I`
- ✅ **結果**: 成功建立獨立版本目錄
- ✅ **優點**: 保持原版本完整性，新版本可獨立開發

**2. 版本標籤管理**
- ✅ **當前版本標籤**: `git tag -a v3.4 -m "Release message"`
- ✅ **歷史版本標籤**: `git tag -a v3.3 1d9a6a2 -m "Original version"`
- ✅ **結果**: GitHub上可以清楚存取各版本歷史

**3. 文檔版本化**
- ✅ **專屬更新日誌**: `CHANGELOG-V3.4-2025-09-11.md`
- ✅ **歷史備份**: `CHANGELOG-V3.3-backup.md`
- ✅ **版本追蹤**: 每個版本都有清晰的變更記錄

#### 🔍 **發現的重要問題**

**1. GitHub儲存庫共用問題**
- ⚠️ **問題**: 兩個本地目錄指向同一遠端儲存庫
- ⚠️ **影響**: V3.3目錄包含V3.4的Git歷史
- ✅ **解決**: 理解這是正常現象，使用標籤存取歷史版本

**2. 版本管理哲學認知**
- � **關鍵洞察**: "已經V3.4了，為什麼還要修改V3.3？"
- 💡 **實務結論**: 專注最新版本開發，舊版本進入維護模式
- 💡 **特殊需求**: 用Fork處理特殊版本需求

#### 📋 **驗證的版本存取方式**

| 存取方式 | 位置 | 用途 | 狀態 |
|---------|------|------|------|
| **本地V3.3目錄** | `C:\D\Autofix_Mermaid\autofix_mermaidV3.3\` | 本地開發/參考 | ✅ 可用 |
| **本地V3.4目錄** | `C:\D\Autofix_Mermaid\autofix_mermaidV3.4\` | 主要開發 | ✅ 活躍 |
| **GitHub V3.3標籤** | `https://github.com/kyle0527/Autofix_Mermaid/tree/v3.3` | 歷史版本存取 | ✅ 可用 |
| **GitHub V3.4標籤** | `https://github.com/kyle0527/Autofix_Mermaid/tree/v3.4` | 當前版本存取 | ✅ 可用 |
| **GitHub main分支** | `https://github.com/kyle0527/Autofix_Mermaid` | 最新開發版本 | ✅ 同步V3.4 |

#### 🎯 **最終建議與最佳實務**

**1. 新版本開發流程**
```powershell
# 標準流程：複製→改名→上推→開發
xcopy autofix_mermaidVX.X autofix_mermaidVX.Y /E /I
cd autofix_mermaidVX.Y
# 更新版本文檔
git add . && git commit -m "Release VX.Y: Version upgrade"
git push origin main
git tag -a vX.Y -m "Version X.Y release" && git push origin vX.Y
# 現在開始新功能開發
```

**2. 版本管理策略**
- 🎯 **主要開發** - 專注最新版本
- 🎯 **歷史保存** - 使用Git標籤
- 🎯 **特殊需求** - 按需Fork新儲存庫
- 🎯 **簡化優先** - 避免過度複雜化

**3. 實用主義原則**
- ✅ **解決實際問題** - 不為複雜而複雜
- ✅ **向前發展** - 專注新版本功能
- ✅ **按需擴展** - 需要時才增加複雜性
- ✅ **清晰管理** - 保持版本管理的直觀性

### 📊 **成功指標**

- ✅ **版本隔離**: V3.3和V3.4可獨立運作
- ✅ **Git管理**: 標籤系統成功建立
- ✅ **文檔完整**: 每版本都有專屬文檔
- ✅ **升級路徑**: 清晰的版本演進路線
- ✅ **實用性**: 符合實際開發需求

---

## �📝 更新日誌

- **2025-09-11**: 建立初始版本管理指南
- **V3.3**: 成功建立版本化目錄結構並推送至 GitHub  
- **2025-09-11**: 新增 Windows 環境設定指南和專案架構分析
- **2025-09-11**: 實戰V3.3→V3.4升級，驗證版本管理流程
- **2025-09-11**: 新增版本管理哲學與最佳實務章節
- **2025-09-11**: 整合實戰經驗總結與改進建議

---

**注意**: 本指南會隨著專案發展持續更新，請定期檢查最新版本。
