import { IRProject, CFG } from '@diagrammender/types';
import { esc, wrap, trunc, sid } from './utils';

export function emitFlowchart(ir: IRProject): string {
  const lines: string[] = ['flowchart TD'];
  for (const mod of Object.values(ir.modules)) {
    for (const fn of mod.functions) {
      const base = `${mod.name}.${fn.name}`;
      lines.push(`subgraph ${base}`);
      const cfg: CFG | undefined = fn.cfg;
      if (!cfg || cfg.nodes.length === 0) {
        const A = sid('A', base), B = sid('B', base);
        lines.push(`${A}((Start))`);
        lines.push(`${B}((End))`);
        lines.push(`${A} --> ${B}`);
      } else {
        for (const n of cfg.nodes) {
          const label = esc(wrap(trunc(n.label || n.kind, 120)));
          const id = sid('N', base + ':' + n.id);
          switch (n.kind) {
            case 'start': lines.push(`${id}((Start))`); break;
            case 'end':   lines.push(`${id}((End))`); break;
            case 'decision': lines.push(`${id}{${label}}`); break;
            default: lines.push(`${id}[${label}]`);
          }
        }
        for (const e of cfg.edges) {
          const a = sid('N', base + ':' + e.from);
          const b = sid('N', base + ':' + e.to);
          const lab = e.label ? ` -- ${esc(e.label)} --> ` : ' --> ';
          lines.push(`${a}${lab}${b}`);
        }
      }
      lines.push(`end`);
    }
  }
  if (lines.length === 1) lines.push('A((Start))-->B((End))');
  return lines.join('\n');
}
