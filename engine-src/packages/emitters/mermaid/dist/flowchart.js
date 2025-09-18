"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitFlowchartFragments = emitFlowchartFragments;
exports.buildFlowchartLinks = buildFlowchartLinks;
exports.emitFlowchart = emitFlowchart;
const utils_1 = require("./utils");
const compose_1 = require("./compose");
function buildFunctionFragment(modName, modPath, fn, ctx) {
    const fragmentId = fn.id || `${modName}.${fn.name}`;
    const lines = [`subgraph ${fragmentId}`];
    const cfg = fn.cfg;
    let entryNode;
    let exitNode;
    if (!cfg || cfg.nodes.length === 0) {
        const A = (0, utils_1.sid)('A', fragmentId);
        const B = (0, utils_1.sid)('B', fragmentId);
        lines.push(`${A}((Start))`);
        lines.push(`${B}((End))`);
        lines.push(`${A} --> ${B}`);
        entryNode = A;
        exitNode = B;
    }
    else {
        for (const n of cfg.nodes) {
            const label = (0, utils_1.esc)((0, utils_1.wrap)((0, utils_1.trunc)(n.label || n.kind, 120)));
            const id = (0, utils_1.sid)('N', fragmentId + ':' + n.id);
            switch (n.kind) {
                case 'start':
                    lines.push(`${id}((Start))`);
                    if (!entryNode)
                        entryNode = id;
                    break;
                case 'end':
                    lines.push(`${id}((End))`);
                    if (!exitNode)
                        exitNode = id;
                    break;
                case 'decision':
                    lines.push(`${id}{${label}}`);
                    break;
                default:
                    lines.push(`${id}[${label}]`);
            }
        }
        for (const e of cfg.edges) {
            const a = (0, utils_1.sid)('N', fragmentId + ':' + e.from);
            const b = (0, utils_1.sid)('N', fragmentId + ':' + e.to);
            const lab = e.label ? ` -- ${(0, utils_1.esc)(e.label)} --> ` : ' --> ';
            lines.push(`${a}${lab}${b}`);
        }
        if (!entryNode && cfg.nodes.length > 0) {
            entryNode = (0, utils_1.sid)('N', fragmentId + ':' + cfg.nodes[0].id);
        }
        if (!exitNode && cfg.nodes.length > 0) {
            const last = cfg.nodes[cfg.nodes.length - 1];
            exitNode = (0, utils_1.sid)('N', fragmentId + ':' + last.id);
        }
    }
    lines.push('end');
    return {
        id: fragmentId,
        title: ctx?.className ? `${ctx.className}.${fn.name}` : `${modName}.${fn.name}`,
        diagram: 'flowchart',
        code: lines.join('\n'),
        source: { module: modName, function: fn.name, class: ctx?.className, path: modPath },
        anchors: entryNode || exitNode ? { entry: entryNode, exit: exitNode } : undefined,
    };
}
function emitFlowchartFragments(ir) {
    const fragments = [];
    for (const mod of Object.values(ir.modules)) {
        for (const fn of mod.functions) {
            fragments.push(buildFunctionFragment(mod.name, mod.path, fn));
        }
        for (const cls of mod.classes || []) {
            for (const method of cls.methods || []) {
                fragments.push(buildFunctionFragment(mod.name, mod.path, method, { className: cls.name }));
            }
        }
    }
    if (fragments.length === 0) {
        fragments.push({
            id: 'flowchart-empty',
            title: 'empty',
            diagram: 'flowchart',
            code: 'A((Start))-->B((End))',
        });
    }
    return fragments;
}
function buildFlowchartLinks(callGraph, fragments) {
    if (!callGraph?.edges?.length) {
        return [];
    }
    const fragmentMap = new Map();
    for (const fragment of fragments) {
        fragmentMap.set(fragment.id, fragment);
    }
    const links = [];
    const dedupe = new Set();
    for (const edge of callGraph.edges) {
        if (!edge.toId)
            continue;
        const fromFragment = fragmentMap.get(edge.from);
        const toFragment = fragmentMap.get(edge.toId);
        if (!fromFragment || !toFragment)
            continue;
        const fromAnchor = fromFragment.anchors?.exit ? 'exit' : undefined;
        const toAnchor = toFragment.anchors?.entry ? 'entry' : undefined;
        if (!fromAnchor && !toAnchor)
            continue;
        const key = `${fromFragment.id}|${toFragment.id}|${fromAnchor ?? ''}|${toAnchor ?? ''}|${edge.toName ?? ''}`;
        if (dedupe.has(key))
            continue;
        dedupe.add(key);
        links.push({
            diagram: 'flowchart',
            fromFragment: fromFragment.id,
            toFragment: toFragment.id,
            fromAnchor,
            toAnchor,
            label: edge.toName && edge.toName !== edge.toId ? edge.toName : undefined,
            style: 'solid',
        });
    }
    return links;
}
function emitFlowchart(ir) {
    const fragments = emitFlowchartFragments(ir);
    const links = buildFlowchartLinks(ir.callGraph, fragments);
    return (0, compose_1.composeMermaid)('flowchart', fragments, { links });
}
