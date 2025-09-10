import { IRProject } from '@diagrammender/types';

export function emitClassDiagram(ir: IRProject): string {
  const out: string[] = ['classDiagram'];
  for (const mod of Object.values(ir.modules)) {
    for (const c of mod.classes) {
      out.push(`class ${c.name} {`);
      for (const a of c.attrs) out.push(`  +${a}`);
      for (const m of c.methods) out.push(`  +${m.name}(${m.params.join(', ')})`);
      out.push(`}`);
      for (const b of c.bases) out.push(`${b} <|-- ${c.name}`);
    }
  }
  if (out.length === 1) out.push('class _ { }');
  return out.join('\n');
}
