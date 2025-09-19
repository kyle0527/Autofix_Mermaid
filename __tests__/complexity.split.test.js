import { createEmptyIR } from '../src/core/ir';
import { guardAndMaybeSplit, DEFAULT_LIMITS } from '../src/core/complexity';
test('no split under limits', () => {
    const ir = createEmptyIR('python');
    ir.nodes.push({ id: 'A', kind: 'module', name: 'A' });
    const res = guardAndMaybeSplit(ir, DEFAULT_LIMITS);
    expect(res.kind).toBe('single');
    expect(res.graphs.length).toBe(1);
});
test('split triggers when exceeding node limit', () => {
    const ir = createEmptyIR('python');
    for (let i = 0; i < 65; i++) {
        ir.nodes.push({ id: 'n' + i, kind: 'class', name: 'C' + i, path: `pkg${i % 3}/file${i}.py` });
        if (i > 0)
            ir.edges.push({ from: 'n' + (i - 1), to: 'n' + i, type: 'depends' });
    }
    const res = guardAndMaybeSplit(ir, { ...DEFAULT_LIMITS, maxNodes: 60 });
    expect(res.kind).toBe('split');
    // 確認每個子 IR 都低於原始節點數且至少有 1 個節點
    const totalSubNodes = res.graphs.reduce((acc, g) => acc + g.nodes.length, 0);
    expect(totalSubNodes).toBe(ir.nodes.length);
    expect(res.graphs.every(g => g.nodes.length > 0)).toBe(true);
    // indexGraph 應該節點數 == 子圖數
    expect(res.indexGraph.nodes.length).toBe(res.graphs.length);
    // indexGraph 邊不應超過原始邊數
    expect(res.indexGraph.edges.length).toBeLessThanOrEqual(ir.edges.length);
});
