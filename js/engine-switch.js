// engine-switch.js
// 模式切換介面定義（規則/AI 的統一呼叫）
export function switchEngine(mode, payload) {
  // mode: 'rules' | 'ai'
  // payload: { files, options }
  // 實際呼叫 worker 或 AI 路徑
  // ...實作略...
  return Promise.resolve({ status: 'stub', mode, payload });
}
