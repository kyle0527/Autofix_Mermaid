import {
  IRProject,
  DiagramKind,
  ParserParseOptions,
  ParserPlugin,
  ParserDetectionResult,
  MermaidFragment,
  MermaidLink,
} from '@diagrammender/types';
import { buildCFG, buildCallGraph } from '@diagrammender/analyzers';
import {
  emitFlowchartFragments,
  emitClassDiagramFragments,
  emitSequenceFragments,
  composeMermaid,
  buildFlowchartLinks,
} from '@diagrammender/emitters-mermaid';
import { applyAll, FixResult } from '@diagrammender/fix-rules-mermaid-compat';
import { resolveParserPlugin } from './parsers';

export interface PipelineOptions {
  lang?: string;
  diagram: DiagramKind;
  mermaidVersion?: 'v10'|'v11';
  parserOptions?: ParserParseOptions;
  detect?: boolean;
  candidateLangs?: string[];
}

export interface PipelineResult extends FixResult {
  plugin: ParserPlugin;
  detection?: ParserDetectionResult;
  ir: IRProject;
  rawCode: string;
  fragments: MermaidFragment[];
  links: MermaidLink[];
  trace: PipelineTraceEntry[];
}

export type PipelineStage = 'detect' | 'parse' | 'analyze' | 'emit' | 'fix';

export interface PipelineTraceEntry {
  stage: PipelineStage;
  startedAt: number;
  durationMs: number;
  details?: string;
  meta?: Record<string, unknown>;
}

export async function runPipeline(files: Record<string,string>, opts: PipelineOptions): Promise<PipelineResult> {
  const trace: PipelineTraceEntry[] = [];
  const now = () => Date.now();

  const detectStart = now();
  const { plugin, detection } = await resolveParserPlugin({
    lang: opts.lang,
    files,
    detect: opts.detect !== false,
    candidates: opts.candidateLangs,
  });
  trace.push({
    stage: 'detect',
    startedAt: detectStart,
    durationMs: now() - detectStart,
    details: detection
      ? `resolved ${detection.lang} (${detection.confidence})`
      : `explicit ${plugin.lang}`,
    meta: {
      plugin: plugin.lang,
      version: plugin.version,
      detection,
    },
  });

  const parseStart = now();
  const ir: IRProject = await plugin.parseProject(files, opts.parserOptions);
  trace.push({
    stage: 'parse',
    startedAt: parseStart,
    durationMs: now() - parseStart,
    meta: {
      modules: Object.keys(ir.modules ?? {}).length,
      capabilities: plugin.capabilities,
    },
  });

  const analyzeStart = now();
  let functionCount = 0;
  let methodCount = 0;
  let classCount = 0;
  // analyzers
  for (const mod of Object.values(ir.modules)) {
    classCount += mod.classes?.length ?? 0;
    for (const fn of mod.functions) {
      functionCount += 1;
      fn.cfg = buildCFG(fn);
    }
    for (const cls of mod.classes || []) {
      for (const method of cls.methods || []) {
        functionCount += 1;
        methodCount += 1;
        method.cfg = buildCFG(method);
      }
    }
  }
  ir.callGraph = buildCallGraph(ir);
  trace.push({
    stage: 'analyze',
    startedAt: analyzeStart,
    durationMs: now() - analyzeStart,
    meta: {
      functions: functionCount,
      methods: methodCount,
      classes: classCount,
      callEdges: ir.callGraph?.edges.length ?? 0,
    },
  });

  // emit
  const diagram: DiagramKind = opts.diagram;
  const emitStart = now();
  let fragments: MermaidFragment[] = [];
  switch (diagram) {
    case 'flowchart':
      fragments = emitFlowchartFragments(ir);
      break;
    case 'classDiagram':
      fragments = emitClassDiagramFragments(ir);
      break;
    case 'sequenceDiagram':
      fragments = emitSequenceFragments(ir);
      break;
    default:
      fragments = emitFlowchartFragments(ir);
      break;
  }
  const links: MermaidLink[] = diagram === 'flowchart'
    ? buildFlowchartLinks(ir.callGraph, fragments)
    : [];

  const rawCode = composeMermaid(diagram, fragments, { links });
  trace.push({
    stage: 'emit',
    startedAt: emitStart,
    durationMs: now() - emitStart,
    meta: {
      diagram,
      fragments: fragments.length,
      links: links.length,
      rawLength: rawCode.length,
    },
  });

  // fix
  const fixStart = now();
  const { code: fixed, notes } = applyAll(rawCode, { diagram, mermaidVersion: opts.mermaidVersion ?? 'v11' });
  trace.push({
    stage: 'fix',
    startedAt: fixStart,
    durationMs: now() - fixStart,
    meta: {
      notes: notes.length,
      delta: fixed.length - rawCode.length,
    },
  });

  if (notes.length) {
    ir.fixNotes = (ir.fixNotes || []).concat(notes);
  }

  return { code: fixed, notes, plugin, detection, ir, rawCode, fragments, links, trace };
}
