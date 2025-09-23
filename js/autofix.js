/* eslint-disable no-unused-vars */

// P2 full AutoFix pipeline (offline)
const DIAGRAM_KEYWORDS = [
  'flowchart','sequenceDiagram','sequence','stateDiagram','stateDiagram-v2','erDiagram','gantt','gitGraph','mindmap',
  'pie','quadrantChart','timeline','treemap','xychart','architecture','block','c4','user-journey','journey'
];

/**
 * 增強版 AutoFix - 支援更多修復規則和智能錯誤處理
 * @param {string} code - 原始 Mermaid 代碼
 * @param {Object} options - 修復選項
 * @returns {Object} { code: string, notes: string[], errors: string[] }
 */
export function applyFixes(code, options = {}) {
  let s = String(code || '');
  const notes = [];
  const errors = [];

  try {
    // 1) strip BOM and normalize encoding
    s = s.replace(/^\ufeff/, '');
    s = s.replace(/\r\n?/g, '\n');

    // 2) remove invalid HTML/Markdown comments
    s = removeInvalidComments(s, notes);

    // 3) ensure diagram declaration
    s = ensureDiagramDeclaration(s, notes, options);

    // 4) upgrade deprecated syntax
    s = upgradeDeprecatedSyntax(s, notes);

    // 5) fix common syntax errors
    s = fixSyntaxErrors(s, notes);

    // 6) normalize formatting
    s = normalizeFormatting(s, notes, options);

    // 7) validate and fix node IDs
    s = fixNodeIds(s, notes);

    // 8) autoclose unclosed blocks
    s = autocloseBlocks(s, notes);

  } catch (error) {
    errors.push(`AutoFix error: ${error.message}`);
  }

  return { 
    code: s, 
    notes, 
    errors,
    stats: {
      fixesApplied: notes.length,
      errorsFound: errors.length
    }
  };
}

/**
 * 移除無效的註解
 */
function removeInvalidComments(code, notes) {
  let s = code;
  
  // 移除 HTML 註解 (在 Mermaid 中無效)
  if (s.includes('<!--')) {
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    notes.push('removeInvalidHTMLComments');
  }
  
  // 移除 Markdown 註解 (在 Mermaid 中無效)
  if (s.includes('[//]:')) {
    s = s.replace(/\[\/\/\]:\s*#\s*\([^)]*\)/g, '');
    notes.push('removeInvalidMarkdownComments');
  }

  return s;
}

/**
 * 確保圖表聲明
 */
function ensureDiagramDeclaration(code, notes, options) {
  const lines = code.split('\n');
  let firstIdx = lines.findIndex(ln => ln.trim() !== '');
  if (firstIdx === -1) firstIdx = 0;
  
  const first = lines[firstIdx] || '';
  const isDeclared = DIAGRAM_KEYWORDS.some(k => first.trim().startsWith(k));
  
  if (!isDeclared) {
    const defaultType = options.defaultDiagramType || 'flowchart TD';
    lines.splice(firstIdx, 0, defaultType);
    notes.push(`ensureDiagramDeclaration(${defaultType})`);
  }
  
  return lines.join('\n');
}

/**
 * 升級過時語法
 */
function upgradeDeprecatedSyntax(code, notes) {
  let s = code;
  
  // graph -> flowchart (preserve direction)
  s = s.replace(/^\s*graph\s+(TB|TD|LR|RL|BT)\b/gm, (m, dir) => {
    notes.push('upgradeGraphKeyword');
    return `flowchart ${dir}`;
  });

  return s;
}

/**
 * 修復語法錯誤
 */
function fixSyntaxErrors(code, notes) {
  let s = code;
  
  // 移除尾端分號
  s = s.replace(/;[ \t]*$/gm, () => {
    notes.push('removeTrailingSemicolons');
    return '';
  });

  // 修復重複的圖表聲明
  const declarations = s.match(/^\s*(flowchart|classDiagram|sequenceDiagram)\b/gm);
  if (declarations && declarations.length > 1) {
    const lines = s.split('\n');
    let firstDeclaration = true;
    const newLines = lines.filter(line => {
      const isDeclaration = /^\s*(flowchart|classDiagram|sequenceDiagram)\b/.test(line);
      if (isDeclaration) {
        if (firstDeclaration) {
          firstDeclaration = false;
          return true;
        }
        notes.push('removeDuplicateDeclarations');
        return false;
      }
      return true;
    });
    s = newLines.join('\n');
  }

  return s;
}

/**
 * 格式化正規化
 */
function normalizeFormatting(code, notes, options) {
  let s = code;
  
  if (options.normalizeIndentation !== false) {
    // 統一縮排
    const lines = s.split('\n');
    const normalizedLines = lines.map(line => {
      if (line.trim() === '') return line;
      
      // 檢測現有縮排
      const indent = line.match(/^\s*/)[0];
      if (indent.includes('\t')) {
        // 轉換 tab 為空格
        return line.replace(/^\t+/, match => '    '.repeat(match.length));
      }
      return line;
    });
    
    if (normalizedLines.join('\n') !== s) {
      s = normalizedLines.join('\n');
      notes.push('normalizeIndentation');
    }
  }

  return s;
}

/**
 * 修復節點 ID
 */
function fixNodeIds(code, notes) {
  let s = code;
  
  // 修復使用 Mermaid 關鍵字作為節點 ID
  const keywords = ['end', 'start', 'if', 'else', 'class', 'subgraph'];
  
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\(\\(`, 'g');
    if (regex.test(s)) {
      s = s.replace(regex, `${keyword}Node((`);
      notes.push(`fixKeywordNodeId(${keyword})`);
    }
  }

  return s;
}

/**
 * 自動關閉未關閉的區塊
 */
function autocloseBlocks(code, notes) {
  let s = code;
  
  // autoclose subgraph ... end
  const open = (s.match(/^\s*subgraph\b/gm) || []).length;
  const close = (s.match(/^\s*end\s*$/gm) || []).length;
  
  if (open > close) {
    const need = open - close;
    s = s.trimEnd() + '\n' + ('end\n'.repeat(need));
    notes.push(`autocloseSubgraph(+${need})`);
  }

  // stadium label safe parens
  s = s.replace(/\(\[\s*([\s\S]*?)\s*\]\)/g, (m, inner) => {
    const esc = inner.replace(/\(/g, '&#40;').replace(/\)/g, '&#41;');
    return '([' + esc + '])';
  });
  notes.push('stadiumLabelParensSafe');

  return s;
}
