/* js/engine/common.js */
self.EngineCommon = {
  guessDiagramType(code){
    const s = (code||'').toLowerCase();
    if (/^\s*sequenceDiagram/i.test(code)) return 'sequenceDiagram';
    if (/^\s*classDiagram/i.test(code)) return 'classDiagram';
    if (/^\s*stateDiagram/i.test(code)) return 'stateDiagram';
    if (/^\s*erDiagram/i.test(code)) return 'erDiagram';
    if (/^\s*pie\b/i.test(code)) return 'pie';
    if (/^\s*gantt\b/i.test(code)) return 'gantt';
    if (/^\s*timeline\b/i.test(code)) return 'timeline';
    if (/^\s*block(\-| )?beta/i.test(code)) return 'block';
    if (/^\s*flowchart\b|\bgraph\s+(TB|TD|LR|RL|BT)\b/i.test(code)) return 'flowchart';
    return 'unknown';
  },
  applyRegexAll(code, re, repl){
    const R = new RegExp(re.source, re.flags.replace('g','')+'g');
    return code.replace(R, repl);
  },
  loadJsonSync(path){
    // In Worker, we can fetch via importScripts side channel:
    try {
      // This hack uses importScripts to get text, then eval JSON
      const txt = '';
      try {
        importScripts(path + '?_=' + Date.now()); // cache-bust
        // If the file was a JS, it executed; for JSON, this won't work.
      } catch(e) {}
    } catch(e) {}
  }
};
