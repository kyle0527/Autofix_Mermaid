import { IRProject, CallGraph, CallEdge } from '@diagrammender/types';

export function buildCallGraph(project: IRProject): CallGraph {
  const edges: CallEdge[] = [];
  const nameToId = new Map<string, string>();
  for (const mod of Object.values(project.modules)) {
    for (const fn of mod.functions) {
      nameToId.set(`${mod.name}.${fn.name}`, fn.id);
    }
  }
  for (const mod of Object.values(project.modules)) {
    for (const fn of mod.functions) {
      for (const callee of fn.calls || []) {
        const toId = nameToId.get(callee) || undefined;
        edges.push({ from: fn.id, toName: callee, toId });
      }
    }
  }
  return { edges };
}
