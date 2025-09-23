import {
  IRProject,
  IRModule,
  IRFunction,
  IRClass,
  ParserPlugin,
  ParserParseOptions,
  ParserDetectionResult,
  ParserRuntime,
  ParserMeta,
  WebTreeSitterConfig,
} from '@diagrammender/types';

const TS_EXTENSIONS = ['.ts', '.tsx', '.cts', '.mts'];
const TS_PLUGIN_VERSION = '0.3.0';

declare const require: (id: string) => any;

type FileEntry = [string, string];

type ParserInstance = {
  setLanguage(lang: any): void;
  parse(source: string): any;
};

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

function moduleNameFromPath(p: string): string {
  return p
    .replace(/\\/g, '/')
    .replace(/\.(?:d\.ts|cts|mts|tsx|ts)$/i, '')
    .replace(/\//g, '.');
}

function shouldUseTreeSitter(options?: ParserParseOptions): boolean {
  if (options?.preferTreeSitter === false) return false;
  if (options?.runtime === 'browser') return false;
  return true;
}

function shouldUseWebTreeSitter(options?: ParserParseOptions): boolean {
  if (options?.preferTreeSitter === false) return false;
  return options?.runtime === 'browser' && !!options?.webTreeSitter;
}

function filterTypeScriptEntries(files: Record<string, string>): FileEntry[] {
  return Object.entries(files).filter(([filePath]) =>
    TS_EXTENSIONS.some((ext) => filePath.endsWith(ext))
  );
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '');
}

async function parseTypeScriptProjectInternal(files: Record<string, string>, options?: ParserParseOptions): Promise<IRProject> {
  const entries = filterTypeScriptEntries(files);
  if (entries.length === 0) {
    throw new Error('No TypeScript source files found in project. Provide at least one .ts/.tsx file.');
  }

  if (shouldUseWebTreeSitter(options)) {
    const config = options?.webTreeSitter;
    if (config && config.module) {
      try {
        return await parseWithWebTreeSitter(entries, config);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw error;
        }
        // continue to other strategies on initialization errors
      }
    }
  }

  if (shouldUseTreeSitter(options)) {
    try {
      const Parser = require('tree-sitter');
      const { typescript, tsx } = require('tree-sitter-typescript');
      const parserTs: ParserInstance = new Parser();
      parserTs.setLanguage(typescript);
      const parserTsx: ParserInstance | null = tsx ? (() => {
        const inst = new Parser();
        inst.setLanguage(tsx);
        return inst;
      })() : null;
      return parseWithTreeSitter(entries, parserTs, parserTsx, options?.runtime ?? 'node', 'tree-sitter', {
        grammar: 'tree-sitter-typescript',
        mode: 'native',
      });
    } catch (err: any) {
      if (!err || err.code !== 'MODULE_NOT_FOUND') {
        throw err;
      }
      // fall back to heuristics
    }
  }

  return parseWithFallback(entries);
}

function detectTypeScriptProject(files: Record<string, string>): ParserDetectionResult | null {
  const matched = Object.keys(files).filter((filePath) =>
    TS_EXTENSIONS.some((ext) => filePath.endsWith(ext))
  );
  if (matched.length === 0) return null;
  const reason = matched.length === 1
    ? `Found TypeScript file ${matched[0]}`
    : `Found ${matched.length} TypeScript files`;
  return {
    lang: 'typescript',
    confidence: 'high',
    reason,
    matchedFiles: matched.slice(0, 5),
  };
}

export async function parseTypeScriptProject(files: Record<string, string>, options?: ParserParseOptions): Promise<IRProject> {
  return await parseTypeScriptProjectInternal(files, options);
}

