import {
  IRProject,
  IRModule,
  IRFunction,
  IRClass,
  IRStatement,
  ParserPlugin,
  ParserParseOptions,
  ParserDetectionResult,
  ParserRuntime,
  ParserMeta,
  WebTreeSitterConfig,
} from '@diagrammender/types';

const PY_EXTENSIONS = ['.py', '.pyw', '.pyi'];

declare const require: (id: string) => any;

function relModuleName(p: string): string {
  return p
    .replace(/\\/g, '/')
    .replace(/\.(?:py|pyw|pyi)$/i, '')
    .replace(/\/(?:__init__)?$/, '')
    .replace(/\//g, '.');
}

const PYTHON_PLUGIN_VERSION = '0.3.0';

interface WebTreeSitterState {
  initialized: boolean;
  languages: Map<string, any>;
}

const webTreeSitterStates = new WeakMap<any, WebTreeSitterState>();

function getWebTreeSitterState(module: any): WebTreeSitterState {
  let state = webTreeSitterStates.get(module);
  if (!state) {
    state = { initialized: false, languages: new Map<string, any>() };
    webTreeSitterStates.set(module, state);
  }
  return state;
}

function shouldUseNodeTreeSitter(options?: ParserParseOptions): boolean {
  if (options?.preferTreeSitter === false) return false;
  if (options?.runtime === 'browser') return false;
  return true;
}

function shouldUseWebTreeSitter(options?: ParserParseOptions): boolean {
  if (options?.preferTreeSitter === false) return false;
  return options?.runtime === 'browser' && !!options?.webTreeSitter;
}

function filterPythonEntries(files: Record<string, string>): Array<[string, string]> {
  return Object.entries(files).filter(([filePath]) =>
    PY_EXTENSIONS.some((ext) => filePath.endsWith(ext))
  );
}

function toErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (err instanceof Error && typeof err.message === 'string') {
    return err.message;
  }
  if (typeof err === 'object' && err && 'message' in err) {
    const msg = (err as any).message;
    if (typeof msg === 'string') return msg;
  }
  try {
    return String(err);
  } catch {
    return 'Unknown error';
  }
}

async function parsePythonProjectInternal(files: Record<string,string>, options?: ParserParseOptions): Promise<IRProject> {
  const entries = filterPythonEntries(files);
  if (entries.length === 0) {
    throw new Error('No Python source files found in project. Provide at least one .py file.');
  }

  const fallbackAttempts: Array<{ strategy: string; error: string }> = [];

  if (shouldUseWebTreeSitter(options)) {
    const config = options?.webTreeSitter;
    if (config && config.module) {
      try {
        return await parseWithWebTreeSitter(entries, config);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw error;
        }
        fallbackAttempts.push({
          strategy: 'web-tree-sitter',
          error: toErrorMessage(error),
        });
      }
    }
  }

  if (shouldUseNodeTreeSitter(options)) {
    try {
      const Parser = require('tree-sitter');
      const Python = require('tree-sitter-python');
      return parseWithTreeSitter(Parser, Python, entries, options?.runtime ?? 'node');
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        throw e;
      }
      if (!e || e.code !== 'MODULE_NOT_FOUND') {
        throw e;
      }
      fallbackAttempts.push({
        strategy: 'tree-sitter',
        error: toErrorMessage(e),
      });
    }
  }

  const details = fallbackAttempts.length ? { attempts: fallbackAttempts } : undefined;
  return parseWithFallback(entries, options?.runtime ?? 'node', details);
}

