export const DEFAULT_LIMITS = { maxNodes: 60, maxEdges: 100, maxDepth: 6 };
export function estimate(ir, lim = DEFAULT_LIMITS) {
    const nodes = ir.nodes.length;
    const edges = ir.edges.length;
    // 建圖
    const g = {};
    ir.edges.forEach(e => {
        var _a;
        (g[_a = e.from] || (g[_a] = [])).push(e.to);
    });
    // roots（無被指向者）
    const roots = ir.nodes
        .filter(n => !ir.edges.some(e => e.to === n.id))
        .map(n => n.id);
    let depth = 0;
    let frontier = roots;
    const seen = new Set(frontier);
    while (frontier.length) {
        depth++;
        frontier = frontier
            .flatMap(id => g[id] || [])
            .filter(id => !seen.has(id));
        frontier.forEach(id => seen.add(id));
    }
    // fanout
    const fanouts = ir.nodes.map(n => (g[n.id]?.length || 0)).sort((a, b) => a - b);
    const fanoutP95 = fanouts.length
        ? fanouts[Math.max(0, Math.floor(fanouts.length * 0.95) - 1)]
        : 0;
    const reasons = [];
    if (nodes > lim.maxNodes)
        reasons.push(`nodes>${lim.maxNodes}`);
    if (edges > lim.maxEdges)
        reasons.push(`edges>${lim.maxEdges}`);
    if (depth > lim.maxDepth)
        reasons.push(`depth>${lim.maxDepth}`);
    return {
        nodes,
        edges,
        depth,
        fanoutP95,
        exceed: reasons.length > 0,
        reasons
    };
}
export function guardAndMaybeSplit(ir, limits) {
    const complexity = estimate(ir, limits);
    if (!complexity.exceed) {
        return { kind: 'single', complexity, graphs: [ir] };
    }
    const result = splitGraph(ir);
    return { kind: 'split', complexity, ...result };
}
export function splitGraph(ir) {
    if (!ir.nodes.length)
        return { graphs: [ir], indexGraph: ir };
    const groups = {};
    ir.nodes.forEach(n => {
        const mod = n.path ? n.path.split(/[/\\]/)[0] : 'root';
        (groups[mod] || (groups[mod] = [])).push(n);
    });
    let irs = Object.entries(groups).map(([mod, nodes]) => {
        const idSet = new Set(nodes.map(n => n.id));
        const edges = ir.edges.filter(e => idSet.has(e.from) && idSet.has(e.to));
        return { meta: ir.meta, nodes, edges };
    });
    // 如果只有 1 組，或最大組仍超大 → fallback 用 connected components
    if (irs.length === 1) {
        irs = connectedComponentSplit(ir);
    }
    const indexGraph = buildIndexGraph(ir, irs);
    return { graphs: irs, indexGraph };
}
function connectedComponentSplit(ir) {
    // 無向圖
    const g = {};
    ir.edges.forEach(e => {
        var _a, _b;
        (g[_a = e.from] || (g[_a] = new Set())).add(e.to);
        (g[_b = e.to] || (g[_b] = new Set())).add(e.from);
    });
    ir.nodes.forEach(n => { var _a; g[_a = n.id] || (g[_a] = new Set()); });
    const seen = new Set();
    const comps = [];
    for (const n of ir.nodes) {
        if (seen.has(n.id))
            continue;
        const q = [n.id];
        seen.add(n.id);
        const comp = [];
        while (q.length) {
            const cur = q.shift();
            comp.push(cur);
            g[cur].forEach(nb => {
                if (!seen.has(nb)) {
                    seen.add(nb);
                    q.push(nb);
                }
            });
        }
        comps.push(comp);
    }
    return comps.map(ids => {
        const idSet = new Set(ids);
        return {
            meta: ir.meta,
            nodes: ir.nodes.filter(n => idSet.has(n.id)),
            edges: ir.edges.filter(e => idSet.has(e.from) && idSet.has(e.to))
        };
    });
}
function buildIndexGraph(original, parts) {
    // 將每個子圖壓縮為一個 module 節點
    const nodeMap = new Map(); // 原 id -> part id
    parts.forEach((p, idx) => {
        p.nodes.forEach(n => nodeMap.set(n.id, `part_${idx}`));
    });
    const nodes = parts.map((p, idx) => ({
        id: `part_${idx}`,
        kind: 'module',
        name: p.nodes[0]?.path?.split(/[/\\]/)[0] || `Part${idx}`
    }));
    const edgeSet = new Set();
    const edges = [];
    original.edges.forEach(e => {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b || a === b)
            return;
        const key = `${a}->${b}`;
        if (edgeSet.has(key))
            return;
        edgeSet.add(key);
        edges.push({ from: a, to: b, type: 'depends' });
    });
    return { meta: original.meta, nodes, edges };
}
