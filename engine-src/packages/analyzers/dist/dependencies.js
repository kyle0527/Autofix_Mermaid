import path from 'node:path';
function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}
function stripExtension(filePath) {
    if (filePath.endsWith('.d.ts')) {
        return filePath.slice(0, -5);
    }
    return filePath.replace(/\.[^.\/]+$/g, '');
}
function inferLanguage(mod) {
    const lower = mod.path?.toLowerCase() ?? '';
    if (lower.endsWith('.py') || lower.endsWith('.pyw') || lower.endsWith('.pyi')) {
        return 'python';
    }
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) {
        return 'typescript';
    }
    if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
        return 'javascript';
    }
    return 'unknown';
}
function resolvePythonModuleName(mod, spec) {
    const trimmed = spec.trim();
    if (!trimmed)
        return mod.name;
    if (!trimmed.startsWith('.'))
        return trimmed;
    const moduleParts = mod.name.split('.');
    const packageParts = moduleParts.slice(0, -1);
    let dotCount = 0;
    while (dotCount < trimmed.length && trimmed[dotCount] === '.') {
        dotCount += 1;
    }
    let levelsUp = Math.max(0, dotCount - 1);
    const remainder = trimmed.slice(dotCount);
    const baseParts = packageParts.slice();
    while (levelsUp > 0 && baseParts.length > 0) {
        baseParts.pop();
        levelsUp -= 1;
    }
    const remainderParts = remainder
        ? remainder.split('.').map((part) => part.trim()).filter(Boolean)
        : [];
    const resolved = baseParts.concat(remainderParts);
    if (resolved.length === 0) {
        return moduleParts.join('.');
    }
    return resolved.join('.');
}
function extractPythonSymbols(segment) {
    return segment
        .replace(/[()]/g, ' ')
        .split(',')
        .map((part) => part.trim())
        .map((part) => part.replace(/\s+as\s+[A-Za-z0-9_]+$/i, '').trim())
        .filter(Boolean);
}
function parsePythonImport(mod, raw) {
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (!normalized)
        return [];
    const results = [];
    const colonIdx = normalized.indexOf(':');
    if (colonIdx > 0) {
        const moduleChunk = normalized.slice(0, colonIdx);
        if (/^[A-Za-z0-9_.]+$/.test(moduleChunk)) {
            const moduleName = resolvePythonModuleName(mod, moduleChunk);
            const symbols = extractPythonSymbols(normalized.slice(colonIdx + 1));
            results.push({ module: moduleName, symbols: symbols.length ? symbols : undefined });
            return results;
        }
    }
    const fromMatch = /^from\s+([A-Za-z0-9_.]+|\.+)\s+import\s+([\s\S]+)$/i.exec(normalized);
    if (fromMatch) {
        const moduleName = resolvePythonModuleName(mod, fromMatch[1]);
        const symbols = extractPythonSymbols(fromMatch[2]);
        results.push({ module: moduleName, symbols: symbols.length ? symbols : undefined });
        return results;
    }
    const importMatch = /^import\s+([\s\S]+)$/i.exec(normalized);
    if (importMatch) {
        const parts = importMatch[1]
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        for (const part of parts) {
            const cleaned = part.replace(/\s+as\s+[A-Za-z0-9_]+$/i, '').trim();
            if (!cleaned)
                continue;
            const moduleName = resolvePythonModuleName(mod, cleaned);
            results.push({ module: moduleName });
        }
        return results;
    }
    if (/^[A-Za-z0-9_.]+$/.test(normalized) || normalized.startsWith('.')) {
        const moduleName = resolvePythonModuleName(mod, normalized);
        results.push({ module: moduleName });
        return results;
    }
    return results;
}
function mergeSymbols(existing, next) {
    if ((!existing || existing.length === 0) && (!next || next.length === 0)) {
        return undefined;
    }
    const set = new Set();
    for (const symbol of existing || []) {
        if (symbol)
            set.add(symbol);
    }
    for (const symbol of next || []) {
        if (symbol)
            set.add(symbol);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
}
function extractJSImportSymbols(clause) {
    if (!clause)
        return [];
    const text = clause.trim();
    if (!text)
        return [];
    const names = new Set();
    const curlyMatch = text.match(/\{([^}]*)\}/);
    if (curlyMatch) {
        const inner = curlyMatch[1];
        inner
            .split(',')
            .map((part) => part.trim())
            .forEach((part) => {
            if (!part)
                return;
            const cleaned = part.replace(/\s+as\s+[A-Za-z0-9_$]+$/i, '').trim();
            if (cleaned)
                names.add(cleaned);
        });
    }
    if (/^\*\s+as\s+/i.test(text)) {
        names.add('*');
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
}
function parseJSImport(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return [];
    const entries = new Map();
    const add = (module, symbols) => {
        const existing = entries.get(module);
        if (existing) {
            existing.symbols = mergeSymbols(existing.symbols, symbols);
        }
        else {
            entries.set(module, {
                module,
                symbols: symbols && symbols.length ? mergeSymbols([], symbols) : undefined,
            });
        }
    };
    const importFromRegex = /import\s+(?:type\s+)?([\s\S]+?)\s+from\s+['"]([^'"\\]+)['"]/gi;
    let match;
    while ((match = importFromRegex.exec(trimmed))) {
        const clause = match[1];
        const spec = match[2];
        const symbols = extractJSImportSymbols(clause);
        add(spec, symbols);
    }
    const exportFromRegex = /export\s+(?:type\s+)?(?:\{([^}]*)\}|\*)\s+from\s+['"]([^'"\\]+)['"]/gi;
    while ((match = exportFromRegex.exec(trimmed))) {
        const namesBlock = match[1];
        const spec = match[2];
        const isStar = match[0].includes('*');
        const symbols = namesBlock
            ? extractJSImportSymbols(`{${namesBlock}}`)
            : isStar
                ? ['*']
                : undefined;
        add(spec, symbols);
    }
    const requireRegex = /require\((['"])([^'"\\]+)\1\)/g;
    while ((match = requireRegex.exec(trimmed))) {
        add(match[2]);
    }
    const dynamicImportRegex = /import\((['"])([^'"\\]+)\1\)/g;
    while ((match = dynamicImportRegex.exec(trimmed))) {
        add(match[2]);
    }
    const bareImportRegex = /import\s+['"]([^'"\\]+)['"]/gi;
    while ((match = bareImportRegex.exec(trimmed))) {
        add(match[1]);
    }
    if (entries.size === 0 && /^[A-Za-z0-9@._\/-]+$/.test(trimmed)) {
        add(trimmed);
    }
    return Array.from(entries.values());
}
function resolveJSImportTarget(mod, spec, pathToModule, moduleNames) {
    const trimmed = spec.trim();
    if (!trimmed) {
        return { target: spec, isExternal: true };
    }
    const normalized = trimmed.replace(/\\/g, '/');
    const withoutExt = stripExtension(normalized);
    const directCandidates = new Set([
        trimmed,
        normalized,
        withoutExt,
        withoutExt.replace(/\/index$/i, ''),
    ]);
    for (const candidate of directCandidates) {
        if (moduleNames.has(candidate)) {
            return { target: candidate, isExternal: false };
        }
        const dotted = candidate.replace(/\//g, '.');
        if (moduleNames.has(dotted)) {
            return { target: dotted, isExternal: false };
        }
    }
    if (normalized.startsWith('.')) {
        const fromPath = normalizePath(mod.path);
        const baseDir = path.posix.dirname(fromPath);
        const joined = path.posix.normalize(path.posix.join(baseDir, normalized));
        const joinedNoExt = stripExtension(joined);
        const match = pathToModule.get(joinedNoExt)
            ?? pathToModule.get(`${joinedNoExt}/index`);
        if (match) {
            return { target: match, isExternal: false };
        }
        const dotted = joinedNoExt.replace(/\//g, '.');
        if (moduleNames.has(dotted)) {
            return { target: dotted, isExternal: false };
        }
    }
    else if (normalized.startsWith('/')) {
        const absolute = stripExtension(path.posix.normalize(normalized));
        const match = pathToModule.get(absolute)
            ?? pathToModule.get(`${absolute}/index`);
        if (match) {
            return { target: match, isExternal: false };
        }
        const dotted = absolute.replace(/\//g, '.');
        if (moduleNames.has(dotted)) {
            return { target: dotted, isExternal: false };
        }
    }
    return { target: trimmed, isExternal: !moduleNames.has(trimmed) };
}
function normalizePythonDependencies(mod, raw, moduleNames) {
    const parsed = parsePythonImport(mod, raw);
    return parsed.map((entry) => {
        const target = entry.module;
        const symbols = entry.symbols && entry.symbols.length ? mergeSymbols([], entry.symbols) : undefined;
        const isExternal = target ? !moduleNames.has(target) : true;
        return { to: target, symbols, isExternal };
    });
}
function normalizeJSImportDependencies(mod, raw, moduleNames, pathToModule) {
    const parsed = parseJSImport(raw);
    return parsed.map((entry) => {
        const resolution = resolveJSImportTarget(mod, entry.module, pathToModule, moduleNames);
        const symbols = entry.symbols && entry.symbols.length ? mergeSymbols([], entry.symbols) : undefined;
        return { to: resolution.target, symbols, isExternal: resolution.isExternal };
    });
}
function normalizeGenericDependency(mod, raw, moduleNames, pathToModule) {
    const resolution = resolveJSImportTarget(mod, raw, pathToModule, moduleNames);
    return { to: resolution.target, isExternal: resolution.isExternal };
}
export function buildDependencyGraph(project) {
    const modules = Object.values(project.modules || {});
    const moduleNames = new Set();
    const pathToModule = new Map();
    for (const mod of modules) {
        moduleNames.add(mod.name);
        const normalizedPath = normalizePath(mod.path || '');
        if (!normalizedPath)
            continue;
        const withoutExt = stripExtension(normalizedPath);
        if (withoutExt) {
            pathToModule.set(withoutExt, mod.name);
            if (withoutExt.endsWith('/__init__')) {
                pathToModule.set(withoutExt.replace(/\/__init__$/, ''), mod.name);
            }
            if (withoutExt.endsWith('/index')) {
                pathToModule.set(withoutExt.replace(/\/index$/, ''), mod.name);
            }
        }
    }
    const edgeMap = new Map();
    for (const mod of modules) {
        const imports = Array.isArray(mod.imports) ? mod.imports : [];
        if (!imports.length)
            continue;
        const lang = inferLanguage(mod);
        for (const rawImport of imports) {
            if (typeof rawImport !== 'string')
                continue;
            const trimmed = rawImport.trim();
            if (!trimmed)
                continue;
            let deps = [];
            if (lang === 'python') {
                deps = normalizePythonDependencies(mod, trimmed, moduleNames);
            }
            else if (lang === 'javascript' || lang === 'typescript') {
                deps = normalizeJSImportDependencies(mod, trimmed, moduleNames, pathToModule);
            }
            else {
                deps = normalizePythonDependencies(mod, trimmed, moduleNames);
                if (!deps.length) {
                    deps = normalizeJSImportDependencies(mod, trimmed, moduleNames, pathToModule);
                }
                if (!deps.length) {
                    deps = [normalizeGenericDependency(mod, trimmed, moduleNames, pathToModule)];
                }
            }
            for (const dep of deps) {
                if (!dep.to)
                    continue;
                const key = `${mod.name}|${dep.to}`;
                const existing = edgeMap.get(key);
                if (existing) {
                    existing.symbols = mergeSymbols(existing.symbols, dep.symbols);
                    if (!dep.isExternal) {
                        existing.isExternal = false;
                    }
                }
                else {
                    edgeMap.set(key, {
                        from: mod.name,
                        to: dep.to,
                        symbols: dep.symbols && dep.symbols.length ? [...dep.symbols] : undefined,
                        isExternal: dep.isExternal,
                    });
                }
            }
        }
    }
    const edges = Array.from(edgeMap.values());
    edges.sort((a, b) => {
        const fromCmp = a.from.localeCompare(b.from);
        if (fromCmp !== 0)
            return fromCmp;
        return a.to.localeCompare(b.to);
    });
    return { edges };
}
