/* eslint-disable no-unused-vars */

// P2 full AutoFix pipeline (offline)
const DIAGRAM_KEYWORDS = [
  'flowchart','sequenceDiagram','sequence','stateDiagram','stateDiagram-v2','erDiagram','gantt','gitGraph','mindmap',
  'pie','quadrantChart','timeline','treemap','xychart','architecture','block','c4','user-journey','journey'
];

export function applyFixes(code) {
  let s = String(code||'');
  const notes = [];

  // 1) strip BOM
  s = s.replace(/^\ufeff/, '');

  // 2) normalize newlines
  s = s.replace(/\r\n?/g, '\n');

  // 3) ensure diagram declaration
  const lines = s.split('\n');
  let firstIdx = lines.findIndex(ln => ln.trim() !== '');
  if (firstIdx === -1) firstIdx = 0;
  const first = lines[firstIdx] || '';
  const isDeclared = DIAGRAM_KEYWORDS.some(k => first.trim().startsWith(k));
  if (!isDeclared) {
    lines.splice(firstIdx, 0, 'flowchart TD');
    notes.push('ensureDiagramDeclaration');
  }
  s = lines.join('\n');

  // 4) upgrade graph -> flowchart (preserve direction)
  s = s.replace(/^\s*graph\s+(TB|TD|LR|RL|BT)\b/gm, (m, dir) => {
    notes.push('upgradeGraphKeyword');
    return `flowchart ${dir}`;
  });

  // 5) remove trailing semicolons
  s = s.replace(/;[ \t]*$/gm, (m) => {
    notes.push('removeTrailingSemicolons');
    return '';
  });

  // 6) autoclose subgraph ... end
  {
    const open = (s.match(/^\s*subgraph\b/gm) || []).length;
    const close = (s.match(/^\s*end\s*$/gm) || []).length;
    if (open > close) {
      const need = open - close;
      s = s.trimEnd() + '\n' + ('end\n'.repeat(need));
      notes.push(`autocloseSubgraph(+${need})`);
    }
  }

  // 7) start/end stadium label safe parens
  s = s.replace(/\(\[\s*([\s\S]*?)\s*\]\)/g, (m, inner) => {
    const esc = inner.replace(/\(/g, '&#40;').replace(/\)/g, '&#41;');
    return '([' + esc + '])';
  });
  notes.push('stadiumLabelParensSafe');

  return { code: s, notes };
}
