// js/engine-esm.js - ESM version of DiagramMenderCore
// Exports runPipeline, runPipelineIR for direct import

// ---------- Types (JSDoc for IDEs) ----------
/**
 * @typedef {{file:string,line:number,endLine?:number}} IRPos
 * @typedef {{id:string, name:string, params:string[], body:any[], calls:string[], pos:IRPos, doc:string, cfg?:CFG}} IRFunction
 * @typedef {{id:string, name:string, bases:string[], methods?:string[], doc?:string}} IRClass
 * @typedef {{name:string, path:string, classes:IRClass[], functions:IRFunction[], imports:string[]}} IRModule
 * @typedef {{modules:Record<string,IRModule>, fixNotes?:string[], callGraph?:CallGraph}} IRProject
 * @typedef {{id:string, kind:'start'|'end'|'op'|'decision'|'merge'|'loop'|'try'|'except', label?:string}} CFGNode
 * @typedef {{from:string, to:string, label?:string}} CFGEdge
 * @typedef {{nodes:CFGNode[], edges:CFGEdge[]}} CFG
 * @typedef {{from:string, toName:string, toId?:string}} CallEdge
 * @typedef {{edges:CallEdge[]}} CallGraph
 * @typedef {'flowchart'|'classDiagram'|'sequenceDiagram'} DiagramKind
 */

