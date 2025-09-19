// 工具：建立空 IR
export function createEmptyIR(language) {
    return {
        meta: {
            irVersion: '1.0',
            language,
            generatedAt: new Date().toISOString()
        },
        nodes: [],
        edges: []
    };
}
// 穩定序列化：排序 nodes/edges 以確保快照可重現
export function serializeIR(ir) {
    const stable = {
        meta: ir.meta,
        nodes: [...ir.nodes].sort((a, b) => a.id.localeCompare(b.id)),
        edges: [...ir.edges].sort((a, b) => a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from))
    };
    return JSON.stringify(stable, null, 2);
}
