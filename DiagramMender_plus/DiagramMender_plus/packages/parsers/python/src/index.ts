import {
  IRProject,
  IRModule,
  IRFunction,
  IRClass,
  IRStatement,
  ParserPlugin,
  ParserParseOptions,
  ParserDetectionResult,
} from '@diagrammender/types';

declare const require: (id: string) => any;

function relModuleName(p: string): string {
  return p.replace(/\\/g,'/').replace(/\.py$/, '').replace(/\/(?:__init__)?$/, '').replace(/\//g,'.');
}

const PYTHON_PLUGIN_VERSION = '0.3.0';

function shouldUseTreeSitter(options?: ParserParseOptions): boolean {
  if (options?.preferTreeSitter === false) return false;
  if (options?.runtime === 'browser') return false;
  return true;
}

function parsePythonProjectInternal(files: Record<string,string>, options?: ParserParseOptions): IRProject {
  if (shouldUseTreeSitter(options)) {
    try {
      const Parser = require('tree-sitter');
      const Python = require('tree-sitter-python');
      return parseWithTreeSitter(Parser, Python, files);
    } catch (e) {
      // swallow and fallback below
    }
  }
  return parseWithFallback(files);
}

function detectPythonProject(files: Record<string,string>): ParserDetectionResult | null {
  const matched = Object.keys(files).filter((f) => f.endsWith('.py'));
  if (matched.length === 0) return null;
  const reason = matched.length === 1
    ? `Found Python file ${matched[0]}`
    : `Found ${matched.length} Python files`;
  return {
    lang: 'python',
    confidence: 'high',
    reason,
    matchedFiles: matched.slice(0, 5),
  };
}

export function parsePythonProject(files: Record<string,string>, options?: ParserParseOptions): IRProject {
  return parsePythonProjectInternal(files, options);
}

function parseWithFallback(files: Record<string,string>): IRProject {
  const modules: Record<string, IRModule> = {};
  for (const [path, src] of Object.entries(files)) {
    if (!path.endsWith('.py')) continue;
    const name = relModuleName(path);
    const functions: IRFunction[] = [];
    const classes: IRClass[] = [];
    const imports: string[] = [];

    // imports
    const importRe = /^(?:from\s+([\w\.]+)\s+import\s+([\w\*\,\s]+)|import\s+([\w\.]+))/gm;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(src))) {
      if (m[1]) imports.push(`${m[1]}:${(m[2]||'').trim()}`);
      if (m[3]) imports.push(m[3]);
    }

    // functions
    const funcRe = /^\s*def\s+(\w+)\s*\(([^\)]*)\)\s*:/gm;
    while ((m = funcRe.exec(src))) {
      const fname = m[1];
      const params = (m[2] || '').split(',').map(s => s.trim()).filter(Boolean);
      const calls = Array.from(new Set(Array.from(src.matchAll(/([A-Za-z_][A-Za-z0-9_\.]+)\s*\(/g)).map(mm => mm[1])));
      functions.push({
        id: `${name}.${fname}`, name: fname, params, body: [], calls, pos: { file: path, line: 1 }, doc: ''
      });
    }

    // classes
    const classRe = /^\s*class\s+(\w+)\s*(?:\(([^\)]*)\))?\s*:/gm;
    while ((m = classRe.exec(src))) {
      const cname = m[1];
      const bases = (m[2] || '').split(',').map(s => s.trim()).filter(Boolean);
      classes.push({ id: `${name}.${cname}`, name: cname, bases, attrs: [], methods: [], pos: { file: path, line: 1 }, doc: '' });
    }
    modules[name] = { name, path, classes, functions, imports };
  }
  return { modules, fixNotes: [] };
}

export const pythonParserPlugin: ParserPlugin = {
  lang: 'python',
  version: PYTHON_PLUGIN_VERSION,
  aliases: ['py'],
  parseProject: (files: Record<string, string>, options?: ParserParseOptions) =>
    parsePythonProjectInternal(files, options),
  detect: detectPythonProject,
  capabilities: {
    treeSitter: true,
    fallback: true,
    incremental: false,
  },
  treeSitterModule: 'tree-sitter-python',
};

export const parserPlugin = pythonParserPlugin;

export default pythonParserPlugin;

