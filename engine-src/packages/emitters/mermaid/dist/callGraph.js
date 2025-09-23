"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitCallGraphFragments = emitCallGraphFragments;
exports.emitCallGraph = emitCallGraph;
const compose_1 = require("./compose");
const utils_1 = require("./utils");
function formatLabel(primary, secondary) {
    const parts = [primary];
    if (secondary && secondary !== primary) {
        parts.push(secondary);
    }
    const formatted = parts
        .map((part) => (0, utils_1.wrap)((0, utils_1.trunc)(part, 96), 32))
        .join('\n');
    return (0, utils_1.esc)(formatted);
}
function collectFunctionNodes(ir) {
    const nodes = new Map();
    const modules = Object.values(ir.modules || {}).sort((a, b) => a.name.localeCompare(b.name));
    for (const mod of modules) {
        const moduleName = mod.name || mod.path;
        const functions = [...(mod.functions || [])].sort((a, b) => a.id.localeCompare(b.id));
        for (const fn of functions) {
            const nodeId = (0, utils_1.sid)('call', fn.id);
            const label = formatLabel(moduleName, fn.name);
            nodes.set(fn.id, { nodeId, label, sortKey: `${moduleName}|${fn.name}|${nodeId}` });
        }
        const classes = [...(mod.classes || [])].sort((a, b) => a.name.localeCompare(b.name));
        for (const cls of classes) {
            const methods = [...(cls.methods || [])].sort((a, b) => a.id.localeCompare(b.id));
            for (const method of methods) {
                const nodeId = (0, utils_1.sid)('call', method.id);
                const label = formatLabel(moduleName, `${cls.name}.${method.name}`);
                nodes.set(method.id, { nodeId, label, sortKey: `${moduleName}|${cls.name}.${method.name}|${nodeId}` });
            }
        }
    }
    return nodes;
}
function ensureExternalNode(externalNodes, toName, toId) {
    const key = toId || toName || 'external';
    let existing = externalNodes.get(key);
    if (existing)
        return existing;
    const labelSource = toName || toId || 'external';
    const nodeId = (0, utils_1.sid)('call_ext', key);
    existing = {
        nodeId,
        label: formatLabel(labelSource),
        sortKey: `~external|${labelSource}|${nodeId}`,
    };
    externalNodes.set(key, existing);
    return existing;
}
function buildEdgeLabel(edgeName, targetId) {
    if (!edgeName)
        return undefined;
    if (targetId && edgeName === targetId)
        return undefined;
    return (0, utils_1.esc)((0, utils_1.wrap)((0, utils_1.trunc)(edgeName, 96), 32));
}
function buildCallGraphEdges(ir, functionNodes) {
    const externalNodes = new Map();
    const edgeRecords = [];
    const seen = new Set();
    const callEdges = ir.callGraph?.edges || [];
    for (const edge of callEdges) {
        const fromInfo = functionNodes.get(edge.from);
        if (!fromInfo)
            continue;
        let targetInfo = undefined;
        if (edge.toId && functionNodes.has(edge.toId)) {
            targetInfo = functionNodes.get(edge.toId);
        }
        if (!targetInfo) {
            targetInfo = ensureExternalNode(externalNodes, edge.toName, edge.toId);
        }
        if (!targetInfo)
            continue;
        const arrow = functionNodes.has(edge.toId || '') ? '-->' : '-.->';
        const edgeLabel = buildEdgeLabel(edge.toName, edge.toId);
        const labelChunk = edgeLabel ? `|${edgeLabel}|` : '';
        const edgeKey = `${fromInfo.nodeId}|${targetInfo.nodeId}|${labelChunk}|${arrow}`;
        if (seen.has(edgeKey))
            continue;
        seen.add(edgeKey);
        edgeRecords.push({
            line: `${fromInfo.nodeId} ${arrow}${labelChunk} ${targetInfo.nodeId}`,
            sortKey: `${fromInfo.sortKey}|${targetInfo.sortKey}|${edgeLabel ?? ''}`,
        });
    }
    edgeRecords.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return { edges: edgeRecords, externals: externalNodes };
}
function emitCallGraphFragments(ir) {
    const functionNodes = collectFunctionNodes(ir);
    const { edges, externals } = buildCallGraphEdges(ir, functionNodes);
    const internalNodes = Array.from(functionNodes.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const externalNodes = Array.from(externals.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const nodeLines = [];
    for (const node of internalNodes) {
        nodeLines.push(`${node.nodeId}["${node.label}"]`);
    }
    for (const node of externalNodes) {
        nodeLines.push(`${node.nodeId}["${node.label}"]`);
    }
    const edgeLines = edges.map((record) => record.line);
    const lines = [];
    if (nodeLines.length) {
        lines.push(...nodeLines);
    }
    if (edgeLines.length) {
        if (lines.length) {
            lines.push('');
        }
        lines.push(...edgeLines);
    }
    if (lines.length === 0) {
        lines.push('callGraphEmpty["No call relationships found"]');
    }
    return [{
            id: 'callGraph',
            title: 'Call Graph',
            diagram: 'callGraph',
            code: lines.join('\n'),
        }];
}
function emitCallGraph(ir) {
    return (0, compose_1.composeMermaid)('callGraph', emitCallGraphFragments(ir));
}