function parseWithTreeSitter(
  entries: FileEntry[],
  parserTs: ParserInstance,
  parserTsx: ParserInstance | null,
  runtime: ParserRuntime = 'node',
  implementation: ParserMeta['implementation'] = 'tree-sitter',
  details?: Record<string, unknown>,
): IRProject {
  const modules: Record<string, IRModule> = {};

  for (const [filePath, source] of entries) {
    const moduleName = moduleNameFromPath(filePath);
    const useTsx = filePath.endsWith('.tsx');
    const parser = useTsx && parserTsx ? parserTsx : parserTs;
    const tree = parser.parse(source);
    if (tree.rootNode && typeof tree.rootNode.hasError === 'function' && tree.rootNode.hasError()) {
      const errorNode = findFirstError(tree.rootNode);
      const line = errorNode ? errorNode.startPosition.row + 1 : 0;
      const column = errorNode ? errorNode.startPosition.column + 1 : 0;
      const where = line ? `:${line}:${column}` : '';
      throw new SyntaxError(`TypeScript syntax error detected while parsing ${filePath}${where}`);
    }

    const text = (node: any) => source.slice(node.startIndex, node.endIndex);
    const loc = (node: any) => ({
      file: filePath,
      line: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });

    const functions: IRFunction[] = [];
    const classes: IRClass[] = [];
    const importSet = new Set<string>();

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

    function addImport(value: string | undefined) {
      if (!value) return;
      const trimmed = value.trim();
      if (trimmed) {
        importSet.add(trimmed);
      }
    }

    function collectCalls(node: any, into: Set<string>) {
      if (!node) return;
      if (node.type === 'call_expression' || node.type === 'new_expression') {
        const callee = field(node, 'function') ?? field(node, 'constructor');
        const raw = callee ? text(callee) : text(node);
        const cleaned = raw.replace(/\s+/g, ' ').trim();
        if (cleaned) into.add(cleaned);
      }
      for (const child of node.namedChildren || []) {
        collectCalls(child, into);
      }
    }

    function extractParams(node: any | null | undefined): string[] {
      if (!node) return [];
      const raw = text(node);
      if (!raw) return [];
      const stripped = raw.replace(/^\(|\)$/g, '');
      return stripped.split(',').map((p) => p.trim()).filter(Boolean);
    }

    function createFunction(node: any, fallbackName: string | undefined, scope: 'module' | 'class'): IRFunction {
      const nameNode = field(node, 'name') ?? field(node, 'property');
      const baseName = nameNode ? text(nameNode) : fallbackName || 'anonymous';
      const paramsNode = field(node, 'parameters');
      let params = extractParams(paramsNode);
      if (params.length === 0) {
        const single = field(node, 'parameter');
        if (single) {
          params = [text(single).trim()];
        }
      }
      const calls = new Set<string>();
      const bodyNode = field(node, 'body');
      if (bodyNode) {
        collectCalls(bodyNode, calls);
      }
      const idBase = scope === 'class' && fallbackName ? `${fallbackName}.${baseName}` : baseName;
      return {
        id: `${moduleName}.${idBase}`,
        name: baseName,
        params,
        body: [],
        calls: Array.from(calls),
        pos: loc(node),
        doc: undefined,
      };
    }

    function handleVariableDeclarator(node: any) {
      const nameNode = field(node, 'name');
      const initializer = field(node, 'value') ?? field(node, 'initializer');
      const varName = nameNode ? text(nameNode) : undefined;
      if (!initializer) return;
      if (initializer.type === 'arrow_function' || initializer.type === 'function' || initializer.type === 'function_expression') {
        const fn = createFunction(initializer, varName ?? 'anonymous', 'module');
        if (varName) {
          fn.name = varName;
          fn.id = `${moduleName}.${varName}`;
        }
        functions.push(fn);
        return;
      }
      if (initializer.type === 'call_expression') {
        const callee = field(initializer, 'function');
        if (callee && text(callee).trim() === 'require') {
          const args = field(initializer, 'arguments');
          if (args) {
            const match = /['"]([^'"\\]+)['"]/g.exec(text(args));
            if (match) {
              addImport(stripQuotes(match[0]));
            }
          }
        }
      }
    }

    function createClass(node: any): IRClass {
      const nameNode = field(node, 'name');
      const className = nameNode ? text(nameNode) : 'AnonymousClass';
      const heritage = node.namedChildren?.find((child: any) => child.type === 'class_heritage');
      const bases = heritage ? stripQuotes(text(heritage).replace(/^(extends|implements)\s+/, '')).split(/[,]/)
        .map((b) => b.trim())
        .filter(Boolean)
        : [];
      const cls: IRClass = {
        id: `${moduleName}.${className}`,
        name: className,
        bases,
        attrs: [],
        methods: [],
        pos: loc(node),
        doc: undefined,
      };
      const bodyNode = field(node, 'body');
      for (const child of bodyNode?.namedChildren || []) {
        if (child.type === 'method_definition' || child.type === 'constructor' || child.type === 'method_signature') {
          const method = createFunction(child, className, 'class');
          cls.methods.push(method);
        }
      }
      return cls;
    }

    function visit(node: any): void {
      if (!node) return;
      switch (node.type) {
        case 'import_statement': {
          const srcNode = field(node, 'source');
          if (srcNode) {
            addImport(stripQuotes(text(srcNode)));
          } else {
            addImport(text(node));
          }
          return;
        }
        case 'import_require_clause': {
          const arg = node.child(1);
          if (arg) {
            addImport(stripQuotes(text(arg)));
          }
          return;
        }
        case 'class_declaration': {
          classes.push(createClass(node));
          return;
        }
        case 'function_declaration':
        case 'generator_function_declaration': {
          functions.push(createFunction(node, undefined, 'module'));
          return;
        }
        case 'lexical_declaration':
        case 'variable_declaration': {
          for (const child of node.namedChildren || []) {
            handleVariableDeclarator(child);
          }
          break;
        }
        case 'export_statement':
        case 'export_declaration':
        case 'export_default_declaration':
        case 'export_clause': {
          for (const child of node.namedChildren || []) {
            visit(child);
          }
          return;
        }
        default:
          break;
      }
      for (const child of node.namedChildren || []) {
        visit(child);
      }
    }

    visit(tree.rootNode);

    const requireRe = /require\((['"])([^'"\\]+)\1\)/g;
    let match: RegExpExecArray | null;
    while ((match = requireRe.exec(source))) {
      addImport(match[2]);
    }

    modules[moduleName] = {
      name: moduleName,
      path: filePath,
      classes,
      functions,
      imports: Array.from(importSet),
    };
  }

  const project: IRProject = { modules, fixNotes: [] };
  project.parserMeta = { implementation, runtime, details } satisfies ParserMeta;
  return project;
}

async function parseWithWebTreeSitter(entries: FileEntry[], config: WebTreeSitterConfig): Promise<IRProject> {
  const module = config.module;
  if (!module || typeof module.Parser !== 'function') {
    throw new Error('Invalid web-tree-sitter module provided for typescript parser.');
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
  const tsResult = await loadWebTreeSitterLanguage(module, state, config, 'typescript');
  let tsxResult: { language: any; source?: string } | null = null;
  try {
    tsxResult = await loadWebTreeSitterLanguage(module, state, config, 'tsx');
  } catch {
    tsxResult = null;
  }
  const parserTs: ParserInstance = new module.Parser();
  parserTs.setLanguage(tsResult.language);
  let parserTsx: ParserInstance | null = null;
  if (tsxResult?.language) {
    const tsxParser: ParserInstance = new module.Parser();
    tsxParser.setLanguage(tsxResult.language);
    parserTsx = tsxParser;
  }
  const details: Record<string, unknown> = { grammar: 'tree-sitter-typescript', mode: 'web' };
  if (tsResult.source) details.languageSource = tsResult.source;
  if (tsxResult?.source) details.languageSourceTsx = tsxResult.source;
  if (config.runtimeUrl) details.runtimeUrl = config.runtimeUrl;
  return parseWithTreeSitter(entries, parserTs, parserTsx, 'browser', 'web-tree-sitter', details);
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

function parseWithFallback(entries: FileEntry[]): IRProject {
  const modules: Record<string, IRModule> = {};
  for (const [filePath, source] of entries) {
    ensureTypeScriptSyntax(source, filePath);
    const moduleName = moduleNameFromPath(filePath);
    const functions: IRFunction[] = [];
    const classes: IRClass[] = [];
    const importSet = new Set<string>();

    const classRe = /(?:export\s+)?class\s+([A-Za-z0-9_$]+)(?:\s+(?:extends|implements)\s+([A-Za-z0-9_$. ,]+))?\s*\{/g;
    let classMatch: RegExpExecArray | null;
    while ((classMatch = classRe.exec(source))) {
      const name = classMatch[1];
      const bases = classMatch[2]
        ? classMatch[2].split(',').map((b) => b.trim()).filter(Boolean)
        : [];
      const classOpen = (classMatch.index ?? 0) + classMatch[0].length - 1;
      const classClose = findMatchingBrace(source, classOpen);
      if (classClose === -1) {
        continue;
      }
      const bodyStart = classOpen + 1;
      const body = source.slice(bodyStart, classClose);
      const cls: IRClass = {
        id: `${moduleName}.${name}`,
        name,
        bases,
        attrs: [],
        methods: [],
        pos: { file: filePath, line: lineNumberAt(source, classMatch.index ?? 0) },
        doc: undefined,
      };

      const methodRe = /(?:public\s+|private\s+|protected\s+|static\s+|async\s+|readonly\s+|abstract\s+|get\s+|set\s+)*([A-Za-z0-9_$]+)\s*\(([^)]*)\)\s*(?::\s*[A-Za-z0-9_$<>,\[\]\s]+)?\s*\{/g;
      let methodMatch: RegExpExecArray | null;
      while ((methodMatch = methodRe.exec(body))) {
        const methodName = methodMatch[1];
        const methodOpenInBody = methodMatch.index + methodMatch[0].length - 1;
        const methodOpen = bodyStart + methodOpenInBody;
        const methodClose = findMatchingBrace(source, methodOpen);
        const methodBody = methodClose === -1 ? '' : source.slice(methodOpen + 1, methodClose);
        const methodLine = lineNumberAt(source, bodyStart + methodMatch.index);
        const params = normalizeParams(methodMatch[2]);
        cls.methods.push({
          id: `${cls.id}.${methodName}`,
          name: methodName,
          params,
          body: [],
          calls: collectCallsByRegex(methodBody),
          pos: { file: filePath, line: methodLine },
          doc: undefined,
        });
      }

      classes.push(cls);
    }

    const funcRe = /(?:export\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)\s*(?::\s*[A-Za-z0-9_$<>,\[\]\s]+)?\s*\{/g;
    let funcMatch: RegExpExecArray | null;
    while ((funcMatch = funcRe.exec(source))) {
      const name = funcMatch[1];
      const funcOpen = (funcMatch.index ?? 0) + funcMatch[0].length - 1;
      const funcClose = findMatchingBrace(source, funcOpen);
      const funcBody = funcClose === -1 ? '' : source.slice(funcOpen + 1, funcClose);
      const params = normalizeParams(funcMatch[2]);
      const line = lineNumberAt(source, funcMatch.index ?? 0);
      functions.push({
        id: `${moduleName}.${name}`,
        name,
        params,
        body: [],
        calls: collectCallsByRegex(funcBody),
        pos: { file: filePath, line },
        doc: undefined,
      });
    }

    const arrowRe = /(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[A-Za-z0-9_$<>,\[\]\s]+)?\s*=>/g;
    let arrowMatch: RegExpExecArray | null;
    while ((arrowMatch = arrowRe.exec(source))) {
      const name = arrowMatch[1];
      const afterArrow = (arrowMatch.index ?? 0) + arrowMatch[0].length;
      const bodyOffset = skipWhitespace(source, afterArrow);
      const absoluteStart = afterArrow + bodyOffset;
      let body = '';
      if (source[absoluteStart] === '{') {
        const bodyClose = findMatchingBrace(source, absoluteStart);
        body = bodyClose === -1 ? '' : source.slice(absoluteStart + 1, bodyClose);
      } else {
        const end = findExpressionEnd(source, absoluteStart);
        body = source.slice(absoluteStart, end);
      }
      const params = normalizeParams(arrowMatch[2]);
      const line = lineNumberAt(source, arrowMatch.index ?? 0);
      functions.push({
        id: `${moduleName}.${name}`,
        name,
        params,
        body: [],
        calls: collectCallsByRegex(body),
        pos: { file: filePath, line },
        doc: undefined,
      });
    }

    const importRe = /import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"\\]+)['"]/g;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = importRe.exec(source))) {
      importSet.add(importMatch[1]);
    }

    const requireRe = /require\((['"])([^'"\\]+)\1\)/g;
    let requireMatch: RegExpExecArray | null;
    while ((requireMatch = requireRe.exec(source))) {
      importSet.add(requireMatch[2]);
    }

    modules[moduleName] = {
      name: moduleName,
      path: filePath,
      classes,
      functions,
      imports: Array.from(importSet),
    };
  }
  return { modules, fixNotes: [] };
}

function collectCallsByRegex(source: string): string[] {
  const calls = new Set<string>();
  const callRe = /([A-Za-z_$][A-Za-z0-9_$\.]*?)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = callRe.exec(source))) {
    const callee = match[1];
    if (!callee.startsWith('function') && !callee.startsWith('class')) {
      calls.add(callee);
    }
  }
  return Array.from(calls);
}

function ensureTypeScriptSyntax(source: string, filePath: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ts = require('typescript');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
      },
      fileName: filePath,
      reportDiagnostics: true,
    });
    const diagnostics = (result.diagnostics || []).filter(
      (diag: any) => diag.category === ts.DiagnosticCategory.Error
    );
    if (diagnostics.length > 0) {
      const diag = diagnostics[0];
      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
      if (diag.file && typeof diag.start === 'number') {
        const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
        const line = pos.line + 1;
        const column = pos.character + 1;
        throw new SyntaxError(
          `TypeScript syntax error detected while parsing ${filePath}:${line}:${column}: ${message}`
        );
      }
      throw new SyntaxError(
        `TypeScript syntax error detected while parsing ${filePath}: ${message}`
      );
    }
  } catch (err: any) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      ensureBalancedDelimiters(source, filePath);
      return;
    }
    if (err instanceof SyntaxError) {
      throw err;
    }
    throw err;
  }
}

