# AI 插件架構（可抽換 / 可升降級）

- 核心版本：`AI_CORE_VERSION` 目前為 `1.0.0`
- 註冊點：Worker 內提供 `registerAIProvider(name, impl)` 與 `listAIProviders()`
- Provider 介面：
  - `name`: 供識別（註冊時由檔案決定）
  - `version`: 字串版本，如 `1.0.0`
  - `analyze(files, options) -> Promise<{ code, errors, log, dtype }>`

## 內建 Provider
- `none`：啟發式 fallback（無需外部服務）
- `ollama`：呼叫 `http://localhost:11434/api/generate`
- `webllm`：需在 Worker global 暴露 `self.webllm`

## 新增/升級 Provider 流程
1. 在 `js/ai/providers/` 新增檔案，例如 `myprovider.js`：
   ```js
   (function(scope){
     const impl = {
       version: '1.2.3',
       async analyze(files, options){
         // 產生 Mermaid 字串
         return { code: 'graph TD\nA-->B', errors: [], log: [], dtype: options.diagram || 'flowchart' };
       }
     };
     scope.registerAIProvider('myprovider', impl);
   })(self);
   ```
2. 於 `js/ai/aiEngine.js` 用下列方式載入：
   ```js
   try { importScripts('js/ai/providers/myprovider.js'); } catch (e) {}
   ```
   （若與既有名稱相同，即可達到降/升級覆蓋。）
3. 於頁面「AI Provider」選單選擇 `myprovider` 後即可使用。

## UI 使用
- 上方「引擎」下拉選擇：`Rules` / `AI`
- 選擇 `AI` 後，「AI Provider」選單即生效，UI 會把 `provider` 傳入 worker。

