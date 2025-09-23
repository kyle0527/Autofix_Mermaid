const PY_EXTENSIONS = ['.py', '.pyw', '.pyi'];
function relModuleName(p) {
    return p
        .replace(/\\/g, '/')
        .replace(/\.(?:py|pyw|pyi)$/i, '')
        .replace(/\/(?:__init__)?$/, '')
        .replace(/\//g, '.');
}
const PYTHON_PLUGIN_VERSION = '0.3.0';
const webTreeSitterStates = new WeakMap();
function getWebTreeSitterState(module) {
    let state = webTreeSitterStates.get(module);
    if (!state) {
        state = { initialized: false, languages: new Map() };
        webTreeSitterStates.set(module, state);
    }
    return state;
}
function shouldUseNodeTreeSitter(options) {
    if (options?.preferTreeSitter === false)
        return false;
    if (options?.runtime === 'browser')
        return false;
    return true;
}
function shouldUseWebTreeSitter(options) {
    if (options?.preferTreeSitter === false)
        return false;
    return options?.runtime === 'browser' && !!options?.webTreeSitter;
}
function filterPythonEntries(files) {
    return Object.entries(files).filter(([filePath]) => PY_EXTENSIONS.some((ext) => filePath.endsWith(ext)));
}
function toErrorMessage(err) {
    if (!err)
        return 'Unknown error';
    if (err instanceof Error && typeof err.message === 'string') {
        return err.message;
    }
    if (typeof err === 'object' && err && 'message' in err) {
        const msg = err.message;
        if (typeof msg === 'string')
            return msg;
    }
    try {
        return String(err);
    }
    catch {
        return 'Unknown error';
    }
}
async function parsePythonProjectInternal(files, options) {
    const entries = filterPythonEntries(files);
    if (entries.length === 0) {
        throw new Error('No Python source files found in project. Provide at least one .py file.');
    }
    const fallbackAttempts = [];
    if (shouldUseWebTreeSitter(options)) {
        const config = options?.webTreeSitter;
        if (config && config.module) {
            try {
                return await parseWithWebTreeSitter(entries, config);
            }
            catch (error) {
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
        }
        catch (e) {
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
function detectPythonProject(files) {
    const matched = Object.keys(files).filter((f) => PY_EXTENSIONS.some((ext) => f.endsWith(ext)));
    if (matched.length === 0)
        return null;
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
export async function parsePythonProject(files, options) {
    return await parsePythonProjectInternal(files, options);
}
function parseWithFallback(entries, runtime = 'node', details) {
    const modules = {};
    for (const [path, src] of entries) {
        const name = relModuleName(path);
        const functions = [];
        const classes = [];
        const imports = [];
        // imports
        const importRe = /^(?:from\s+([\w\.]+)\s+import\s+([\w\*\,\s]+)|import\s+([\w\.]+))/gm;
        let m;
        while ((m = importRe.exec(src))) {
            if (m[1])
                imports.push(`${m[1]}:${(m[2] || '').trim()}`);
            if (m[3])
                imports.push(m[3]);
        }
        // functions
        const funcRe = /^(\s*)def\s+(\w+)\s*\(([^\)]*)\)\s*:/gm;
        while ((m = funcRe.exec(src))) {
            const indent = m[1] ?? '';
            const fname = m[2];
            const params = (m[3] || '').split(',').map((s) => s.trim()).filter(Boolean);
            const start = funcRe.lastIndex;
            const { body } = extractPythonBlock(src, start, indent);
            const line = lineNumberAt(src, m.index ?? 0);
            const calls = collectPythonCalls(body);
            functions.push({
                id: `${name}.${fname}`,
                name: fname,
                params,
                body: [],
                calls,
                pos: { file: path, line },
                doc: '',
            });
        }
        // classes
        const classRe = /^\s*class\s+(\w+)\s*(?:\(([^\)]*)\))?\s*:/gm;
        while ((m = classRe.exec(src))) {
            const cname = m[1];
            const bases = (m[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
            const line = lineNumberAt(src, m.index ?? 0);
            classes.push({ id: `${name}.${cname}`, name: cname, bases, attrs: [], methods: [], pos: { file: path, line }, doc: '' });
        }
        modules[name] = { name, path, classes, functions, imports };
    }
    const project = { modules, fixNotes: [] };
    project.parserMeta = { implementation: 'fallback', runtime, details };
    return project;
}
function lineNumberAt(source, index) {
    let line = 1;
    const limit = Math.min(index, source.length);
    for (let i = 0; i < limit; i += 1) {
        if (source[i] === '\n') {
            line += 1;
        }
    }
    return line;
}
function extractPythonBlock(source, start, indent) {
    let index = start;
    let bodyEnd = start;
    const baseIndent = indent ?? '';
    while (index < source.length) {
        const newlineIndex = source.indexOf('\n', index);
        const lineEnd = newlineIndex === -1 ? source.length : newlineIndex + 1;
        const line = source.slice(index, lineEnd);
        const trimmed = line.trim();
        if (trimmed === '') {
            bodyEnd = lineEnd;
            index = lineEnd;
            continue;
        }
        const leading = line.match(/^(\s*)/)?.[1] ?? '';
        const isIndented = baseIndent.length === 0
            ? leading.length > 0
            : leading.startsWith(baseIndent) && leading.length >= baseIndent.length;
        if (!isIndented) {
            break;
        }
        bodyEnd = lineEnd;
        index = lineEnd;
    }
    return { body: source.slice(start, bodyEnd) };
}
const PYTHON_CALL_KEYWORDS = new Set([
    'def',
    'class',
    'if',
    'elif',
    'else',
    'for',
    'while',
    'with',
    'return',
    'yield',
    'await',
    'async',
    'lambda',
    'try',
    'except',
    'finally',
    'assert',
    'raise',
]);
function collectPythonCalls(body) {
    const calls = new Set();
    const callRe = /([A-Za-z_][A-Za-z0-9_\.]*)\s*\(/g;
    let match;
    while ((match = callRe.exec(body))) {
        const callee = match[1];
        if (!callee || PYTHON_CALL_KEYWORDS.has(callee)) {
            continue;
        }
        calls.add(callee);
    }
    return Array.from(calls);
}
export const pythonParserPlugin = {
    lang: 'python',
    version: PYTHON_PLUGIN_VERSION,
    aliases: ['py'],
    parseProject: (files, options) => parsePythonProjectInternal(files, options),
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
function parseWithTreeSitter(Parser, Python, entries, runtime = 'node') {
    const parser = new Parser();
    parser.setLanguage(Python);
    const details = { grammar: 'tree-sitter-python', mode: 'native' };
    return buildProjectFromParser(entries, () => parser, runtime, 'tree-sitter', details);
}
async function parseWithWebTreeSitter(entries, config) {
    const module = config.module;
    if (!module || typeof module.Parser !== 'function') {
        throw new Error('Invalid web-tree-sitter module provided for python parser.');
    }
    const state = getWebTreeSitterState(module);
    if (!state.initialized) {
        if (typeof module.init === 'function') {
            const initOptions = {};
            if (typeof config.locateFile === 'function') {
                initOptions.locateFile = config.locateFile;
            }
            else if (config.runtimeUrl) {
                initOptions.locateFile = (scriptName, scriptDirectory) => {
                    if (scriptName === 'tree-sitter.wasm') {
                        return config.runtimeUrl;
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
    const details = { grammar: 'tree-sitter-python', mode: 'web' };
    if (source)
        details.languageSource = source;
    if (config.runtimeUrl)
        details.runtimeUrl = config.runtimeUrl;
    return buildProjectFromParser(entries, () => parserInstance, 'browser', 'web-tree-sitter', details);
}
function deriveLanguageUrl(runtimeUrl, lang) {
    if (typeof runtimeUrl !== 'string')
        return undefined;
    if (runtimeUrl.includes('tree-sitter.wasm')) {
        return runtimeUrl.replace(/tree-sitter\.wasm(?:\?.*)?$/i, `tree-sitter-${lang}.wasm`);
    }
    return undefined;
}
async function loadWebTreeSitterLanguage(module, state, config, lang) {
    const cached = state.languages.get(lang);
    if (cached) {
        return { language: cached, source: 'cache' };
    }
    let language;
    let source;
    const entry = config.languages?.[lang];
    if (typeof entry === 'string') {
        language = await module.Language.load(entry);
        source = entry;
    }
    else if (entry && typeof entry === 'object') {
        if (entry.language) {
            language = entry.language;
            source = 'provided';
        }
        else if (entry.load) {
            language = await entry.load();
            source = 'loader';
        }
        else if (entry.url) {
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
function buildProjectFromParser(entries, parserFactory, runtime, implementation, details) {
    const modules = {};
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
        const functions = [];
        const classes = [];
        const imports = [];
        const text = (node) => src.slice(node.startIndex, node.endIndex);
        const loc = (node) => ({ file: path, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
        const field = (node, key) => {
            if (!node)
                return null;
            if (typeof node.childForFieldName === 'function') {
                const result = node.childForFieldName(key);
                if (result)
                    return result;
            }
            const direct = node[`${key}Node`];
            if (direct)
                return direct;
            return null;
        };
        const fieldList = (node, key) => {
            if (!node)
                return [];
            const plural = node[`${key}Nodes`];
            if (Array.isArray(plural))
                return plural;
            const single = field(node, key);
            return single ? [single] : [];
        };
        function toFunction(node, filePath, modName) {
            const nameNode = field(node, 'name');
            const paramsNode = field(node, 'parameters');
            const fname = nameNode ? text(nameNode) : 'func';
            const params = paramsNode
                ? text(paramsNode).replace(/[()]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
                : [];
            const bodyNode = field(node, 'body');
            const body = [];
            const calls = [];
            function stmt(n) {
                switch (n.type) {
                    case 'if_statement': {
                        const cond = field(n, 'condition');
                        const cons = field(n, 'consequence');
                        const alternatives = fieldList(n, 'alternative');
                        const then = [];
                        const els = [];
                        if (cons)
                            for (const c of cons.namedChildren || []) {
                                const s = stmt(c);
                                if (s)
                                    then.push(s);
                            }
                        for (const alt of alternatives) {
                            for (const c of alt.namedChildren || []) {
                                const s = stmt(c);
                                if (s)
                                    els.push(s);
                            }
                        }
                        return { kind: 'if', text: text(n), pos: loc(n), cond: cond ? text(cond) : '', then, else: els.length ? els : undefined };
                    }
                    case 'for_statement': {
                        const t = field(n, 'left');
                        const it = field(n, 'right');
                        const b = field(n, 'body');
                        const bodyStatements = [];
                        if (b)
                            for (const c of b.namedChildren || []) {
                                const s = stmt(c);
                                if (s)
                                    bodyStatements.push(s);
                            }
                        return { kind: 'for', text: text(n), pos: loc(n), target: t ? text(t) : '', iter: it ? text(it) : '', body: bodyStatements };
                    }
                    case 'while_statement': {
                        const cond = field(n, 'condition');
                        const b = field(n, 'body');
                        const bodyStatements = [];
                        if (b)
                            for (const c of b.namedChildren || []) {
                                const s = stmt(c);
                                if (s)
                                    bodyStatements.push(s);
                            }
                        return { kind: 'while', text: text(n), pos: loc(n), cond: cond ? text(cond) : '', body: bodyStatements };
                    }
                    case 'try_statement': {
                        const b = field(n, 'body');
                        const handlers = n.namedChildren?.filter((x) => x.type === 'except_clause') || [];
                        const fin = n.namedChildren?.find((x) => x.type === 'finally_clause');
                        const bodyStatements = [];
                        if (b)
                            for (const c of b.namedChildren || []) {
                                const s = stmt(c);
                                if (s)
                                    bodyStatements.push(s);
                            }
                        const excepts = handlers.map((h) => {
                            const typ = field(h, 'type');
                            const name = field(h, 'name');
                            const bodyNode = field(h, 'body');
                            const hb = [];
                            if (bodyNode)
                                for (const c of bodyNode.namedChildren || []) {
                                    const s = stmt(c);
                                    if (s)
                                        hb.push(s);
                                }
                            return { type: typ ? text(typ) : undefined, name: name ? text(name) : undefined, body: hb };
                        });
                        let finallyBody;
                        if (fin) {
                            const bnode = field(fin, 'body');
                            const fb = [];
                            if (bnode)
                                for (const c of bnode.namedChildren || []) {
                                    const s = stmt(c);
                                    if (s)
                                        fb.push(s);
                                }
                            finallyBody = fb;
                        }
                        return { kind: 'try', text: text(n), pos: loc(n), body: bodyStatements, excepts, finally: finallyBody };
                    }
                    case 'return_statement': return { kind: 'return', text: text(n), pos: loc(n) };
                    case 'raise_statement': return { kind: 'raise', text: text(n), pos: loc(n) };
                    case 'break_statement': return { kind: 'break', text: text(n), pos: loc(n) };
                    case 'continue_statement': return { kind: 'continue', text: text(n), pos: loc(n) };
                    case 'expression_statement': {
                        const s = text(n);
                        for (const mm of s.matchAll(/([A-Za-z_][A-Za-z0-9_\.]+)\s*\(/g)) {
                            calls.push(mm[1]);
                        }
                        return { kind: 'expr', text: s, pos: loc(n) };
                    }
                    case 'assignment': {
                        return { kind: 'assign', text: text(n), pos: loc(n) };
                    }
                }
                return null;
            }
            if (bodyNode) {
                for (const child of bodyNode.namedChildren || []) {
                    const s = stmt(child);
                    if (s)
                        body.push(s);
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
        function walk(node) {
            const typ = node.type;
            if (typ === 'import_statement' || typ === 'import_from_statement') {
                imports.push(text(node).replace(/^\s+|\s+$/g, ''));
            }
            if (typ === 'class_definition') {
                const nameNode = field(node, 'name');
                const basesNode = field(node, 'superclasses');
                const cname = nameNode ? text(nameNode) : 'Class';
                const bases = basesNode
                    ? text(basesNode).replace(/[()]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
                    : [];
                const cls = { id: `${name}.${cname}`, name: cname, bases, attrs: [], methods: [], pos: loc(node), doc: '' };
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
    const project = { modules, fixNotes: [] };
    project.parserMeta = { implementation, runtime, details: metaDetails };
    return project;
}
function findFirstError(node) {
    if (!node)
        return null;
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
