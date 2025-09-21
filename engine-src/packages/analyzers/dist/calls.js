"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCallGraph = buildCallGraph;
function buildCallGraph(project) {
    const edges = [];
    const nameToId = new Map();
    const register = (name, id) => {
        if (!name)
            return;
        const normalized = name.replace(/::/g, '.');
        if (!nameToId.has(normalized)) {
            nameToId.set(normalized, id);
        }
    };
    for (const mod of Object.values(project.modules)) {
        for (const fn of mod.functions) {
            register(fn.id, fn.id);
            register(`${mod.name}.${fn.name}`, fn.id);
            register(fn.name, fn.id);
        }
        for (const cls of mod.classes || []) {
            for (const method of cls.methods || []) {
                register(method.id, method.id);
                register(`${mod.name}.${method.name}`, method.id);
                register(`${cls.name}.${method.name}`, method.id);
                register(`${mod.name}.${cls.name}.${method.name}`, method.id);
                register(method.name, method.id);
            }
        }
    }
    const resolveTarget = (rawName) => {
        if (!rawName)
            return undefined;
        const normalized = rawName.replace(/::/g, '.');
        const direct = nameToId.get(normalized);
        if (direct)
            return direct;
        const parts = normalized.split('.');
        for (let i = 0; i < parts.length; i += 1) {
            const suffix = parts.slice(i).join('.');
            const match = nameToId.get(suffix);
            if (match)
                return match;
        }
        return undefined;
    };
    for (const mod of Object.values(project.modules)) {
        for (const fn of mod.functions) {
            for (const callee of fn.calls || []) {
                const toId = resolveTarget(callee);
                edges.push({ from: fn.id, toName: callee, toId });
            }
        }
        for (const cls of mod.classes || []) {
            for (const method of cls.methods || []) {
                for (const callee of method.calls || []) {
                    const toId = resolveTarget(callee);
                    edges.push({ from: method.id, toName: callee, toId });
                }
            }
        }
    }
    return { edges };
}