function ensureBalancedDelimiters(source: string, filePath: string): void {
  const stack: string[] = [];
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let prev = '';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inSingle) {
      if (ch === '\'' && prev !== '\\') {
        inSingle = false;
      }
      prev = ch;
      continue;
    }
    if (inDouble) {
      if (ch === '"' && prev !== '\\') {
        inDouble = false;
      }
      prev = ch;
      continue;
    }
    if (inTemplate) {
      if (ch === '`' && prev !== '\\') {
        inTemplate = false;
        prev = ch;
        continue;
      }
      if (ch === '{') {
        stack.push('{');
      } else if (ch === '}') {
        if (stack.length === 0 || stack[stack.length - 1] !== '{') {
          throw new SyntaxError(
            `TypeScript syntax error detected while parsing ${filePath}: unmatched }`
          );
        }
        stack.pop();
      }
      prev = ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      prev = ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      prev = ch;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      prev = ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') {
      stack.push(ch);
      prev = ch;
      continue;
    }
    if (ch === ')' || ch === '}' || ch === ']') {
      const expected = ch === ')' ? '(' : ch === ']' ? '[' : '{';
      if (stack.length === 0 || stack[stack.length - 1] !== expected) {
        throw new SyntaxError(
          `TypeScript syntax error detected while parsing ${filePath}: unmatched ${ch}`
        );
      }
      stack.pop();
      prev = ch;
      continue;
    }
    prev = ch;
  }
  if (stack.length > 0) {
    throw new SyntaxError(
      `TypeScript syntax error detected while parsing ${filePath}: unmatched delimiters`
    );
  }
}