function relModuleName(p){
  return p.replace(/\\/g,'/').replace(/\.py$/, '').replace(/\/(?:__init__)?$/, '').replace(/\//g,'.');
}
function unique(arr){ return Array.from(new Set(arr)); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'\\"'); }
function sid(prefix, key){
  let h = 2166136261 >>> 0;
  for (let i=0;i<key.length;i++){ h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${prefix}_${(h>>>0).toString(16)}`;
}

function parsePythonProject(files){
  const modules = {};
  for (const [path, src0] of Object.entries(files || {})){
    if (!/\.py$/i.test(path)) continue;
    const src = String(src0 || '');
    const name = relModuleName(path);
    const functions = [];
    const classes = [];
    const imports = [];
    const importRe = /^(?:from\s+([\w\.]+)\s+import\s+([\w\*\,\s]+)|import\s+([\w\.]+))/gm;
    let m;
    while ((m = importRe.exec(src))){
      if (m[1]) imports.push(`${m[1]}:${(m[2]||'').trim()}`);
      if (m[3]) imports.push(m[3]);
    }
    const funcRe = /^\s*def\s+(\w+)\s*\(([^"]*)\)\s*:/gm;
    while ((m = funcRe.exec(src))){
      const fname = m[1];
      const params = (m[2] || '').split(',').map(s => s.trim()).filter(Boolean);
      const calls = unique(Array.from(src.matchAll(/([A-Za-z_][A-Za-z0-9_\.]*)\s*\(/g)).map(mm => mm[1]));
      functions.push({
        id: `${name}.${fname}`,
        name: fname,
        params,
        body: [],
        calls,
        pos: { file: path, line: 1 },
        doc: ''
      });
    }
    const classRe = /^\s*class\s+(\w+)\s*(?:\(([^"]*)\))?\s*:/gm;
    while ((m = classRe.exec(src))){
      const cname = m[1];
      const bases = (m[2] || '').split(',').map(s => s.trim()).filter(Boolean);
      classes.push({ id: `${name}.${cname}`, name: cname, bases, methods: [], doc: '' });
    }
    modules[name] = { name, path, classes, functions, imports };
  }
  return { modules, fixNotes: [] };
}

let __idc = 0;
function nid(prefix){ __idc += 1; return `${prefix}_${__idc}`; }

function buildCFG(fn){
  __idc = 0;
  const nodes = [], edges = [];
  const A = nid('A'), B = nid('B');
  nodes.push({ id:A, kind:'start', label:'Start' });
  nodes.push({ id:B, kind:'end', label:'End' });
  edges.push({ from:A, to:B });
  return { nodes, edges };
}

function buildCallGraph(project){
  const nameToId = new Map();
  const edges = [];
  for (const mod of Object.values(project.modules)){
    for (const fn of mod.functions){
      nameToId.set(`${mod.name}.${fn.name}`, fn.id);
    }
  }
  for (const mod of Object.values(project.modules)){
    for (const fn of mod.functions){
      for (const callee of (fn.calls || [])){
        const toId = nameToId.get(callee) || undefined;
        edges.push({ from: fn.id, toName: callee, toId });
      }
    }
  }
  return { edges };
}

function emitFlowchart(ir){
  const lines = ['flowchart TD'];
  for (const mod of Object.values(ir.modules)){
    for (const fn of mod.functions){
      const base = `${mod.name}.${fn.name}`;
      lines.push(`subgraph ${base}`);
      const cfg = fn.cfg;
      if (!cfg || !cfg.nodes.length){
        const A = sid('A', base), B = sid('B', base);
        lines.push(`${A}((Start))`);
        lines.push(`${B}((End))`);
        lines.push(`${A}-->${B}`);
      } else {
        for (const n of cfg.nodes){
          const id = sid(n.id, base);
          switch (n.kind){
            case 'start':    lines.push(`${id}((Start))`); break;
            case 'end':      lines.push(`${id}((End))`); break;
            case 'decision': lines.push(`${id}{${esc(n.label||'cond')}}`); break;
            default:         lines.push(`${id}([${esc(n.label||n.kind)}])`);
          }
        }
        for (const e of cfg.edges){
          const from = sid(e.from, base), to = sid(e.to, base);
          const lbl = e.label ? `|${esc(e.label)}|` : '';
          lines.push(`${from}-->${lbl}${to}`);
        }
      }
      lines.push('end');
    }
  }
  return lines.join('\n');
}

function emitClassDiagram(ir){
  const out = ['classDiagram'];
  for (const mod of Object.values(ir.modules)){
    for (const cls of mod.classes){
      const id = `${mod.name}.${cls.name}`.split('.').join('_');
      out.push(`class ${id} {`);
      for (const m of (cls.methods || [])) out.push(`  +${m}()`);
      out.push('}');
      for (const b of (cls.bases || [])) {
        const bid = `${b}`.split('.').join('_');
        out.push(`${bid} <|-- ${id}`);
      }
    }
  }
  return out.join('\n');
}

function emitSequenceDiagram(ir){
  const out = ['sequenceDiagram', 'autonumber'];
  const seen = new Set();
  for (const mod of Object.values(ir.modules)){
    for (const fn of mod.functions){
      const from = `${mod.name}.${fn.name}`.split('.').join('_');
      if (!seen.has(from)){ out.push(`participant ${from}`); seen.add(from); }
    }
  }
  for (const mod of Object.values(ir.modules)){
    for (const fn of mod.functions){
      const from = `${mod.name}.${fn.name}`.split('.').join('_');
      for (const c of (fn.calls || [])){
        const to = String(c).split('.').join('_');
        if (!seen.has(to)){ out.push(`participant ${to}`); seen.add(to); }
        out.push(`${from}->>${to}: call()`);
      }
    }
  }
  if (out.length <= 2) out.push('Note over X: no data');
  return out.join('\n');
}

function fixEnsureHeader(code, diagram){
  const trimmed = String(code).trim();
  if (!/^(flowchart|classDiagram|sequenceDiagram|stateDiagram|erDiagram)\b/.test(trimmed)){
    return { code: `${diagram === 'classDiagram' ? 'classDiagram' : (diagram === 'sequenceDiagram' ? 'sequenceDiagram' : 'flowchart TD')}\n` + code, notes: ['Added diagram header'] };
  }
  return { code, notes: [] };
}

function applyAll(code, ctx){
  const r = fixEnsureHeader(code, ctx.diagram);
  return { code: r.code, notes: r.notes };
}

export async function runPipeline(files, opts){
  const ir = parsePythonProject(files || {});
  for (const mod of Object.values(ir.modules)){
    for (const fn of mod.functions){ fn.cfg = buildCFG(fn); }
  }
  ir.callGraph = buildCallGraph(ir);
  let code = '';
  switch (opts && opts.diagram){
    case 'classDiagram':    code = emitClassDiagram(ir); break;
    case 'sequenceDiagram': code = emitSequenceDiagram(ir); break;
    case 'flowchart':
    default:                code = emitFlowchart(ir);
  }
  const fixed = applyAll(code, { diagram: (opts && opts.diagram) || 'flowchart', mermaidVersion: 'v11' });
  return {
    code: fixed.code,
    errors: [],
    log: (ir.fixNotes || []).concat(fixed.notes || []),
    dtype: (opts && opts.diagram) || 'flowchart'
  };
}

export async function runPipelineIR(ir, opts){
  if (ir && ir.modules){
    for (const mod of Object.values(ir.modules)){
      for (const fn of (mod.functions || [])){
        if (!fn.cfg) fn.cfg = buildCFG(fn);
      }
    }
    ir.callGraph = buildCallGraph(ir);
  }
  let code = '';
  switch (opts && opts.diagram){
    case 'classDiagram':    code = emitClassDiagram(ir); break;
    case 'sequenceDiagram': code = emitSequenceDiagram(ir); break;
    case 'flowchart':
    default:                code = emitFlowchart(ir);
  }
  const fixed = applyAll(code, { diagram: (opts && opts.diagram) || 'flowchart', mermaidVersion: 'v11' });
  return { code: fixed.code, errors: [], log: (ir.fixNotes || []).concat(fixed.notes || []), dtype: (opts && opts.diagram) || 'flowchart' };
}
/* eslint-disable no-unused-vars */
