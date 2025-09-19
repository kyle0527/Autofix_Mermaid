export type Lang = 'python' | 'js' | 'ts' | 'java' | 'go' | 'csharp';

export interface IRMeta {
  irVersion: '1.0';
  language: Lang;
  generatedAt: string; // ISO timestamp
}

export interface IRNode {
  id: string;
  kind: 'module' | 'class' | 'function';
  name: string;
  path?: string;
  loc?: { start: number; end: number };
  parents?: string[];
}

export interface IREdge {
  from: string;
  to: string;
  type: 'inherits' | 'calls' | 'depends';
}

export interface IR {
  meta: IRMeta;
  nodes: IRNode[];
  edges: IREdge[];
}

// 工具：建立空 IR
export function createEmptyIR(language: Lang): IR {
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
export function serializeIR(ir: IR): string {
  const stable: IR = {
    meta: ir.meta,
    nodes: [...ir.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...ir.edges].sort((a, b) =>
      a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)
    )
  };
  return JSON.stringify(stable, null, 2);
}