function parseWithTreeSitter(Parser: any, Python: any, files: Record<string,string>): IRProject {
  const modules: Record<string, IRModule> = {};
  const parser = new Parser();
  parser.setLanguage(Python);
  for (const [path, src] of Object.entries(files)) {
    if (!path.endsWith('.py')) continue;
    const name = relModuleName(path);
    const tree = parser.parse(src);
    const functions: IRFunction[] = [];
    const classes: IRClass[] = [];
    const imports: string[] = [];

    function text(node: any) { return src.slice(node.startIndex, node.endIndex); }
    function loc(node: any) { return { file: path, line: node.startPosition.row+1, endLine: node.endPosition.row+1 }; }

    function walk(node: any, parentClass?: IRClass) {
      const typ = node.type;
      // imports
      if (typ === 'import_statement') {
        imports.push(text(node).replace(/^\s+|\s+$/g,''));
      }
      if (typ === 'import_from_statement') {
        imports.push(text(node).replace(/^\s+|\s+$/g,''));
      }

      // classes
      if (typ === 'class_definition') {
        const nameNode = node.childForFieldName('name');
        const basesNode = node.childForFieldName('superclasses');
        const cname = nameNode ? text(nameNode) : 'Class';
        const bases = basesNode ? text(basesNode).replace(/[()]/g,'').split(',').map((s:string)=>s.trim()).filter(Boolean) : [];
        const cls: IRClass = { id: `${name}.${cname}`, name: cname, bases, attrs: [], methods: [], pos: loc(node), doc: '' };
        classes.push(cls);
        // walk into body to find methods/attrs
        const suite = node.childForFieldName('body');
        if (suite) {
          for (const ch of suite.namedChildren || []) {
            if (ch.type === 'function_definition') {
              const fn = toFunction(ch, path, name);
              cls.methods.push(fn);
            } else if (ch.type === 'expression_statement') {
              // naive attr detection: "x = y" won't be expression_statement; skip here.
            }
          }
        }
        return;
      }

      // functions (module-level)
      if (typ === 'function_definition') {
        functions.push(toFunction(node, path, name));
        return;
      }

      // recurse
      for (const ch of node.namedChildren || []) walk(ch, parentClass);
    }

    function toFunction(node: any, path: string, modName: string): IRFunction {
      const nameNode = node.childForFieldName('name');
      const paramsNode = node.childForFieldName('parameters');
      const fname = nameNode ? text(nameNode) : 'func';
      const params = paramsNode ? text(paramsNode).replace(/[()]/g,'').split(',').map((s:string)=>s.trim()).filter(Boolean) : [];
      const bodyNode = node.childForFieldName('body');
      const body: IRStatement[] = [];
      const calls: string[] = [];

      function stmt(n: any): IRStatement | null {
        switch (n.type) {
          case 'if_statement': {
            const cond = n.childForFieldName('condition');
            const cons = n.childForFieldName('consequence');
            const alt  = n.childForFieldName('alternative');
            const then: IRStatement[] = [];
            const els: IRStatement[] = [];
            if (cons) for (const c of cons.namedChildren || []) { const s = stmt(c); if (s) then.push(s); }
            if (alt)  for (const c of alt.namedChildren  || []) { const s = stmt(c); if (s) els.push(s); }
            return { kind:'if', text: text(n), pos: loc(n), cond: cond?text(cond):'', then, else: els.length?els:undefined } as any;
          }
          case 'for_statement': {
            const t = n.childForFieldName('left'); const it = n.childForFieldName('right');
            const b = n.childForFieldName('body');
            const body: IRStatement[] = [];
            if (b) for (const c of b.namedChildren || []) { const s = stmt(c); if (s) body.push(s); }
            return { kind:'for', text: text(n), pos: loc(n), target: t?text(t):'', iter: it?text(it):'', body } as any;
          }
          case 'while_statement': {
            const cond = n.childForFieldName('condition'); const b = n.childForFieldName('body');
            const body: IRStatement[] = [];
            if (b) for (const c of b.namedChildren || []) { const s = stmt(c); if (s) body.push(s); }
            return { kind:'while', text: text(n), pos: loc(n), cond: cond?text(cond):'', body } as any;
          }
          case 'try_statement': {
            const b = n.childForFieldName('body');
            const handlers = n.namedChildren?.filter((x:any)=>x.type==='except_clause') || [];
            const fin = n.namedChildren?.find((x:any)=>x.type==='finally_clause');
            const body: IRStatement[] = [];
            if (b) for (const c of b.namedChildren || []) { const s = stmt(c); if (s) body.push(s); }
            const excepts = handlers.map((h:any)=>{
              const typ = h.childForFieldName('type');
              const name = h.childForFieldName('name');
              const bodyNode = h.childForFieldName('body');
              const hb: IRStatement[] = [];
              if (bodyNode) for (const c of bodyNode.namedChildren || []) { const s = stmt(c); if (s) hb.push(s); }
              return { type: typ?text(typ):undefined, name: name?text(name):undefined, body: hb };
            });
            let finallyBody: IRStatement[]|undefined;
            if (fin) {
              const bnode = fin.childForFieldName('body');
              const fb: IRStatement[] = [];
              if (bnode) for (const c of bnode.namedChildren || []) { const s = stmt(c); if (s) fb.push(s); }
              finallyBody = fb;
            }
            return { kind:'try', text: text(n), pos: loc(n), body, excepts, finally: finallyBody } as any;
          }
          case 'return_statement': return { kind:'return', text: text(n), pos: loc(n) } as any;
          case 'raise_statement' : return { kind:'raise' , text: text(n), pos: loc(n) } as any;
          case 'break_statement' : return { kind:'break' , text: text(n), pos: loc(n) } as any;
          case 'continue_statement': return { kind:'continue', text: text(n), pos: loc(n) } as any;
          case 'expression_statement': {
            // collect calls best-effort
            const s = text(n);
            for (const mm of s.matchAll(/([A-Za-z_][A-Za-z0-9_\.]+)\s*\(/g)) { calls.push(mm[1]); }
            return { kind:'expr', text: s, pos: loc(n) } as any;
          }
          case 'assignment': {
            return { kind:'assign', text: text(n), pos: loc(n) } as any;
          }
        }
        return null;
      }

      if (bodyNode) {
        for (const n of bodyNode.namedChildren || []) {
          const s = stmt(n);
          if (s) body.push(s);
        }
      }
      return { id: `${modName}.${fname}`, name: fname, params, body, calls: Array.from(new Set(calls)), pos: loc(node), doc: '' };
    }

    walk(tree.rootNode);
    modules[name] = { name, path, classes, functions, imports };
  }
  return { modules, fixNotes: [] };
}
