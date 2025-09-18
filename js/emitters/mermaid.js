// mermaid.js
// IR → Mermaid（架構/流程）
export function emitMermaid(_ir) {
  // ...IR 轉 Mermaid 流程略...
  // mark _ir as used to avoid lint unused-var warnings
  void _ir;
  return 'flowchart TD\nA-->B';
}
/* eslint-disable no-unused-vars */
