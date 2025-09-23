"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserPluginNotFoundError = void 0;
exports.registerParserPlugin = registerParserPlugin;
exports.clearParserPlugins = clearParserPlugins;
exports.listParserPlugins = listParserPlugins;
exports.getRegisteredParserPlugin = getRegisteredParserPlugin;
exports.loadParserPlugin = loadParserPlugin;
exports.resolveParserPlugin = resolveParserPlugin;
const node_path_1 = __importDefault(require("node:path"));
const fallback_parser_1 = require("./fallback-parser");
const registry = new Map();
function normalizeLang(lang) {
    return lang.trim().toLowerCase();
}
const CONFIDENCE_ORDER = {
    low: 1,
    medium: 2,
    high: 3,
};
function maxConfidence(a, b) {
    return CONFIDENCE_ORDER[a] >= CONFIDENCE_ORDER[b] ? a : b;
}
function scoreConfidence(conf) {
    if (!conf)
        return 0;
    return CONFIDENCE_ORDER[conf];
}
const EXTENSION_HINTS = {
    '.py': { lang: 'python', confidence: 'high' },
    '.pyi': { lang: 'python', confidence: 'medium' },
    '.js': { lang: 'javascript', confidence: 'medium' },
    '.jsx': { lang: 'javascript', confidence: 'medium' },
    '.ts': { lang: 'typescript', confidence: 'high' },
    '.tsx': { lang: 'typescript', confidence: 'medium' },
    '.mjs': { lang: 'javascript', confidence: 'medium' },
    '.cjs': { lang: 'javascript', confidence: 'medium' },
    '.java': { lang: 'java', confidence: 'medium' },
    '.go': { lang: 'go', confidence: 'medium' },
    '.cs': { lang: 'csharp', confidence: 'medium' },
    '.rs': { lang: 'rust', confidence: 'medium' },
    '.rb': { lang: 'ruby', confidence: 'medium' },
    '.php': { lang: 'php', confidence: 'medium' },
    '.c': { lang: 'c', confidence: 'medium' },
    '.h': { lang: 'c', confidence: 'low' },
    '.cc': { lang: 'cpp', confidence: 'medium' },
    '.cpp': { lang: 'cpp', confidence: 'medium' },
    '.cxx': { lang: 'cpp', confidence: 'medium' },
    '.hh': { lang: 'cpp', confidence: 'low' },
    '.hpp': { lang: 'cpp', confidence: 'low' },
    '.m': { lang: 'objective-c', confidence: 'medium' },
    '.swift': { lang: 'swift', confidence: 'medium' },
};
function collectHeuristicCandidates(files) {
    const byLang = new Map();
    for (const filePath of Object.keys(files)) {
        const ext = node_path_1.default.extname(filePath).toLowerCase();
        if (!ext)
            continue;
        const hint = EXTENSION_HINTS[ext];
        if (!hint)
            continue;
        const lang = normalizeLang(hint.lang);
        let entry = byLang.get(lang);
        if (!entry) {
            entry = {
                count: 0,
                files: [],
                exts: new Set(),
                confidence: hint.confidence,
            };
            byLang.set(lang, entry);
        }
        else {
            entry.confidence = maxConfidence(entry.confidence, hint.confidence);
        }
        entry.count += 1;
        entry.exts.add(ext);
        if (entry.files.length < 5) {
            entry.files.push(filePath);
        }
    }
    const heuristics = new Map();
    for (const [lang, meta] of byLang) {
        if (meta.count === 0)
            continue;
        const exts = Array.from(meta.exts.values());
        const reason = meta.count === 1
            ? `Found ${exts[0] ?? ''} file ${meta.files[0]}`
            : `Found ${meta.count} files (${exts.join(', ')})`;
        heuristics.set(lang, {
            count: meta.count,
            extensions: exts,
            detection: {
                lang,
                confidence: meta.confidence,
                reason,
                matchedFiles: meta.files,
            },
        });
    }
    return heuristics;
}
function isParserPlugin(candidate) {
    return (candidate &&
        typeof candidate === 'object' &&
        typeof candidate.lang === 'string' &&
        typeof candidate.parseProject === 'function');
}
function extractPlugin(mod) {
    if (!mod)
        return null;
    const candidate = mod.parserPlugin ?? mod.default ?? mod;
    return isParserPlugin(candidate) ? candidate : null;
}
function candidateModuleIds(lang) {
    const normalized = normalizeLang(lang).replace(/[^a-z0-9]+/g, '-');
    const ids = new Set();
    ids.add(`@diagrammender/parsers-${normalized}`);
    ids.add(`@diagrammender/parser-${normalized}`);
    ids.add(`@diagrammender/parsers/${normalized}`);
    ids.add(`diagrammender-parser-${normalized}`);
    const localRoot = node_path_1.default.join(__dirname, '..', 'parsers', normalized);
    ids.add(localRoot);
    ids.add(node_path_1.default.join(localRoot, 'dist'));
    ids.add(node_path_1.default.join(localRoot, 'dist', 'src'));
    return Array.from(ids);
}
class ParserPluginNotFoundError extends Error {
    constructor(lang, attempted) {
        const fallback = attempted.length
            ? `Tried dynamic module ids: ${attempted.join(', ')}`
            : 'No dynamic module ids were generated for this language.';
        super(`Parser plugin not found for language "${lang}". ` +
            'Install the appropriate @diagrammender/parsers-* package or provide a manual parser.\n' +
            fallback);
        this.name = 'ParserPluginNotFoundError';
        this.lang = lang;
        this.attempted = attempted;
    }
}
exports.ParserPluginNotFoundError = ParserPluginNotFoundError;
function tryRequire(moduleId) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(moduleId);
        return extractPlugin(mod);
    }
    catch (err) {
        if (err && err.code === 'MODULE_NOT_FOUND') {
            const msg = typeof err.message === 'string' ? err.message : '';
            if (msg.includes(moduleId)) {
                return null;
            }
        }
        throw err;
    }
}
function registerParserPlugin(plugin) {
    const primary = normalizeLang(plugin.lang);
    registry.set(primary, plugin);
    if (plugin.aliases) {
        for (const alias of plugin.aliases) {
            registry.set(normalizeLang(alias), plugin);
        }
    }
    return plugin;
}
function clearParserPlugins() {
    registry.clear();
}
function listParserPlugins() {
    return Array.from(new Set(registry.values()));
}
function getRegisteredParserPlugin(lang) {
    return registry.get(normalizeLang(lang));
}
async function loadParserPlugin(lang) {
    const normalized = normalizeLang(lang);
    const existing = registry.get(normalized);
    if (existing)
        return existing;
    const attempted = [];
    for (const moduleId of candidateModuleIds(normalized)) {
        attempted.push(moduleId);
        const plugin = tryRequire(moduleId);
        if (plugin) {
            registerParserPlugin(plugin);
            registry.set(normalized, plugin);
            return plugin;
        }
    }
    throw new ParserPluginNotFoundError(lang, attempted);
}
async function resolveParserPlugin(options) {
    const { lang, files, candidates = [], detect = true, allowHeuristics = true, } = options;
    if (lang && lang !== 'auto') {
        const normalizedLang = normalizeLang(lang);
        const heuristics = files && allowHeuristics
            ? collectHeuristicCandidates(files)
            : undefined;
        let plugin;
        let detection;
        try {
            plugin = await loadParserPlugin(lang);
        }
        catch (err) {
            if (err instanceof ParserPluginNotFoundError) {
                const fallback = (0, fallback_parser_1.createFallbackParserPlugin)(normalizedLang, {
                    extensions: heuristics?.get(normalizedLang)?.extensions,
                });
                plugin = registerParserPlugin(fallback);
                detection = heuristics?.get(normalizedLang)?.detection;
            }
            else {
                throw err;
            }
        }
        if (!detection && detect && files && typeof plugin.detect === 'function') {
            detection = plugin.detect(files) ?? undefined;
        }
        if (!detection && heuristics) {
            detection = heuristics.get(normalizeLang(plugin.lang))?.detection;
        }
        return { plugin, detection };
    }
    if (!files) {
        throw new Error('resolveParserPlugin requires files when language is not specified.');
    }
    const heuristics = allowHeuristics ? collectHeuristicCandidates(files) : new Map();
    const candidatesByLang = new Map();
    for (const cand of candidates) {
        candidatesByLang.set(normalizeLang(cand), {});
    }
    for (const [langId, heuristic] of heuristics) {
        candidatesByLang.set(langId, { heuristic });
    }
    if (candidatesByLang.size === 0) {
        throw new Error('Unable to detect parser language from provided files. Specify lang explicitly.');
    }
    const resolutions = [];
    const missing = [];
    for (const [langId, meta] of candidatesByLang) {
        let plugin;
        try {
            plugin = await loadParserPlugin(langId);
        }
        catch (err) {
            if (err instanceof ParserPluginNotFoundError) {
                missing.push(err.lang);
            }
            continue;
        }
        let detection;
        if (detect && typeof plugin.detect === 'function') {
            try {
                const result = plugin.detect(files);
                if (result)
                    detection = { ...result, lang: normalizeLang(plugin.lang) };
            }
            catch (e) {
                // ignore detection errors and rely on heuristics
            }
        }
        if (!detection && meta.heuristic) {
            detection = meta.heuristic.detection;
        }
        else if (detection && meta.heuristic) {
            // merge matched files if plugin detection doesn't provide them
            if (!detection.matchedFiles || detection.matchedFiles.length === 0) {
                detection = {
                    ...detection,
                    matchedFiles: meta.heuristic.detection.matchedFiles,
                };
            }
            if (!detection.reason && meta.heuristic.detection.reason) {
                detection = {
                    ...detection,
                    reason: meta.heuristic.detection.reason,
                };
            }
        }
        const score = scoreConfidence(detection?.confidence) * 100 + (meta.heuristic?.count ?? 0);
        resolutions.push({ plugin, detection, score });
    }
    if (resolutions.length === 0) {
        if (missing.length) {
            const langId = normalizeLang(missing[0]);
            const heuristic = heuristics.get(langId);
            const fallback = registerParserPlugin((0, fallback_parser_1.createFallbackParserPlugin)(langId, {
                extensions: heuristic?.extensions,
            }));
            return { plugin: fallback, detection: heuristic?.detection };
        }
        const hinted = Array.from(candidatesByLang.keys());
        if (hinted.length) {
            throw new Error(`No parser plugin available for detected languages: ${hinted.join(', ')}`);
        }
        throw new Error('No parser plugin could be resolved.');
    }
    resolutions.sort((a, b) => b.score - a.score);
    const best = resolutions[0];
    return { plugin: best.plugin, detection: best.detection };
}
