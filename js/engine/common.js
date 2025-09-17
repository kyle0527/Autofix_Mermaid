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

// 暴露 API（self 供瀏覽器環境）
self.EngineCommon = {
  guessDiagramType,
  applyRegexAll,
  // 測試用途：可觀察已註冊偵測器
  _diagramDetectors
};

export { guessDiagramType }; // 供 ESM / 單元測試導入
