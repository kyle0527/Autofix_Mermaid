/* js/engine/common.js */
self.EngineCommon = {
  guessDiagramType(code){
    const s = (code||'').toLowerCase();
    if (/^\s*sequencediagram/i.test(s)) return 'sequenceDiagram';
    if (/^\s*classdiagram/i.test(s)) return 'classDiagram';
    if (/^\s*statediagram/i.test(s)) return 'stateDiagram';
    if (/^\s*erdiagram/i.test(s)) return 'erDiagram';
    if (/^\s*pie\b/i.test(s)) return 'pie';
    if (/^\s*gantt\b/i.test(s)) return 'gantt';
    if (/^\s*timeline\b/i.test(s)) return 'timeline';
    if (/^\s*block(\-| )?beta/i.test(s)) return 'block';
    if (/^\s*flowchart\b|\bgraph\s+(TB|TD|LR|RL|BT)\b/i.test(s)) return 'flowchart';
    return 'unknown';
  },
  applyRegexAll(code, re, repl){
    const R = new RegExp(re.source, re.flags.replace('g','')+'g');
    return code.replace(R, repl);
  }
};
