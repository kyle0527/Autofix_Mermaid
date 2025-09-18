/* js/engine/common.js */
// 可擴充的圖表偵測規則 (順序代表優先級)
const _diagramDetectors = [
  { type: 'sequenceDiagram', re: /^\s*sequenceDiagram/i },
  { type: 'classDiagram', re: /^\s*classDiagram/i },
  { type: 'stateDiagram', re: /^\s*stateDiagram/i },
  { type: 'erDiagram', re: /^\s*erDiagram/i },
  { type: 'pie', re: /^\s*pie\b/i },
  { type: 'gantt', re: /^\s*gantt\b/i },
  { type: 'timeline', re: /^\s*timeline\b/i },
  { type: 'block', re: /^\s*block(?:-| )?beta/i },
  // 修正原本 /flowchart|graph/ 的優先序問題，改成括號包裹整體 group
  { type: 'flowchart', re: /^(?:\s*flowchart\b|\s*graph\s+(TB|TD|LR|RL|BT)\b)/i }
];

function guessDiagramType(code = ''){
  const s = code.trimStart();
  for (const d of _diagramDetectors){
    if (d.re.test(s)) return d.type;
  }
  return 'unknown';
}

function applyRegexAll(code, re, repl){
  const R = new RegExp(re.source, re.flags.replace('g','')+'g');
  return code.replace(R, repl);
}

// 暴露 API（支援多環境：瀏覽器 self 和 Node.js globalThis）
const globalScope = (typeof self !== 'undefined') ? self : 
                   (typeof globalThis !== 'undefined') ? globalThis : 
                   (typeof global !== 'undefined') ? global : {};

globalScope.EngineCommon = {
  guessDiagramType,
  applyRegexAll,
  // 測試用途：可觀察已註冊偵測器
  _diagramDetectors
};

// ES6 模組匯出（供 Node.js import 使用）
export { guessDiagramType, applyRegexAll, _diagramDetectors };
