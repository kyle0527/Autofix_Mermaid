export type DiagramKind =
  | 'flowchart'
  | 'classDiagram'
  | 'sequenceDiagram'
  | 'stateDiagram'
  | 'erDiagram'
  | 'gantt'
  | 'pie'
  | 'mindmap';

export interface RuleCtx {
  mmd: string;
  diag: DiagramKind;
}

export interface Rule {
  id: string;
  description: string;
  apply(ctx: RuleCtx): RuleCtx; // 純函式，不副作用
  severity?: 'info' | 'warn' | 'error';
  fixable?: boolean;
}

export const rule_legacy_to_flowchart: Rule = {
  id: 'legacy-syntax-upgrade',
  description: '將 graph 開頭升級為 flowchart',
  severity: 'info',
  fixable: true,
  apply: (ctx) => {
    if (ctx.diag !== 'flowchart') return ctx;
    const next = ctx.mmd.replace(/^\s*graph\b/gi, 'flowchart');
    return { ...ctx, mmd: next };
  }
};

export const rule_id_normalize: Rule = {
  id: 'id-normalize',
  description: '節點 id 僅允許 ASCII，其他以 _ 代替（示例版）',
  severity: 'warn',
  fixable: true,
  apply: (ctx) => {
    // 只處理節點 ID：匹配行首如  n0[  n1(  n2-->  等 ID token
    const lines = ctx.mmd.split(/\n/).map(line => {
      const m = line.match(/^\s*([A-Za-z0-9_\u0080-\uFFFF]+)(?=[\[(]|-->|===|:::|\s)/);
      if (!m) return line;
      const rawId = m[1];
      const norm = rawId.replace(/[^A-Za-z0-9_]/g, '_');
      if (norm === rawId) return line;
      return line.replace(rawId, norm);
    });
    return { ...ctx, mmd: lines.join('\n') };
  }
};

// TODO: 後續新增
// 下面為骨架規則：先放佔位，利於 UI 勾選與測試；後續補實作細節。

export const rule_flow_direction: Rule = {
  id: 'flow-direction',
  description: '若未指定方向，預設加上 flowchart LR',
  severity: 'info',
  fixable: true,
  apply: (ctx) => {
    if (ctx.diag !== 'flowchart') return ctx;
    if (/^flowchart\s+(LR|RL|TB|BT|TD)/m.test(ctx.mmd)) return ctx;
    if (!/^flowchart/m.test(ctx.mmd)) return ctx; // 不是 flowchart 開頭，略過
    const lines = ctx.mmd.split(/\n/);
    const idx = lines.findIndex(l => /^flowchart\b/.test(l));
    if (idx >= 0) lines[idx] = lines[idx] + ' LR';
    return { ...ctx, mmd: lines.join('\n') };
  }
};

export const rule_diagram_kind_infer: Rule = {
  id: 'diagram-kind-infer',
  description: '嘗試從內容推斷 diagram 種類（示例: 有 class 關鍵字 → classDiagram）',
  severity: 'info',
  fixable: false,
  apply: (ctx) => {
    // 目前僅示例：若包含 "classDiagram" 字樣則返回原樣；若檔頭為空可能未來插入
    // 真實實作會在更上游決定 diag，這裡暫不變更。
    return ctx;
  }
};

export const rule_dangling_node_prune: Rule = {
  id: 'dangling-node-prune',
  description: '移除無任何連線的節點（暫為占位，不修改）',
  severity: 'warn',
  fixable: true,
  apply: (ctx) => {
    // 未來可解析節點行，計算 in/out degree 再剔除，現階段不動
    return ctx;
  }
};

export const rule_label_truncate: Rule = {
  id: 'label-truncate',
  description: '過長標籤截斷（>40 chars）並加 …（占位）',
  severity: 'info',
  fixable: true,
  apply: (ctx) => {
    // 簡易示例：不實際截斷，後續再補
    return ctx;
  }
};

export function applyRules(
  ctx: RuleCtx,
  rules: Rule[]
): { ctx: RuleCtx; applied: string[] } {
  let cur = ctx;
  const applied: string[] = [];
  for (const r of rules) {
    const prev = cur.mmd;
    cur = r.apply(cur);
    if (cur.mmd !== prev) applied.push(r.id);
  }
  return { ctx: cur, applied };
}