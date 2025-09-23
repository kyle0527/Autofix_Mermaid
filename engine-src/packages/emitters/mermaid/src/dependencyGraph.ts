import { IRProject, MermaidFragment } from '@diagrammender/types';
import { composeMermaid } from './compose';
import { esc, wrap, trunc, sid } from './utils';

type NodeInfo = {
  nodeId: string;
  label: string;
  sortKey: string;
  external?: boolean;
};

type EdgeInfo = {
  line: string;
  sortKey: string;
};

function formatLabel(primary: string, secondary?: string): string {
  const parts = [primary];
  if (secondary && secondary !== primary) {
    parts.push(secondary);
  }
  const formatted = parts
    .map((part) => wrap(trunc(part, 96), 32))
    .join('\n');
  return esc(formatted);
}

function collectModuleNodes(ir: IRProject): Map<string, NodeInfo> {
  const nodes = new Map<string, NodeInfo>();
  const modules = Object.values(ir.modules || {}).sort((a, b) => a.name.localeCompare(b.name));
  for (const mod of modules) {
    const nodeId = sid('dep', mod.name || mod.path);
    const secondary = mod.path && mod.path !== mod.name ? mod.path : undefined;
    const label = formatLabel(mod.name, secondary);
    nodes.set(mod.name, { nodeId, label, sortKey: `${mod.name}|${nodeId}` });
  }
  return nodes;
}

function ensureDependencyTarget(
  modules: Map<string, NodeInfo>,
  externals: Map<string, NodeInfo>,
  target: string,
  isExternal: boolean | undefined,
): NodeInfo | undefined {
  if (!target) return undefined;
  const existingInternal = modules.get(target);
  if (existingInternal) {
    return existingInternal;
  }
  const key = target;
  let existing = externals.get(key);
  if (existing) return existing;
  const nodeId = sid('dep_ext', key);
  existing = {
    nodeId,
    label: formatLabel(target),
    sortKey: `~external|${target}|${nodeId}`,
    external: true,
  };
  externals.set(key, existing);
  return existing;
}

function buildDependencyEdges(
  ir: IRProject,
  modules: Map<string, NodeInfo>,
): { edges: EdgeInfo[]; externals: Map<string, NodeInfo> } {
  const externals = new Map<string, NodeInfo>();
  const records: EdgeInfo[] = [];
  const seen = new Set<string>();
  const depGraph = ir.dependencyGraph?.edges || [];

  for (const edge of depGraph) {
    const fromNode = modules.get(edge.from);
    if (!fromNode) continue;
    const toNode = ensureDependencyTarget(modules, externals, edge.to, edge.isExternal);
    if (!toNode) continue;
    const isExternal = toNode.external ?? edge.isExternal ?? false;
    const arrow = isExternal ? '-.->' : '-->';
    const labelText = edge.symbols && edge.symbols.length
      ? esc(wrap(trunc(edge.symbols.join(', '), 96), 32))
      : undefined;
    const labelChunk = labelText ? `|${labelText}|` : '';
    const key = `${fromNode.nodeId}|${toNode.nodeId}|${labelChunk}|${arrow}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({
      line: `${fromNode.nodeId} ${arrow}${labelChunk} ${toNode.nodeId}`,
      sortKey: `${fromNode.sortKey}|${toNode.sortKey}|${labelText ?? ''}`,
    });
  }

  records.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return { edges: records, externals };
}

export function emitDependencyGraphFragments(ir: IRProject): MermaidFragment[] {
  const moduleNodes = collectModuleNodes(ir);
  const { edges, externals } = buildDependencyEdges(ir, moduleNodes);

  const internalNodes = Array.from(moduleNodes.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const externalNodes = Array.from(externals.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const nodeLines: string[] = [];
  for (const node of internalNodes) {
    nodeLines.push(`${node.nodeId}["${node.label}"]`);
  }
  for (const node of externalNodes) {
    nodeLines.push(`${node.nodeId}["${node.label}"]`);
  }

  const edgeLines = edges.map((record) => record.line);

  const lines: string[] = [];
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
    lines.push('dependencyGraphEmpty["No dependencies found"]');
  }

  return [{
    id: 'dependencyGraph',
    title: 'Dependency Graph',
    diagram: 'dependencyGraph',
    code: lines.join('\n'),
  }];
}

export function emitDependencyGraph(ir: IRProject): string {
  return composeMermaid('dependencyGraph', emitDependencyGraphFragments(ir));
}
