import { IRProject, CallGraph, CallEdge } from '@diagrammender/types';

export function buildCallGraph(project: IRProject): CallGraph {
  const edges: CallEdge[] = [];
  const nameToId = new Map<string, string>();

  const register = (name: string | undefined, id: string) => {
    if (!name) return;
    const normalized = name.replace(/::/g, '.');
    if (!nameToId.has(normalized)) {
      nameToId.set(normalized, id);
    }
  };

  for (const mod of Object.values(project.modules)) {
    for (const fn of mod.functions) {
      register(fn.id, fn.id);
      register(`${mod.name}.${fn.name}`, fn.id);
      register(fn.name, fn.id);
    }
    for (const cls of mod.classes || []) {
      for (const method of cls.methods || []) {
        register(method.id, method.id);
        register(`${mod.name}.${method.name}`, method.id);
        register(`${cls.name}.${method.name}`, method.id);
        register(`${mod.name}.${cls.name}.${method.name}`, method.id);
        register(method.name, method.id);
      }
    }
  }

  const resolveTarget = (rawName: string): string | undefined => {
    if (!rawName) return undefined;
    const normalized = rawName.replace(/::/g, '.');
    const direct = nameToId.get(normalized);
    if (direct) return direct;
    const parts = normalized.split('.');
    for (let i = 0; i < parts.length; i += 1) {
      const suffix = parts.slice(i).join('.');
      const match = nameToId.get(suffix);
      if (match) return match;
    }
    return undefined;
  };

  for (const mod of Object.values(project.modules)) {
    for (const fn of mod.functions) {
      for (const callee of fn.calls || []) {
        const toId = resolveTarget(callee);
        edges.push({ from: fn.id, toName: callee, toId });
      }
    }
    for (const cls of mod.classes || []) {
      for (const method of cls.methods || []) {
        for (const callee of method.calls || []) {
          const toId = resolveTarget(callee);
          edges.push({ from: method.id, toName: callee, toId });
        }
      }
    }
  }
  return { edges };
}
