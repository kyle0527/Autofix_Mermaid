"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFallbackParserPlugin = createFallbackParserPlugin;
const node_path_1 = __importDefault(require("node:path"));
const FALLBACK_PLUGIN_VERSION = '0.1.0';
const FALLBACK_EXTENSION_MAP = {
    java: ['.java'],
    go: ['.go'],
    csharp: ['.cs'],
    'c#': ['.cs'],
    c: ['.c', '.h'],
    cpp: ['.cc', '.cpp', '.cxx', '.hh', '.hpp'],
    'c++': ['.cc', '.cpp', '.cxx', '.hh', '.hpp'],
    'objective-c': ['.m', '.mm'],
    objc: ['.m', '.mm'],
    swift: ['.swift'],
    rust: ['.rs'],
    php: ['.php'],
    ruby: ['.rb'],
    kotlin: ['.kt', '.kts'],
    scala: ['.scala'],
    dart: ['.dart'],
    elixir: ['.ex', '.exs'],
    erlang: ['.erl', '.hrl'],
    haskell: ['.hs'],
    ocaml: ['.ml', '.mli'],
    zig: ['.zig'],
    nim: ['.nim'],
    julia: ['.jl'],
};
const KEYWORD_EXCLUSIONS = new Set([
    'if',
    'for',
    'while',
    'switch',
    'catch',
    'try',
    'else',
    'case',
    'default',
    'with',
    'match',
    'when',
    'loop',
    'macro',
    'typedef',
    'template',
    'function',
    'class',
    'struct',
    'enum',
]);
const FUNCTION_PATTERNS = [
    {
        regex: /\bfunc\s+(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)[^{]*\{/gm,
        body: 'brace',
    },
    {
        regex: /\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)[^{]*\{/gm,
        body: 'brace',
    },
    {
        regex: /\bfunc\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)[^{]*\{/gm,
        body: 'brace',
    },
    {
        regex: /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{/gm,
        body: 'brace',
    },
    {
        regex: /(?:public|protected|private|internal|static|final|async|inline|virtual|override|export|extern|constexpr|friend|mutable|sealed|partial|abstract|synchronized|native|constexpr|using|typename|operator|struct|class|enum|@\w+\s+)*([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:const\s*)?(?:->[^\{\n]+)?\s*\{/gm,
        body: 'brace',
    },
    {
        regex: /\bdef\s+([A-Za-z_][A-Za-z0-9_!?=]*)\s*(?:\(([^)]*)\))?/gm,
        body: 'none',
    },
];
const CLASS_PATTERNS = [
    /(?:public|protected|private|internal|static|final|abstract|sealed|partial|open|data|@\w+\s+)*(class|struct|interface|enum)\s+([A-Za-z_][A-Za-z0-9_<>]*)[^\{;]*\{/gm,
    /type\s+([A-Za-z_][A-Za-z0-9_]*)\s+struct\s*\{/gm,
    /(?:pub\s+)?struct\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm,
    /(?:pub\s+)?enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm,
    /\bclass\s+([A-Za-z_][A-Za-z0-9_:]*)\b/gm,
];
function moduleNameFromPath(filePath) {
    return filePath
        .replace(/\\/g, '/')
        .replace(/\.[^.]+$/i, '')
        .replace(/\//g, '.');
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
function normalizeParams(raw) {
    if (!raw)
        return [];
    return raw
        .split(',')
        .map((segment) => {
        let cleaned = segment.trim();
        if (!cleaned)
            return '';
        cleaned = cleaned.replace(/=[^,]+$/, '').trim();
        const colonIndex = cleaned.indexOf(':');
        if (colonIndex !== -1) {
            cleaned = cleaned.slice(0, colonIndex).trim();
        }
        cleaned = cleaned.replace(/^\.\.\./, '').replace(/\?$/, '');
        const parts = cleaned.split(/\s+/);
        return parts[parts.length - 1] || '';
    })
        .filter(Boolean);
}
function collectCalls(body) {
    const calls = new Set();
    const callRe = /([A-Za-z_][A-Za-z0-9_\.]*?)\s*\(/g;
    let match;
    while ((match = callRe.exec(body))) {
        const callee = match[1];
        if (!callee || KEYWORD_EXCLUSIONS.has(callee))
            continue;
        calls.add(callee);
    }
    return Array.from(calls);
}
function extractBases(header) {
    const bases = new Set();
    const extendsMatch = header.match(/extends\s+([^\{\n]+)/);
    if (extendsMatch) {
        extendsMatch[1]
            .split(/[,\s]+/)
            .map((part) => part.trim())
            .filter(Boolean)
            .forEach((base) => bases.add(base));
    }
    const implementsMatch = header.match(/implements\s+([^\{\n]+)/);
    if (implementsMatch) {
        implementsMatch[1]
            .split(/[,\s]+/)
            .map((part) => part.trim())
            .filter(Boolean)
            .forEach((base) => bases.add(base));
    }
    const colonMatch = header.match(/:\s*([^\{\n]+)/);
    if (colonMatch) {
        colonMatch[1]
            .split(/[,\s]+/)
            .map((part) => part.trim())
            .filter(Boolean)
            .forEach((base) => bases.add(base));
    }
    const inheritsMatch = header.match(/inherits\s+([^\{\n]+)/);
    if (inheritsMatch) {
        inheritsMatch[1]
            .split(/[,\s]+/)
            .map((part) => part.trim())
            .filter(Boolean)
            .forEach((base) => bases.add(base));
    }
    return Array.from(bases);
}
function extractImports(source) {
    const imports = new Set();
    const simpleImportRe = /import\s+(?:[^;\n]+?\s+from\s+)?['"]([^'"\\]+)['"]/g;
    let match;
    while ((match = simpleImportRe.exec(source))) {
        imports.add(match[1]);
    }
    const bareImportRe = /import\s+([A-Za-z0-9_\.\*]+)\s*;/g;
    while ((match = bareImportRe.exec(source))) {
        imports.add(match[1]);
    }
    const usingRe = /using\s+([A-Za-z0-9_\.]+)\s*;/g;
    while ((match = usingRe.exec(source))) {
        imports.add(match[1]);
    }
    const includeRe = /#include\s+[<"]([^>"]+)[>"]/g;
    while ((match = includeRe.exec(source))) {
        imports.add(match[1]);
    }
    const requireRe = /require\s*\(\s*['"]([^'"\\]+)['"]\s*\)/g;
    while ((match = requireRe.exec(source))) {
        imports.add(match[1]);
    }
    const useRe = /use\s+([A-Za-z0-9_\\]+)\s*;/g;
    while ((match = useRe.exec(source))) {
        imports.add(match[1]);
    }
    const goBlockRe = /import\s*\(([^)]+)\)/g;
    while ((match = goBlockRe.exec(source))) {
        const block = match[1];
        const inner = block.match(/['"]([^'"\\]+)['"]/g) || [];
        for (const spec of inner) {
            const cleaned = spec.replace(/^['"]|['"]$/g, '');
            if (cleaned)
                imports.add(cleaned);
        }
    }
    const goSingleRe = /import\s+['"]([^'"\\]+)['"]/g;
    while ((match = goSingleRe.exec(source))) {
        imports.add(match[1]);
    }
    return Array.from(imports);
}
function isIndexWithinRanges(index, ranges) {
    if (!ranges || ranges.length === 0) {
        return false;
    }
    for (const range of ranges) {
        if (index >= range.start && index < range.end) {
            return true;
        }
    }
    return false;
}
function extractFunctions(source, context) {
    const results = new Map();
    for (const pattern of FUNCTION_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(source))) {
            const name = (match[1] || '').trim();
            if (!name || KEYWORD_EXCLUSIONS.has(name)) {
                continue;
            }
            const paramsRaw = match[2] || '';
            const params = normalizeParams(paramsRaw);
            const relativeIndex = match.index ?? 0;
            const absoluteIndex = (context.absoluteOffset ?? 0) + relativeIndex;
            if (isIndexWithinRanges(absoluteIndex, context.excludeRanges)) {
                continue;
            }
            const line = lineNumberAt(context.parentSource, absoluteIndex);
            let endLine;
            let body = '';
            if (pattern.body === 'brace') {
                const localBrace = source.indexOf('{', relativeIndex + match[0].length - 1);
                if (localBrace !== -1) {
                    const absoluteBrace = (context.absoluteOffset ?? 0) + localBrace;
                    const closeIndex = findMatchingBrace(context.parentSource, absoluteBrace);
                    if (closeIndex !== -1) {
                        body = context.parentSource.slice(absoluteBrace + 1, closeIndex);
                        endLine = lineNumberAt(context.parentSource, closeIndex);
                    }
                    else {
                        body = context.parentSource.slice(absoluteBrace + 1);
                    }
                }
            }
            const calls = collectCalls(body);
            const baseId = context.scope === 'class' && context.className
                ? `${context.className}.${name}`
                : name;
            const id = `${context.moduleName}.${baseId}`;
            if (results.has(id))
                continue;
            results.set(id, {
                id,
                name,
                params,
                body: [],
                calls,
                pos: { file: context.filePath, line, endLine },
                doc: undefined,
            });
        }
    }
    return Array.from(results.values());
}
function parseModule(filePath, source, lang, moduleName) {
    const moduleFunctions = new Map();
    const classRanges = [];
    const classMap = new Map();
    for (const pattern of CLASS_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(source))) {
            const raw = match[0];
            const name = (match[2] || match[1] || '').trim();
            if (!name)
                continue;
            const classIndex = match.index ?? 0;
            const braceIndex = source.indexOf('{', classIndex + raw.length - 1);
            if (braceIndex === -1) {
                continue;
            }
            const classBodyEnd = findMatchingBrace(source, braceIndex);
            const bodyEnd = classBodyEnd === -1 ? source.length : classBodyEnd;
            const classBody = source.slice(braceIndex + 1, bodyEnd);
            const classLine = lineNumberAt(source, classIndex);
            const classId = `${moduleName}.${name}`;
            if (classMap.has(classId)) {
                continue;
            }
            const methods = extractFunctions(classBody, {
                moduleName,
                filePath,
                parentSource: source,
                scope: 'class',
                className: name,
                absoluteOffset: braceIndex + 1,
            });
            const bases = extractBases(raw);
            classRanges.push({ start: braceIndex + 1, end: bodyEnd });
            classMap.set(classId, {
                id: classId,
                name,
                bases,
                attrs: [],
                methods,
                pos: { file: filePath, line: classLine },
                doc: undefined,
            });
        }
    }
    const moduleContext = {
        moduleName,
        filePath,
        parentSource: source,
        scope: 'module',
        absoluteOffset: 0,
        excludeRanges: classRanges,
    };
    for (const fn of extractFunctions(source, moduleContext)) {
        moduleFunctions.set(fn.id, fn);
    }
    const classes = Array.from(classMap.values());
    const imports = extractImports(source);
    return {
        name: moduleName,
        path: filePath,
        classes,
        functions: Array.from(moduleFunctions.values()),
        imports,
    };
}
function filterEntries(files, lang, extensions) {
    const extSet = new Set((extensions && extensions.length ? extensions : FALLBACK_EXTENSION_MAP[lang] || []).map((ext) => ext.toLowerCase()));
    const entries = [];
    for (const [filePath, source] of Object.entries(files)) {
        if (extSet.size === 0) {
            entries.push([filePath, source]);
            continue;
        }
        const ext = node_path_1.default.extname(filePath).toLowerCase();
        if (extSet.has(ext)) {
            entries.push([filePath, source]);
        }
    }
    if (entries.length === 0) {
        return Object.entries(files);
    }
    return entries;
}
function buildParserMeta(lang, runtime, extensions) {
    const details = { lang };
    if (extensions && extensions.length) {
        details.extensions = extensions;
    }
    return {
        implementation: 'fallback',
        runtime,
        details,
    };
}
function createFallbackParserPlugin(lang, config = {}) {
    const normalized = lang.trim().toLowerCase();
    const extensions = config.extensions && config.extensions.length
        ? config.extensions
        : FALLBACK_EXTENSION_MAP[normalized];
    return {
        lang: normalized,
        version: FALLBACK_PLUGIN_VERSION,
        aliases: normalized.includes('#') ? [normalized.replace('#', 'sharp')] : undefined,
        parseProject: async (files, options) => {
            if (!files || Object.keys(files).length === 0) {
                throw new Error('No source files provided for fallback parser.');
            }
            const entries = filterEntries(files, normalized, extensions);
            const modules = {};
            for (const [filePath, source] of entries) {
                const moduleName = moduleNameFromPath(filePath);
                modules[moduleName] = parseModule(filePath, source, normalized, moduleName);
            }
            const project = { modules, fixNotes: [] };
            const meta = buildParserMeta(normalized, options?.runtime, extensions);
            project.parserMeta = meta;
            project.fixNotes = project.fixNotes || [];
            project.fixNotes.push(`Used generic fallback parser for ${normalized}. Results are heuristic and may be incomplete.`);
            return project;
        },
        detect: undefined,
        capabilities: { fallback: true },
    };
}
exports.default = createFallbackParserPlugin;
