import { IRProject } from '@diagrammender/types';

export function emitSequenceDiagram(ir: IRProject): string {
  const out: string[] = ['sequenceDiagram'];
  const added = new Set<string>();
  // list all functions as potential callers
  for (const mod of Object.values(ir.modules)) {
    for (const fn of mod.functions) {
      const caller = `${mod.name}.${fn.name}`;
      if (!added.has(caller)) {
        out.push(`participant ${caller.split('.').join('_')} as ${caller}`); // safe ID
        added.add(caller);
      }
    }
  }
  // participants from callGraph or calls
  const participants = new Set<string>();
  if (ir.callGraph) {
    for (const e of ir.callGraph.edges) participants.add(e.toName);
  } else {
    for (const mod of Object.values(ir.modules)) for (const fn of mod.functions)
      for (const c of fn.calls) participants.add(c);
  }
  for (const p of participants) out.push(`participant ${p.split('.').join('_')} as ${p}`);

  // messages
  if (ir.callGraph) {
    for (const e of ir.callGraph.edges) {
      const from = e.from.split('.').join('_');
      const to = (e.toId || e.toName).split('.').join('_');
      out.push(`${from}->>${to}: call()`);
    }
  } else {
    for (const mod of Object.values(ir.modules)) {
      for (const fn of mod.functions) {
        const from = `${mod.name}.${fn.name}`.split('.').join('_');
        for (const c of fn.calls) out.push(`${from}->>${c.split('.').join('_')}: call()`);
      }
    }
  }
  if (out.length === 1) out.push('Note over X: no data');
  return out.join('\n');
}
