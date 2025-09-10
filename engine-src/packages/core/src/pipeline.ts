import { IRProject, DiagramKind } from '@diagrammender/types';
import { parsePythonProject } from '@diagrammender/parsers-python';
import { buildCFG, buildCallGraph } from '@diagrammender/analyzers';
import { emitFlowchart, emitClassDiagram, emitSequenceDiagram } from '@diagrammender/emitters-mermaid';
import { applyAll, FixResult } from '@diagrammender/fix-rules-mermaid-compat';

export interface PipelineOptions {
  lang: 'python';
  diagram: DiagramKind;
  mermaidVersion?: 'v10'|'v11';
}

export async function runPipeline(files: Record<string,string>, opts: PipelineOptions): Promise<FixResult> {
  let ir: IRProject;
  switch (opts.lang) {
    case 'python':
      ir = parsePythonProject(files);
      break;
    default:
      throw new Error(`Unsupported lang: ${opts.lang}`);
  }
  // analyzers
  for (const mod of Object.values(ir.modules)) {
    for (const fn of mod.functions) {
      fn.cfg = buildCFG(fn);
    }
  }
  ir.callGraph = buildCallGraph(ir);

  // emit
  let code = '';
  switch (opts.diagram) {
    case 'flowchart':       code = emitFlowchart(ir); break;
    case 'classDiagram':    code = emitClassDiagram(ir); break;
    case 'sequenceDiagram': code = emitSequenceDiagram(ir); break;
    default:                code = emitFlowchart(ir);
  }
  // fix
  const { code: fixed, notes } = applyAll(code, { diagram: opts.diagram, mermaidVersion: opts.mermaidVersion ?? 'v11' });
  return { code: fixed, notes };
}
