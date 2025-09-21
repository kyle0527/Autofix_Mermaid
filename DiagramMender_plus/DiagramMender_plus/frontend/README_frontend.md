# DiagramMender 前端（安全模式 / 漸進增強）

## 目標
- 首屏 **不依賴 JS** 就能看見內容（最差顯示 mermaid 原始碼）
- 大型套件（Mermaid）**動態載入**，逾時/失敗不阻塞
- **全域錯誤守衛**與**快取自救**（白屏→可診斷）
- **Service Worker** 先不啟用；待穩定後可用 `sw-register.js` 開啟（已提供版本化流程）

## 結構
```
frontend/
  index.html
  app.js
  error-guard.js
  sw-register.js   # 預設不啟用
  sw.js            # 最小安全 SW（網路優先）
  vendor/
    mermaid.esm.min.mjs # 離線 stub（顯示原始碼於 SVG 內）
```

## 使用
**建議用靜態伺服器開啟：**
```bash
cd DiagramMender_plus/DiagramMender_plus/frontend
python -m http.server 8080
# 打開 http://localhost:8080/
```

- 想要真正渲染 Mermaid：請把 `vendor/mermaid.esm.min.mjs` 換成官方檔案（版本 11+）。
- 若要啟用 SW：在 `index.html` 取消註解 `<script src="./sw-register.js" type="module"></script>`，並在 `sw-register.js` 內更新 `SW_VERSION`（每次部署必須變更）。
