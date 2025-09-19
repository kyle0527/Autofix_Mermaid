/* js/engine/common.js */
// 可擴充的圖表偵測規則 (順序代表優先級)
// 建議：可以將偵測規則與說明分離，或考慮將規則配置抽出到單獨的設定檔，方便維護與擴充。
// 另外，若未來圖表類型增加，建議將 type 與 re 的對應關係文件化，便於自動化測試與文件生成。
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
function guessDiagramType(code = '') {
  const s = code.trimStart();
  for (const d of _diagramDetectors) {
    if (d.re.test(s)) return d.type;
  }
  return 'unknown';
}
function applyRegexAll(code, re, repl) {
  const R = new RegExp(re.source, re.flags.replace('g', '') + 'g');
  return code.replace(R, repl);
}

// 在不同執行環境 (瀏覽器 / WebWorker / Node) 下安全地掛載共用物件
const _g = (typeof globalThis !== 'undefined') ? globalThis : (typeof self !== 'undefined' ? self : {});
_g.EngineCommon = Object.assign(_g.EngineCommon || {}, {
  guessDiagramType,
  applyRegexAll,
  _diagramDetectors
});

export { guessDiagramType, applyRegexAll, _diagramDetectors };

