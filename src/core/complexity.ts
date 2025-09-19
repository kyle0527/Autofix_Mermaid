import { IR, IRNode, IREdge } from './ir';

export interface Complexity {
  nodes: number;
  edges: number;
  depth: number;
  fanoutP95: number;
  exceed: boolean;
  reasons: string[];
}

export interface Limits {
  maxNodes: number;
  maxEdges: number;
  maxDepth: number;
}

export const DEFAULT_LIMITS: Limits = { maxNodes: 60, maxEdges: 100, maxDepth: 6 };

export function estimate(ir: IR, lim: Limits = DEFAULT_LIMITS): Complexity {
  const nodes = ir.nodes.length;
  const edges = ir.edges.length;

  // 建圖
  const g: Record<string, string[]> = {};
  ir.edges.forEach(e => {
    (g[e.from] ||= []).push(e.to);
  });

  // roots（無被指向者）
  const roots = ir.nodes
    .filter(n => !ir.edges.some(e => e.to === n.id))
    .map(n => n.id);

  let depth = 0;
  let frontier = roots;
  const seen = new Set<string>(frontier);
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

  const reasons: string[] = [];
  if (nodes > lim.maxNodes) reasons.push(`nodes>${lim.maxNodes}`);
  if (edges > lim.maxEdges) reasons.push(`edges>${lim.maxEdges}`);
  if (depth > lim.maxDepth) reasons.push(`depth>${lim.maxDepth}`);

  return {
    nodes,
    edges,
    depth,
    fanoutP95,
    exceed: reasons.length > 0,
    reasons
  };
}

// 之後可掛在這裡：超限 → splitGraph(ir)
export interface SplitResult {
  kind: 'single' | 'split';
  complexity: Complexity;
  graphs: IR[]; // 若拆圖，多個子 IR
  indexGraph?: IR; // 可選：索引圖
}

export function guardAndMaybeSplit(ir: IR, limits?: Limits): SplitResult {
  const complexity = estimate(ir, limits);
  if (!complexity.exceed) {
    return { kind: 'single', complexity, graphs: [ir] };
  }
  const result = splitGraph(ir);
  return { kind: 'split', complexity, ...result };
}

// --- 拆圖策略實作 ---
// 1. 依 node.path 的第一層資料夾分組 (module grouping)
// 2. 若仍巨大，使用 connected components (忽略方向)
// 3. 產生 indexGraph：僅保留子圖之間跨群邊緊縮成 module 節點

interface SplitInternalResult {
  graphs: IR[];
  indexGraph: IR;
}

export function splitGraph(ir: IR): SplitInternalResult {
  if (!ir.nodes.length) return { graphs: [ir], indexGraph: ir };

  const groups: Record<string, IRNode[]> = {};
  ir.nodes.forEach(n => {
    const mod = n.path ? n.path.split(/[/\\]/)[0] : 'root';
    (groups[mod] ||= []).push(n);
  });

  let irs: IR[] = Object.entries(groups).map(([mod, nodes]) => {
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

function connectedComponentSplit(ir: IR): IR[] {
  // 無向圖
  const g: Record<string, Set<string>> = {};
  ir.edges.forEach(e => {
    (g[e.from] ||= new Set()).add(e.to);
    (g[e.to] ||= new Set()).add(e.from);
  });
  ir.nodes.forEach(n => { g[n.id] ||= new Set(); });

  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const n of ir.nodes) {
    if (seen.has(n.id)) continue;
    const q = [n.id];
    seen.add(n.id);
    const comp: string[] = [];
    while (q.length) {
      const cur = q.shift()!;
      comp.push(cur);
      g[cur].forEach(nb => {
        if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
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

function buildIndexGraph(original: IR, parts: IR[]): IR {
  // 將每個子圖壓縮為一個 module 節點
  const nodeMap = new Map<string, string>(); // 原 id -> part id
  parts.forEach((p, idx) => {
    p.nodes.forEach(n => nodeMap.set(n.id, `part_${idx}`));
  });

  const nodes: IRNode[] = parts.map((p, idx) => ({
    id: `part_${idx}`,
    kind: 'module',
    name: p.nodes[0]?.path?.split(/[/\\]/)[0] || `Part${idx}`
  }));

  const edgeSet = new Set<string>();
  const edges: IREdge[] = [];
  original.edges.forEach(e => {
    const a = nodeMap.get(e.from);
    const b = nodeMap.get(e.to);
    if (!a || !b || a === b) return;
    const key = `${a}->${b}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ from: a, to: b, type: 'depends' });
  });

  return { meta: original.meta, nodes, edges };
}