function normalizeParams(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((part) => {
      let cleaned = part.trim();
      if (!cleaned) return '';
      cleaned = cleaned.replace(/=[\s\S]*$/g, '').trim();
      const colonIndex = cleaned.indexOf(':');
      if (colonIndex !== -1) {
        cleaned = cleaned.slice(0, colonIndex).trim();
      }
      cleaned = cleaned.replace(/^\.\.\./, '').replace(/\?$/, '');
      const segments = cleaned.split(/\s+/);
      return segments[segments.length - 1] || '';
    })
    .filter(Boolean);
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function skipWhitespace(source: string, start: number): number {
  let offset = 0;
  while (start + offset < source.length) {
    const ch = source[start + offset];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      offset += 1;
      continue;
    }
    break;
  }
  return offset;
}

function findExpressionEnd(source: string, start: number): number {
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === ';') {
      return i;
    }
    if (ch === '\n') {
      return i;
    }
  }
  return source.length;
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === '\n') {
      line += 1;
    }
  }
  return line;
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

export const typescriptParserPlugin: ParserPlugin = {
  lang: 'typescript',
  version: TS_PLUGIN_VERSION,
  aliases: ['ts', 'tsx'],
  parseProject: parseTypeScriptProjectInternal,
  detect: detectTypeScriptProject,
  capabilities: {
    treeSitter: true,
    fallback: true,
    incremental: false,
  },
  treeSitterModule: 'tree-sitter-typescript',
};

export const parserPlugin = typescriptParserPlugin;

export default typescriptParserPlugin;
