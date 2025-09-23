"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parserPlugin = exports.javascriptParserPlugin = void 0;
exports.parseJavaScriptProject = parseJavaScriptProject;
const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs'];
const JS_PLUGIN_VERSION = '0.3.0';
const webTreeSitterStates = new WeakMap();
function getWebTreeSitterState(module) {
    let state = webTreeSitterStates.get(module);
    if (!state) {
        state = { initialized: false, languages: new Map() };
        webTreeSitterStates.set(module, state);
    }
    return state;
}
function moduleNameFromPath(p) {
    return p
        .replace(/\\/g, '/')
        .replace(/\.[^.]+$/i, '')
        .replace(/\//g, '.');
}
function shouldUseTreeSitter(options) {
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
function filterJavaScriptEntries(files) {
    return Object.entries(files).filter(([filePath]) => JS_EXTENSIONS.some((ext) => filePath.endsWith(ext)));
}
function stripQuotes(text) {
    return text.replace(/^['"]|['"]$/g, '');
}
async function parseJavaScriptProjectInternal(files, options) {
    const entries = filterJavaScriptEntries(files);
    if (entries.length === 0) {
        throw new Error('No JavaScript source files found in project. Provide at least one .js/.jsx/.mjs/.cjs file.');
    }
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
                // fall through to other strategies on initialization errors
            }
        }
    }
    if (shouldUseTreeSitter(options)) {
        try {
            const Parser = require('tree-sitter');
            const JavaScript = require('tree-sitter-javascript');
            return parseWithTreeSitter(Parser, JavaScript, entries, options?.runtime ?? 'node', 'tree-sitter', {
                grammar: 'tree-sitter-javascript',
                mode: 'native',
            });
        }
        catch (err) {
            if (!err || err.code !== 'MODULE_NOT_FOUND') {
                throw err;
            }
            // fall through to fallback parser
        }
    }
    return parseWithFallback(entries);
}
function detectJavaScriptProject(files) {
    const matched = Object.keys(files).filter((filePath) => JS_EXTENSIONS.some((ext) => filePath.endsWith(ext)));
    if (matched.length === 0)
        return null;
    const reason = matched.length === 1
        ? `Found JavaScript file ${matched[0]}`
        : `Found ${matched.length} JavaScript files`;
    return {
        lang: 'javascript',
        confidence: 'high',
        reason,
        matchedFiles: matched.slice(0, 5),
    };
}
async function parseJavaScriptProject(files, options) {
    return await parseJavaScriptProjectInternal(files, options);
}
function parseWithTreeSitter(Parser, JavaScript, entries, runtime = 'node', implementation = 'tree-sitter', details) {
    const parser = new Parser();
    parser.setLanguage(JavaScript);
    const modules = {};
    for (const [filePath, source] of entries) {
        const moduleName = moduleNameFromPath(filePath);
        const tree = parser.parse(source);
        if (tree.rootNode && typeof tree.rootNode.hasError === 'function' && tree.rootNode.hasError()) {
            const errorNode = findFirstError(tree.rootNode);
            const line = errorNode ? errorNode.startPosition.row + 1 : 0;
            const column = errorNode ? errorNode.startPosition.column + 1 : 0;
            const where = line ? `:${line}:${column}` : '';
            throw new SyntaxError(`JavaScript syntax error detected while parsing ${filePath}${where}`);
        }
        const text = (node) => source.slice(node.startIndex, node.endIndex);
        const loc = (node) => ({
            file: filePath,
            line: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
        });
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
        const functions = [];
        const classes = [];
        const importSet = new Set();
        function addFunction(fn) {
            if (!functions.some((existing) => existing.id === fn.id)) {
                functions.push(fn);
            }
        }
        function addClass(cls) {
            classes.push(cls);
        }
        function addImport(spec) {
            if (!spec)
                return;
            const trimmed = spec.trim();
            if (trimmed) {
                importSet.add(trimmed);
            }
        }
        function collectCalls(node, into) {
            if (!node)
                return;
            if (node.type === 'call_expression' || node.type === 'new_expression') {
                const callee = field(node, 'function') ?? field(node, 'constructor');
                const raw = callee ? text(callee) : text(node);
                const cleaned = raw.replace(/\s+/g, ' ').trim();
                if (cleaned)
                    into.add(cleaned);
            }
            for (const child of node.namedChildren || []) {
                collectCalls(child, into);
            }
        }
        function extractParams(node) {
            if (!node)
                return [];
            const raw = text(node);
            if (!raw)
                return [];
            const stripped = raw.replace(/^\(|\)$/g, '');
            return stripped.split(',').map((p) => p.trim()).filter(Boolean);
        }
        function createFunction(node, fallbackName, scope) {
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
            const calls = new Set();
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
        function handleVariableDeclarator(node) {
            const nameNode = field(node, 'name');
            const valueNode = field(node, 'value') ?? field(node, 'initializer');
            const varName = nameNode ? text(nameNode) : undefined;
            if (!valueNode)
                return;
            if (valueNode.type === 'arrow_function' || valueNode.type === 'function' || valueNode.type === 'function_expression') {
                const fn = createFunction(valueNode, varName ?? 'anonymous', 'module');
                if (varName) {
                    fn.name = varName;
                    fn.id = `${moduleName}.${varName}`;
                }
                addFunction(fn);
                return;
            }
            if (valueNode.type === 'call_expression') {
                const callee = field(valueNode, 'function');
                if (callee && text(callee).trim() === 'require') {
                    const args = field(valueNode, 'arguments');
                    if (args) {
                        const match = /['"]([^'"\\]+)['"]/g.exec(text(args));
                        if (match) {
                            addImport(stripQuotes(match[0]));
                        }
                    }
                }
            }
        }
        function createClass(node) {
            const nameNode = field(node, 'name');
            const className = nameNode ? text(nameNode) : 'AnonymousClass';
            const heritage = node.namedChildren?.find((child) => child.type === 'class_heritage');
            const bases = heritage
                ? stripQuotes(text(heritage).replace(/^extends\s+/, '')).split(',').map((b) => b.trim()).filter(Boolean)
                : [];
            const cls = {
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
                if (child.type === 'method_definition' || child.type === 'constructor') {
                    const method = createFunction(child, className, 'class');
                    cls.methods.push(method);
                }
            }
            return cls;
        }
        function visit(node) {
            if (!node)
                return;
            switch (node.type) {
                case 'import_statement': {
                    const srcNode = field(node, 'source');
                    if (srcNode) {
                        addImport(stripQuotes(text(srcNode)));
                    }
                    else {
                        addImport(text(node));
                    }
                    return;
                }
                case 'class_declaration': {
                    addClass(createClass(node));
                    return;
                }
                case 'function_declaration':
                case 'generator_function_declaration': {
                    addFunction(createFunction(node, undefined, 'module'));
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
        // Also capture bare require() usages that may not be top-level assignments.
        const requireRe = /require\((['"])([^'"\\]+)\1\)/g;
        let match;
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
    const project = { modules, fixNotes: [] };
    project.parserMeta = { implementation, runtime, details };
    return project;
}
async function parseWithWebTreeSitter(entries, config) {
    const module = config.module;
    if (!module || typeof module.Parser !== 'function') {
        throw new Error('Invalid web-tree-sitter module provided for javascript parser.');
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
    const { language, source } = await loadWebTreeSitterLanguage(module, state, config, 'javascript');
    const details = { grammar: 'tree-sitter-javascript', mode: 'web' };
    if (source)
        details.languageSource = source;
    if (config.runtimeUrl)
        details.runtimeUrl = config.runtimeUrl;
    return parseWithTreeSitter(module.Parser, language, entries, 'browser', 'web-tree-sitter', details);
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
function parseWithFallback(entries) {
    const modules = {};
    for (const [filePath, source] of entries) {
        ensureJavaScriptSyntax(source, filePath);
        const moduleName = moduleNameFromPath(filePath);
        const functions = [];
        const classes = [];
        const importSet = new Set();
        const classRe = /(?:export\s+)?class\s+([A-Za-z0-9_$]+)(?:\s+extends\s+([A-Za-z0-9_$.]+))?\s*\{/g;
        let classMatch;
        while ((classMatch = classRe.exec(source))) {
            const name = classMatch[1];
            const bases = classMatch[2] ? classMatch[2].split(',').map((b) => b.trim()).filter(Boolean) : [];
            const classOpen = (classMatch.index ?? 0) + classMatch[0].length - 1;
            const classClose = findMatchingBrace(source, classOpen);
            if (classClose === -1) {
                continue;
            }
            const classBodyStart = classOpen + 1;
            const classBody = source.slice(classBodyStart, classClose);
            const cls = {
                id: `${moduleName}.${name}`,
                name,
                bases,
                attrs: [],
                methods: [],
                pos: { file: filePath, line: lineNumberAt(source, classMatch.index ?? 0) },
                doc: undefined,
            };
            const methodRe = /(?:public\s+|private\s+|protected\s+|static\s+|async\s+|readonly\s+|get\s+|set\s+)*([A-Za-z0-9_$]+)\s*\(([^)]*)\)\s*\{/g;
            let methodMatch;
            while ((methodMatch = methodRe.exec(classBody))) {
                const methodName = methodMatch[1];
                const methodOpenInBody = methodMatch.index + methodMatch[0].length - 1;
                const methodOpen = classBodyStart + methodOpenInBody;
                const methodClose = findMatchingBrace(source, methodOpen);
                const methodBody = methodClose === -1 ? '' : source.slice(methodOpen + 1, methodClose);
                const methodLine = lineNumberAt(source, classBodyStart + methodMatch.index);
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
        const funcRe = /(?:export\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)\s*\{/g;
        let funcMatch;
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
        const arrowRe = /(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
        let arrowMatch;
        while ((arrowMatch = arrowRe.exec(source))) {
            const name = arrowMatch[1];
            const afterArrow = (arrowMatch.index ?? 0) + arrowMatch[0].length;
            const bodyStart = skipWhitespace(source, afterArrow);
            const absoluteBodyStart = afterArrow + bodyStart;
            let body = '';
            if (source[absoluteBodyStart] === '{') {
                const bodyClose = findMatchingBrace(source, absoluteBodyStart);
                body = bodyClose === -1 ? '' : source.slice(absoluteBodyStart + 1, bodyClose);
            }
            else {
                const end = findExpressionEnd(source, absoluteBodyStart);
                body = source.slice(absoluteBodyStart, end);
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
        const importRe = /import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"\\]+)['"]/g;
        let importMatch;
        while ((importMatch = importRe.exec(source))) {
            importSet.add(importMatch[1]);
        }
        const requireRe = /require\((['"])([^'"\\]+)\1\)/g;
        let requireMatch;
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
function collectCallsByRegex(source) {
    const calls = new Set();
    const callRe = /([A-Za-z_$][A-Za-z0-9_$\.]*?)\s*\(/g;
    let match;
    while ((match = callRe.exec(source))) {
        const callee = match[1];
        if (!callee.startsWith('function') && !callee.startsWith('class')) {
            calls.add(callee);
        }
    }
    return Array.from(calls);
}
function ensureJavaScriptSyntax(source, filePath) {
    const sanitized = sanitizeJavaScriptForEval(source);
    try {
        // eslint-disable-next-line no-new-func
        new Function('"use strict";\n' + sanitized);
    }
    catch (err) {
        const message = err && typeof err.message === 'string' ? `: ${err.message}` : '';
        throw new SyntaxError(`JavaScript syntax error detected while parsing ${filePath}${message}`);
    }
}
function sanitizeJavaScriptForEval(source) {
    return source
        .replace(/^[ \t]*import[\s\S]*?;[ \t]*$/gm, ';')
        .replace(/^[ \t]*export\s+default\s+/gm, '')
        .replace(/^[ \t]*export\s+(?=(?:async\s+)?(?:function|class|const|let|var))/gm, '')
        .replace(/^[ \t]*export\s+\{[\s\S]*?\};?[ \t]*$/gm, ';')
        .replace(/^[ \t]*export\s+\*[^;]*;?[ \t]*$/gm, ';');
}
function normalizeParams(raw) {
    if (!raw.trim())
        return [];
    return raw
        .split(',')
        .map((part) => {
        let cleaned = part.trim();
        if (!cleaned)
            return '';
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
function findMatchingBrace(source, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '{') {
            depth += 1;
        }
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}
function skipWhitespace(source, start) {
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
function findExpressionEnd(source, start) {
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
function lineNumberAt(source, index) {
    let line = 1;
    for (let i = 0; i < index && i < source.length; i += 1) {
        if (source[i] === '\n') {
            line += 1;
        }
    }
    return line;
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
exports.javascriptParserPlugin = {
    lang: 'javascript',
    version: JS_PLUGIN_VERSION,
    aliases: ['js', 'jsx'],
    parseProject: parseJavaScriptProjectInternal,
    detect: detectJavaScriptProject,
    capabilities: {
        treeSitter: true,
        fallback: true,
        incremental: false,
    },
    treeSitterModule: 'tree-sitter-javascript',
};
exports.parserPlugin = exports.javascriptParserPlugin;
exports.default = exports.javascriptParserPlugin;
