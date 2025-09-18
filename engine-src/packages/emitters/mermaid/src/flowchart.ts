import { IRProject, CFG, CallGraph, MermaidFragment, MermaidLink } from '@diagrammender/types';
import { esc, wrap, trunc, sid } from './utils';
import { composeMermaid } from './compose';

interface FunctionFragmentContext {
  className?: string;
}

function buildFunctionFragment(
  modName: string,
  modPath: string,
  fn: { id?: string; name: string; cfg?: CFG },
  ctx?: FunctionFragmentContext,
): MermaidFragment {
  const fragmentId = fn.id || `${modName}.${fn.name}`;
  const lines: string[] = [`subgraph ${fragmentId}`];
  const cfg: CFG | undefined = fn.cfg;
  let entryNode: string | undefined;
  let exitNode: string | undefined;
  if (!cfg || cfg.nodes.length === 0) {
    const A = sid('A', fragmentId);
    const B = sid('B', fragmentId);
    lines.push(`${A}((Start))`);
    lines.push(`${B}((End))`);
    lines.push(`${A} --> ${B}`);
    entryNode = A;
    exitNode = B;
  } else {
    for (const n of cfg.nodes) {
      const label = esc(wrap(trunc(n.label || n.kind, 120)));
      const id = sid('N', fragmentId + ':' + n.id);
      switch (n.kind) {
        case 'start':
          lines.push(`${id}((Start))`);
          if (!entryNode) entryNode = id;
          break;
        case 'end':
          lines.push(`${id}((End))`);
          if (!exitNode) exitNode = id;
          break;
        case 'decision':
          lines.push(`${id}{${label}}`);
          break;
        default:
          lines.push(`${id}[${label}]`);
      }
    }
    for (const e of cfg.edges) {
      const a = sid('N', fragmentId + ':' + e.from);
      const b = sid('N', fragmentId + ':' + e.to);
      const lab = e.label ? ` -- ${esc(e.label)} --> ` : ' --> ';
      lines.push(`${a}${lab}${b}`);
    }
    if (!entryNode && cfg.nodes.length > 0) {
      entryNode = sid('N', fragmentId + ':' + cfg.nodes[0].id);
    }
    if (!exitNode && cfg.nodes.length > 0) {
      const last = cfg.nodes[cfg.nodes.length - 1];
      exitNode = sid('N', fragmentId + ':' + last.id);
    }
  }
  lines.push('end');
  return {
    id: fragmentId,
    title: ctx?.className ? `${ctx.className}.${fn.name}` : `${modName}.${fn.name}`,
    diagram: 'flowchart',
    code: lines.join('\n'),
    source: { module: modName, function: fn.name, class: ctx?.className, path: modPath },
    anchors: entryNode || exitNode ? { entry: entryNode, exit: exitNode } : undefined,
  };
}

export function emitFlowchartFragments(ir: IRProject): MermaidFragment[] {
  const fragments: MermaidFragment[] = [];
  for (const mod of Object.values(ir.modules)) {
    for (const fn of mod.functions) {
      fragments.push(buildFunctionFragment(mod.name, mod.path, fn));
    }
    for (const cls of mod.classes || []) {
      for (const method of cls.methods || []) {
        fragments.push(
          buildFunctionFragment(mod.name, mod.path, method, { className: cls.name }),
        );
      }
    }
  }
  if (fragments.length === 0) {
    fragments.push({
      id: 'flowchart-empty',
      title: 'empty',
      diagram: 'flowchart',
      code: 'A((Start))-->B((End))',
    });
  }
  return fragments;
}

export function buildFlowchartLinks(
  callGraph: CallGraph | undefined,
  fragments: MermaidFragment[],
): MermaidLink[] {
  if (!callGraph?.edges?.length) {
    return [];
  }
  const fragmentMap = new Map<string, MermaidFragment>();
  for (const fragment of fragments) {
    fragmentMap.set(fragment.id, fragment);
  }
  const links: MermaidLink[] = [];
  const dedupe = new Set<string>();
  for (const edge of callGraph.edges) {
    if (!edge.toId) continue;
    const fromFragment = fragmentMap.get(edge.from);
    const toFragment = fragmentMap.get(edge.toId);
    if (!fromFragment || !toFragment) continue;
    const fromAnchor = fromFragment.anchors?.exit ? 'exit' : undefined;
    const toAnchor = toFragment.anchors?.entry ? 'entry' : undefined;
    if (!fromAnchor && !toAnchor) continue;
    const key = `${fromFragment.id}|${toFragment.id}|${fromAnchor ?? ''}|${toAnchor ?? ''}|${edge.toName ?? ''}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    links.push({
      diagram: 'flowchart',
      fromFragment: fromFragment.id,
      toFragment: toFragment.id,
      fromAnchor,
      toAnchor,
      label: edge.toName && edge.toName !== edge.toId ? edge.toName : undefined,
      style: 'solid',
    });
  }
  return links;
}

export function emitFlowchart(ir: IRProject): string {
  const fragments = emitFlowchartFragments(ir);
  const links = buildFlowchartLinks(ir.callGraph, fragments);
  return composeMermaid('flowchart', fragments, { links });
}
