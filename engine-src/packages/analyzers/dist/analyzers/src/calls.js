"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCallGraph = buildCallGraph;
function buildCallGraph(project) {
    const edges = [];
    const nameToId = new Map();
    for (const mod of Object.values(project.modules)) {
        for (const fn of mod.functions) {
            nameToId.set(`${mod.name}.${fn.name}`, fn.id);
        }
    }
    for (const mod of Object.values(project.modules)) {
        for (const fn of mod.functions) {
            for (const callee of fn.calls || []) {
                const toId = nameToId.get(callee) || undefined;
                edges.push({ from: fn.id, toName: callee, toId });
            }
        }
    }
    return { edges };
}
