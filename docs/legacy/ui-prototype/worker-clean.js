// js/worker.js
try { importScripts('js/engine.js'); } catch (_) {}

// --- Stage 3 additions: web-tree-sitter integration + diagnostics ---
const WORKER_VERSION = 'stage3-2025-09-10';

async function tryLoadWebTreeSitter() {
  const candidates = [
    'js/vendor/web-tree-sitter.js',
    'js/vendor/web-tree-sitter.min.js',
    'js/vendor/web-tree-sitter.umd.js',
  ];
  for (const p of candidates) {
    try { importScripts(p); return true; } catch (_) {}
  }
  return typeof WebTreeSitter !== 'undefined';
}

async function initWebTreeSitterPython(opts = {}) {
  if (typeof WebTreeSitter === 'undefined') {
    const ok = await tryLoadWebTreeSitter();
    if (!ok) throw new Error('web-tree-sitter runtime not found');
  }
  const wasmBase = (opts.wasmBase || 'js/wasm/').replace(/\/+$/,'') + '/';
  await WebTreeSitter.init({ locateFile: (s) => wasmBase + s });
  const parser = new WebTreeSitter();
  const Python = await WebTreeSitter.Language.load(wasmBase + 'tree-sitter-python.wasm');
  parser.setLanguage(Python);
  return parser;
}

function relModuleName(p){
  return p.replace(/\\/g,'/').replace(/\.py$/, '').replace(/\/(?:__init__)?$/, '').replace(/\//g,'.');
}

function scanCalls(src) {
  try {
    const names = Array.from(src.matchAll(/([A-Za-z_][A-Za-z0-9_\.]+)\s*\(/g)).map(m=>m[1]);
    return Array.from(new Set(names));
  } catch(_) { return []; }
}

function parseWithWTS(parser, files) {
  const modules = {};
  for (const [path, src0] of Object.entries(files || {})) {
    if (!/\.py$/i.test(path)) continue;
    const src = String(src0 || '');
    const name = relModuleName(path);
    const functions = [];
    const classes = [];
    const imports = [];
    try {
      const importRe = /^(?:from\s+([\w\.]+)\s+import\s+([\w\*\,\s]+)|import\s+([\w\.]+))/gm;
      let m;
      while ((m = importRe.exec(src))) {
        if (m[1]) imports.push(`${m[1]}:${(m[2]||'').trim()}`);
        if (m[3]) imports.push(m[3]);
      }
    } catch(_){}
    const tree = parser.parse(src);
    const root = tree.rootNode;
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      for (let i=0;i<n.namedChildCount;i++){ stack.push(n.namedChild(i)); }
      if (n.type === 'function_definition') {
        const nameNode = n.childForFieldName('name');
        const paramsNode = n.childForFieldName('parameters');
        const fname = nameNode ? src.slice(nameNode.startIndex, nameNode.endIndex) : 'func';
        const paramsText = paramsNode ? src.slice(paramsNode.startIndex, paramsNode.endIndex) : '';
        const params = paramsText.replace(/[()]/g,'').split(',').map(s=>s.trim()).filter(Boolean);
        functions.push({
          id: `${name}.${fname}`, name: fname, params, body: [],
          calls: scanCalls(src),
          pos: { file: path, line: n.startPosition.row+1, endLine: n.endPosition.row+1 },
          doc: ''
        });
      } else if (n.type === 'class_definition') {
        const nameNode = n.childForFieldName('name');
        const superNode = n.childForFieldName('superclasses');
        const cname = nameNode ? src.slice(nameNode.startIndex, nameNode.endIndex) : 'Class';
        let bases = [];
        if (superNode) {
          const t = src.slice(superNode.startIndex, superNode.endIndex);
          bases = t.replace(/[()]/g,'').split(',').map(s=>s.trim()).filter(Boolean);
        }
        classes.push({ id: `${name}.${cname}`, name: cname, bases, methods: [], doc: '' });
      }
    }
    modules[name] = { name, path, classes, functions, imports };
  }
  return { modules, fixNotes: ['wts:parsed'] };
}

self.onmessage = async (event) => {
  const { files = {}, options = {} } = event.data || {};
  const startTs = Date.now();
  const diag = { workerVersion: WORKER_VERSION, engineLoaded: !!(self.DiagramMenderCore && typeof self.DiagramMenderCore.runPipeline === 'function') };

  try {
    if ((options.mode === 'python' || options.lang === 'python') && (options.useWTS ?? true)) {
      try {
        const parser = await initWebTreeSitterPython({ wasmBase: options?.wasmBase || 'js/wasm' });
        const ir = parseWithWTS(parser, files);
        if (self.DiagramMenderCore && typeof self.DiagramMenderCore.runPipelineIR === 'function') {
          const result = await self.DiagramMenderCore.runPipelineIR(ir, options);
          self.postMessage({ ...result, log: [...(result.log||[]), { rule:'worker.wts', msg:'web-tree-sitter used' }, { rule:'worker.diag', msg: JSON.stringify(diag) }] });
          return;
        }
      } catch (e) {
        diag.wtsError = e?.message || String(e);
      }
    }
    if (self.DiagramMenderCore && typeof self.DiagramMenderCore.runPipeline === 'function') {
      const result = await self.DiagramMenderCore.runPipeline(files, options);
      self.postMessage({ ...result, log: [...(result.log||[]), { rule:'worker.diag', msg: JSON.stringify(diag) }] });
      return;
    }
  } catch (e) {
    console.error('Engine execution failed in worker:', e);
    const errNode = `graph TD\nE[分析失敗: ${(e && e.message) || String(e)}]`;
    self.postMessage({
      code: errNode,
      errors: [ { message: e?.message || String(e), stack: e?.stack || '' } ],
      log: [ { rule: 'worker.engine', msg: 'Engine execution failed; fell back to mock' }, { rule:'worker.diag', msg: JSON.stringify(diag) } ],
      dtype: 'graph'
    });
    return;
  }

  // Fallback mock
  const mock = (options && options.diagram) || 'flowchart';
  const code = (mock === 'sequenceDiagram') ? `
sequenceDiagram
  autonumber
  participant U as UI 層
  participant W as Worker
  U->>W: postMessage(files)
  W-->>U: postMessage(result)
  Note right of U: 收到 Mermaid 字串後進行渲染
` : (mock === 'classDiagram') ? `
classDiagram
  class UI {
    +postMessage(files)
    +renderMermaid(code)
  }
  class Worker {
    +onmessage(event)
    +postMessage(result)
  }
  UI --> Worker : communicates
` : `
flowchart TD
  A[UI 層] --> B[Worker]
  B --> C{分析完成}
  C -->|回傳 Mermaid| A
`;

  const duration = Date.now() - startTs;
  self.postMessage({
    code,
    errors: [],
    log: [
      { rule: 'worker.mock', msg: '成功從 Worker 回傳（Mock 模式）' },
      { rule: 'worker.duration', msg: `耗時 ${duration} ms` }
    ],
    dtype: mock === 'classDiagram' ? 'classDiagram' : (mock === 'sequenceDiagram' ? 'sequenceDiagram' : 'graph')
  });
};
