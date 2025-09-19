import { IR } from '../core/ir';
import { guardAndMaybeSplit } from '../core/complexity';
import { applyRules, Rule, RuleCtx } from '../core/rules';

export interface GenerateOptions {
  rules: Rule[];
  limitsOverride?: Partial<{
    maxNodes: number;
    maxEdges: number;
    maxDepth: number;
  }>;
}

export interface DiagramOutput {
  kind: 'single' | 'split';
  mermaid: string[];
  appliedRules: string[];
  meta: {
    complexityReasons: string[];
    exceed: boolean;
  };
}

// 假設已存在某個 IR -> mermaid 基本轉換函式（占位）
function irToMermaid(ir: IR): string {
  // TODO: 真實實作。此處 stub。
  return `flowchart TD\n${ir.nodes
    .map(n => `${n.id}["${n.name}"]`)
    .join('\n')}`;
}

export function generateFromIR(ir: IR, opt: GenerateOptions): DiagramOutput {
  const split = guardAndMaybeSplit(ir, opt.limitsOverride as any);
  const mermaidList = split.graphs.map(g => irToMermaid(g));

  // 套規則（針對每張圖；此處示範只對第一張，必要時全部套）
  const firstCtx: RuleCtx = { mmd: mermaidList[0], diag: 'flowchart' };
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