function detectPythonProject(files: Record<string,string>): ParserDetectionResult | null {
  const matched = Object.keys(files).filter((f) =>
    PY_EXTENSIONS.some((ext) => f.endsWith(ext))
  );
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

export async function parsePythonProject(files: Record<string,string>, options?: ParserParseOptions): Promise<IRProject> {
  return await parsePythonProjectInternal(files, options);
}

function parseWithFallback(
  entries: Array<[string, string]>,
  runtime: ParserRuntime = 'node',
  details?: Record<string, unknown>,
): IRProject {
  const modules: Record<string, IRModule> = {};
  for (const [path, src] of entries) {
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
  const project: IRProject = { modules, fixNotes: [] };
  project.parserMeta = { implementation: 'fallback', runtime, details } satisfies ParserMeta;
  return project;
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

function parseWithTreeSitter(
  Parser: any,
  Python: any,
  entries: Array<[string, string]>,
  runtime: ParserRuntime = 'node',
): IRProject {
  const parser = new Parser();
  parser.setLanguage(Python);
  const details: Record<string, unknown> = { grammar: 'tree-sitter-python', mode: 'native' };
  return buildProjectFromParser(entries, () => parser, runtime, 'tree-sitter', details);
}

async function parseWithWebTreeSitter(
  entries: Array<[string, string]>,
  config: WebTreeSitterConfig,
): Promise<IRProject> {
  const module = config.module;
  if (!module || typeof module.Parser !== 'function') {
    throw new Error('Invalid web-tree-sitter module provided for python parser.');
  }
  const state = getWebTreeSitterState(module);
  if (!state.initialized) {
    if (typeof module.init === 'function') {
      const initOptions: Record<string, unknown> = {};
      if (typeof config.locateFile === 'function') {
        initOptions.locateFile = config.locateFile;
      } else if (config.runtimeUrl) {
        initOptions.locateFile = (scriptName: string, scriptDirectory?: string) => {
          if (scriptName === 'tree-sitter.wasm') {
            return config.runtimeUrl!;
          }
          if (typeof config.locateFile === 'function') {
            return config.locateFile(scriptName, scriptDirectory);
          }
          return scriptDirectory ? `${scriptDirectory}${scriptName}` : scriptName;
        };
      }
      await module.init(initOptions);
    }
    state.initialized = true;
  }
  if (!module.Language || typeof module.Language.load !== 'function') {
    throw new Error('web-tree-sitter module is missing Language.load API.');
  }
  const { language, source } = await loadWebTreeSitterLanguage(module, state, config, 'python');
  const parserInstance = new module.Parser();
  parserInstance.setLanguage(language);
  const details: Record<string, unknown> = { grammar: 'tree-sitter-python', mode: 'web' };
  if (source) details.languageSource = source;
  if (config.runtimeUrl) details.runtimeUrl = config.runtimeUrl;
  return buildProjectFromParser(entries, () => parserInstance, 'browser', 'web-tree-sitter', details);
}

function deriveLanguageUrl(runtimeUrl: string | undefined, lang: string): string | undefined {
  if (typeof runtimeUrl !== 'string') return undefined;
  if (runtimeUrl.includes('tree-sitter.wasm')) {
    return runtimeUrl.replace(/tree-sitter\.wasm(?:\?.*)?$/i, `tree-sitter-${lang}.wasm`);
  }
  return undefined;
}

async function loadWebTreeSitterLanguage(
  module: any,
  state: WebTreeSitterState,
  config: WebTreeSitterConfig,
  lang: string,
): Promise<{ language: any; source?: string }> {
  const cached = state.languages.get(lang);
  if (cached) {
    return { language: cached, source: 'cache' };
  }
  let language: any;
  let source: string | undefined;
  const entry = config.languages?.[lang];
  if (typeof entry === 'string') {
    language = await module.Language.load(entry);
    source = entry;
  } else if (entry && typeof entry === 'object') {
    if (entry.language) {
      language = entry.language;
      source = 'provided';
    } else if (entry.load) {
      language = await entry.load();
      source = 'loader';
    } else if (entry.url) {
      language = await module.Language.load(entry.url);
      source = entry.url;
    }
  }
  if (!language) {
    const derived = deriveLanguageUrl(config.runtimeUrl, lang) ?? `tree-sitter-${lang}.wasm`;
    language = await module.Language.load(derived);
    source = derived;
  }
  state.languages.set(lang, language);
  return { language, source };
}

function buildProjectFromParser(
  entries: Array<[string, string]>,
  parserFactory: () => { parse(source: string): any },
  runtime: ParserRuntime,
  implementation: ParserMeta['implementation'],
  details?: Record<string, unknown>,
): IRProject {
  const modules: Record<string, IRModule> = {};
  for (const [path, src] of entries) {
    const parser = parserFactory();
    const tree = parser.parse(src);
    if (tree.rootNode && typeof tree.rootNode.hasError === 'function' && tree.rootNode.hasError()) {
      const errorNode = findFirstError(tree.rootNode);
      const line = errorNode ? errorNode.startPosition.row + 1 : 0;
      const column = errorNode ? errorNode.startPosition.column + 1 : 0;
      const where = line ? `:${line}:${column}` : '';
      throw new SyntaxError(`Python syntax error detected while parsing ${path}${where}`);
    }
    const name = relModuleName(path);
    const functions: IRFunction[] = [];
    const classes: IRClass[] = [];
    const imports: string[] = [];

    const text = (node: any) => src.slice(node.startIndex, node.endIndex);
    const loc = (node: any) => ({ file: path, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
    const field = (node: any, key: string) => {
      if (!node) return null;
      if (typeof node.childForFieldName === 'function') {
        const result = node.childForFieldName(key);
        if (result) return result;
      }
      const direct = node[`${key}Node`];
      if (direct) return direct;
      return null;
    };
    const fieldList = (node: any, key: string): any[] => {
      if (!node) return [];
      const plural = node[`${key}Nodes`];
      if (Array.isArray(plural)) return plural;
      const single = field(node, key);
      return single ? [single] : [];
    };

    function toFunction(node: any, filePath: string, modName: string): IRFunction {
      const nameNode = field(node, 'name');
      const paramsNode = field(node, 'parameters');
      const fname = nameNode ? text(nameNode) : 'func';
      const params = paramsNode
        ? text(paramsNode).replace(/[()]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      const bodyNode = field(node, 'body');
      const body: IRStatement[] = [];
      const calls: string[] = [];

      function stmt(n: any): IRStatement | null {
        switch (n.type) {
          case 'if_statement': {
            const cond = field(n, 'condition');
            const cons = field(n, 'consequence');
            const alternatives = fieldList(n, 'alternative');
            const then: IRStatement[] = [];
            const els: IRStatement[] = [];
            if (cons) for (const c of cons.namedChildren || []) { const s = stmt(c); if (s) then.push(s); }
            for (const alt of alternatives) {
              for (const c of alt.namedChildren || []) { const s = stmt(c); if (s) els.push(s); }
            }
            return { kind: 'if', text: text(n), pos: loc(n), cond: cond ? text(cond) : '', then, else: els.length ? els : undefined } as any;
          }
          case 'for_statement': {
            const t = field(n, 'left');
            const it = field(n, 'right');
            const b = field(n, 'body');
            const bodyStatements: IRStatement[] = [];
            if (b) for (const c of b.namedChildren || []) { const s = stmt(c); if (s) bodyStatements.push(s); }
            return { kind: 'for', text: text(n), pos: loc(n), target: t ? text(t) : '', iter: it ? text(it) : '', body: bodyStatements } as any;
          }
          case 'while_statement': {
            const cond = field(n, 'condition');
            const b = field(n, 'body');
            const bodyStatements: IRStatement[] = [];
            if (b) for (const c of b.namedChildren || []) { const s = stmt(c); if (s) bodyStatements.push(s); }
            return { kind: 'while', text: text(n), pos: loc(n), cond: cond ? text(cond) : '', body: bodyStatements } as any;
          }
          case 'try_statement': {
            const b = field(n, 'body');
            const handlers = n.namedChildren?.filter((x: any) => x.type === 'except_clause') || [];
            const fin = n.namedChildren?.find((x: any) => x.type === 'finally_clause');
            const bodyStatements: IRStatement[] = [];
            if (b) for (const c of b.namedChildren || []) { const s = stmt(c); if (s) bodyStatements.push(s); }
            const excepts = handlers.map((h: any) => {
              const typ = field(h, 'type');
              const name = field(h, 'name');
              const bodyNode = field(h, 'body');
              const hb: IRStatement[] = [];
              if (bodyNode) for (const c of bodyNode.namedChildren || []) { const s = stmt(c); if (s) hb.push(s); }
              return { type: typ ? text(typ) : undefined, name: name ? text(name) : undefined, body: hb };
            });
            let finallyBody: IRStatement[] | undefined;
            if (fin) {
              const bnode = field(fin, 'body');
              const fb: IRStatement[] = [];
              if (bnode) for (const c of bnode.namedChildren || []) { const s = stmt(c); if (s) fb.push(s); }
              finallyBody = fb;
            }
            return { kind: 'try', text: text(n), pos: loc(n), body: bodyStatements, excepts, finally: finallyBody } as any;
          }
          case 'return_statement': return { kind: 'return', text: text(n), pos: loc(n) } as any;
          case 'raise_statement': return { kind: 'raise', text: text(n), pos: loc(n) } as any;
          case 'break_statement': return { kind: 'break', text: text(n), pos: loc(n) } as any;
          case 'continue_statement': return { kind: 'continue', text: text(n), pos: loc(n) } as any;
          case 'expression_statement': {
            const s = text(n);
            for (const mm of s.matchAll(/([A-Za-z_][A-Za-z0-9_\.]+)\s*\(/g)) {
              calls.push(mm[1]);
            }
            return { kind: 'expr', text: s, pos: loc(n) } as any;
          }
          case 'assignment': {
            return { kind: 'assign', text: text(n), pos: loc(n) } as any;
          }
        }
        return null;
      }

      if (bodyNode) {
        for (const child of bodyNode.namedChildren || []) {
          const s = stmt(child);
          if (s) body.push(s);
        }
      }
      return {
        id: `${modName}.${fname}`,
        name: fname,
        params,
        body,
        calls: Array.from(new Set(calls)),
        pos: loc(node),
        doc: '',
      };
    }

    function walk(node: any): void {
      const typ = node.type;
      if (typ === 'import_statement' || typ === 'import_from_statement') {
        imports.push(text(node).replace(/^\s+|\s+$/g, ''));
      }
      if (typ === 'class_definition') {
        const nameNode = field(node, 'name');
        const basesNode = field(node, 'superclasses');
        const cname = nameNode ? text(nameNode) : 'Class';
        const bases = basesNode
          ? text(basesNode).replace(/[()]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];
        const cls: IRClass = { id: `${name}.${cname}`, name: cname, bases, attrs: [], methods: [], pos: loc(node), doc: '' };
        classes.push(cls);
        const suite = field(node, 'body');
        if (suite) {
          for (const ch of suite.namedChildren || []) {
            if (ch.type === 'function_definition') {
              const fn = toFunction(ch, path, name);
              cls.methods.push(fn);
            }
          }
        }
        return;
      }
      if (typ === 'function_definition') {
        functions.push(toFunction(node, path, name));
        return;
      }
      for (const child of node.namedChildren || []) {
        walk(child);
      }
    }

    walk(tree.rootNode);
    modules[name] = { name, path, classes, functions, imports };
  }
  const metaDetails = details && Object.keys(details).length ? { ...details } : undefined;
  const project: IRProject = { modules, fixNotes: [] };
  project.parserMeta = { implementation, runtime, details: metaDetails } satisfies ParserMeta;
  return project;
}

function findFirstError(node: any): any | null {
  if (!node) return null;
  if (typeof node.isError === 'function' && node.isError()) {
    return node;
  }
  for (const child of node.children || []) {
    if (child && typeof child.hasError === 'function' && child.hasError()) {
      const found = findFirstError(child);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
