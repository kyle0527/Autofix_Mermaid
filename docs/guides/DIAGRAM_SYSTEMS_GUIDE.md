# 雙圖表系統分析與操作指南

本文件旨在確認與分析 AutoFix Mermaid 專案中現存的兩套圖表繪製系統：**Mermaid** 與 **PlantUML**，並提供完整的操作指南。

## 1. 系統現況分析

經過程式碼庫的檢視，確認本專案目前支援兩套獨立的圖表渲染機制。

### 1.1 Mermaid (主要系統)
*   **核心機制**: 使用客戶端 (Client-side) 的 JavaScript 函式庫 (`mermaid.min.js`) 直接在瀏覽器中渲染。
*   **完成度**: **高 (High)**
    *   **整合性**: 與專案的 AI 修正引擎深度整合，支援語法錯誤的自動修復。
    *   **離線能力**: 完全支援 (原生瀏覽器執行，無需網路)。
    *   **配置**: 提供豐富的設定面板，可調整主題 (Theme)、安全性 (Security Level) 與渲染參數。
*   **架構優勢**: 反應速度快，不依賴外部伺服器，隱私性高（資料不出網）。

### 1.2 PlantUML (次要系統)
*   **核心機制**: 採用伺服器端渲染 (Server-side Rendering)。前端透過 `plantuml-encoder` 將程式碼編碼為 URL，向 PlantUML 伺服器請求 SVG 圖片。
*   **完成度**: **中高 (Medium-High)**
    *   **整合性**: 支援自動偵測與基本渲染。
    *   **離線能力**: 需搭配本地伺服器使用 (專案內建支援)。
    *   **配置**: 可自訂伺服器位址 (Server URL)。
*   **架構特性**: 支援非常豐富的 UML 圖表類型，但預設依賴外部服務 (plantuml.com)，適合需要特定 UML 高階功能的場景。

---

## 2. 操作指南

### 2.1 自動偵測與切換
系統具備智慧偵測功能，使用者只需在輸入框貼上代碼，系統會依據關鍵字自動切換引擎：

*   **Mermaid**: 當代碼包含 `flowchart`, `sequenceDiagram`, `classDiagram` 等關鍵字時自動啟用。
*   **PlantUML**: 當代碼包含 `@startuml`, `@startmindmap` 等標籤時自動啟用。

> **手動切換**: 您也可以透過介面上的「輸入來源 (Source Mode)」強制指定為 `Mermaid` 或 `Auto`。

### 2.2 Mermaid 設定與操作
針對 Mermaid，您可以透過介面右上角的 **Config (配置)** 面板進行細部調整：

1.  **Security Level (安全性)**: 預設為 `strict`，若需使用 HTML 標籤可改為 `loose`。
2.  **Theme (主題)**: 支援 `default`, `forest`, `dark`, `neutral` 等多種風格。
3.  **Flowchart Curve**: 調整線條的彎曲程度 (如 `basis`, `linear`)。

### 2.3 PlantUML 設定與離線使用
預設情況下，PlantUML 會使用官方伺服器 (`https://www.plantuml.com/plantuml`) 進行渲染。

#### 設定伺服器位址
在主介面的工具列中，找到 **PlantUML Server** 輸入框：
*   預設值: `https://www.plantuml.com/plantuml`
*   若您有自建伺服器或公司內網伺服器，可直接修改此處 URL。

#### 離線模式 (Local Offline Mode)
若需在無網際網路環境使用 PlantUML，本專案內建了本地伺服器啟動腳本。

**方法 A: 使用內建 Node.js 腳本 (需安裝 Java)**
1.  開啟終端機 (Terminal)。
2.  執行指令：
    ```bash
    npm run start:plantuml
    ```
    *此指令會啟動內建的 `plantuml.jar`，預設監聽 8081 port。*
3.  回到網頁介面，將 **PlantUML Server** 修改為：
    ```
    http://localhost:8081
    ```

**方法 B: 使用 Docker**
1.  若您已安裝 Docker，可執行：
    ```bash
    docker-compose -f docker-compose.plantuml.yml up -d
    ```
2.  同樣將網頁介面的 **PlantUML Server** 修改為 `http://localhost:8081`。

### 2.4 匯出功能
無論使用哪種引擎，渲染完成後皆可使用右側的匯出工具：
*   **Export Image**: 下載 PNG 或 SVG 檔案。
*   **Export ZIP**: 打包原始碼與圖檔。

---

## 3. 常見問題排除

*   **PlantUML 圖片無法顯示**:
    *   檢查 **PlantUML Server** 網址是否正確。
    *   若使用 HTTPS 網站 (如 GitHub Pages) 訪問，但連線到 HTTP 的本地伺服器 (`http://localhost:8081`)，可能會被瀏覽器擋下 (Mixed Content)。建議在本地開發環境 (`http://localhost:8000`) 使用本地 PlantUML 伺服器。
*   **Mermaid 圖表破圖**:
    *   嘗試開啟 **Config** 面板，調整 `Security Level` 或 `Theme` 重新渲染。
