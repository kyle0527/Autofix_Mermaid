import { IRProject, MermaidFragment } from '@diagrammender/types';
import { composeMermaid } from './compose';

function buildClassFragment(modName: string, modPath: string, cls: IRProject['modules'][string]['classes'][number]): MermaidFragment {
  const lines: string[] = [];
  lines.push(`class ${cls.name} {`);
  for (const a of cls.attrs) lines.push(`  +${a}`);
  for (const m of cls.methods) lines.push(`  +${m.name}(${m.params.join(', ')})`);
  lines.push('}');
  for (const b of cls.bases) lines.push(`${b} <|-- ${cls.name}`);
  return {
    id: cls.id,
    title: cls.name,
    diagram: 'classDiagram',
    code: lines.join('\n'),
    source: { module: modName, path: modPath },
  };
}

export function emitClassDiagramFragments(ir: IRProject): MermaidFragment[] {
  const fragments: MermaidFragment[] = [];
  for (const mod of Object.values(ir.modules)) {
    for (const cls of mod.classes) {
      fragments.push(buildClassFragment(mod.name, mod.path, cls));
    }
  }
  if (fragments.length === 0) {
    fragments.push({
      id: 'class-empty',
      title: 'empty',
      diagram: 'classDiagram',
      code: 'class _ { }',
    });
  }
  return fragments;
}

export function emitClassDiagram(ir: IRProject): string {
  return composeMermaid('classDiagram', emitClassDiagramFragments(ir));
}
