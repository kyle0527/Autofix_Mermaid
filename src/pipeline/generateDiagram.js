import { guardAndMaybeSplit } from '../core/complexity';
import { applyRules } from '../core/rules';
// 假設已存在某個 IR -> mermaid 基本轉換函式（占位）
function irToMermaid(ir) {
    // TODO: 真實實作。此處 stub。
    return `flowchart TD\n${ir.nodes
        .map(n => `${n.id}["${n.name}"]`)
        .join('\n')}`;
}
export function generateFromIR(ir, opt) {
    const split = guardAndMaybeSplit(ir, opt.limitsOverride);
    const mermaidList = split.graphs.map(g => irToMermaid(g));
    // 套規則（針對每張圖；此處示範只對第一張，必要時全部套）
    const firstCtx = { mmd: mermaidList[0], diag: 'flowchart' };
    const { ctx: after, applied } = applyRules(firstCtx, opt.rules);
    mermaidList[0] = after.mmd;
    return {
        kind: split.kind,
        mermaid: mermaidList,
        appliedRules: applied,
        meta: {
            complexityReasons: split.complexity.reasons,
            exceed: split.complexity.exceed
        }
    };
}
