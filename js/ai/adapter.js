// adapter.js
// LLM 介面（可指向本地/雲端）
export function callLLM(prompt, options) {
  // ...呼叫 LLM 流程略...
  return Promise.resolve({ result: 'stub', prompt, options });
}
