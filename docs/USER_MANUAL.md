# AutoFix Mermaid 使用者操作手冊

歡迎使用 AutoFix Mermaid！本手冊將引導您如何安裝、啟動並使用本工具的各項功能，包含最新的離線 PlantUML 支援。

## 1. 專案概觀
AutoFix Mermaid 是一個強大的圖表生成與修復工具，主要功能包括：
- **多語言分析**：支援 Python、JavaScript/TypeScript 程式碼分析。
- **Mermaid 修復**：自動修正 Mermaid 語法錯誤。
- **多種圖表支援**：Flowchart, Class Diagram, Sequence Diagram, PlantUML 等。
- **完全離線支援**：包含 Mermaid (瀏覽器內建) 與 PlantUML (本地伺服器)。

## 2. 安裝與啟動

### 前置需求
- Node.js (v18 或以上)
- (選用) Java 8+ (若需執行 PlantUML 本地 JAR)
- (選用) Docker (若需以容器執行 PlantUML)

### 首次安裝
在專案根目錄執行：
```bash
npm install
npm run build:engine
```

### 啟動應用程式
```bash
npm start
```
啟動後請開啟瀏覽器訪問 `http://localhost:8000` (或終端機顯示的連接埠)。

---

## 3. 使用 PlantUML 離線模式
本專案支援在無網際網路環境下渲染 PlantUML 圖表。請選擇以下任一種方式啟動本地伺服器：

### 方法 A：使用內建 JAR (推薦)
這是最簡單的方法，只需安裝 Java。

1.  開啟終端機，執行：
    ```bash
    npm run start:plantuml
    ```
2.  伺服器將啟動於 `http://localhost:8081`。

### 方法 B：使用 Docker
若不想安裝 Java，可使用 Docker。

1.  執行：
    ```bash
    docker-compose -f docker-compose.plantuml.yml up -d
    ```
2.  伺服器將啟動於 `http://localhost:8081`。

### 配置應用程式
1.  回到 AutoFix Mermaid 網頁介面。
2.  在上方工具列找到 **PlantUML Server** 輸入框。
3.  輸入 `http://localhost:8081`。
4.  現在您可以貼上 PlantUML 代碼 (如 `@startuml ... @enduml`) 進行渲染，無需連網。

---

## 4. 介面操作指南

### 主要工具列
- **引擎 (Engine)**: 切換 `Rules` (規則模式) 或 `AI` (實驗性 AI 模式)。
- **AI Provider**: 若使用 AI 模式，可選擇 `Ollama` (本地 LLM) 或 `None`。
- **語言**: 切換介面語言 (支援 繁體中文 / English)。
- **除錯 (Debug)**: 開啟除錯面板，查看詳細執行日誌。
- **規則 (Rules)**: 編輯 JSON 格式的修正規則。
- **配置 (Config)**: 設定 Mermaid 渲染參數 (如 Theme, Curve, Security Level)。

### 執行分析
1.  **輸入來源**:
    - **自動**: 自動偵測貼上的內容是程式碼還是 Mermaid/PlantUML。
    - **專案檔案**: 點擊「選擇檔案」上傳整個資料夾進行分析。
2.  **渲染**:
    - **直接渲染**: 不經過修正，直接嘗試渲染圖表。
    - **自動修正＋渲染**: 先執行語法檢查與修正，再渲染。
    - **即時渲染**: 勾選後，輸入變更時會自動觸發渲染。

### 匯出功能
圖表成功渲染後，右側匯出按鈕將啟用：
- **輸出圖片**: 支援 SVG 或 PNG (可選透明背景)。
- **匯出 MMD/SVG/PNG**: 各種格式的單檔匯出。
- **匯出 ZIP**: 將程式碼、圖表、日誌打包下載。

---

## 5. 檔案結構說明
為了讓專案更整潔，我們整理了文件結構：
- `docs/`: 核心文件 (Roadmap, User Manual 等)。
- `docs/reports/`: 歷史修復報告與技術筆記。
- `docs/legacy/`: 舊版文件歸檔。
- `assets/plantuml/`: 包含離線用的 `plantuml.jar`。
- `scripts/`: 包含啟動腳本 (`start-server.js`, `start-plantuml.js`)。

如有任何問題，請參考 `docs/reports/NOTE.md` 查看常見問題修復記錄。
