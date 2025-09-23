import {
  DiagramKind,
  IRProject,
  ParserParseOptions,
  ParserPlugin,
  ParserDetectionResult,
  MermaidFragment,
  MermaidLink,
  ParserCapabilities,
} from '@diagrammender/types';
import { runPipeline as runCorePipeline, PipelineOptions, PipelineResult, PipelineTraceEntry } from './pipeline';
import {
  emitFlowchartFragments,
  emitClassDiagramFragments,
  emitSequenceFragments,
  emitCallGraphFragments,
  emitDependencyGraphFragments,
  composeMermaid,
  buildFlowchartLinks,
} from '@diagrammender/emitters-mermaid';
import { applyAll } from '@diagrammender/fix-rules-mermaid-compat';
import { buildCFG, buildCallGraph, buildDependencyGraph } from '@diagrammender/analyzers';

const ENGINE_VERSION = '0.3.0';
const ENGINE_SOURCE = `browser-core@${ENGINE_VERSION}`;

type WorkerLogEntry = { rule: string; msg: string; meta?: any };
type EngineMeta = { source: string; version: string };
type BrowserPluginInfo = {
  lang: string;
  version: string;
  aliases?: string[];
  capabilities?: ParserCapabilities;
  treeSitterModule?: string;
};

export interface BrowserPipelineResult {
  code: string;
  dtype: DiagramKind;
  errors: Array<{ message: string; stack?: string }>;
  log: WorkerLogEntry[];
  fragments: MermaidFragment[];
  links: MermaidLink[];
  rawCode: string;
  notes: string[];
  detection?: ParserDetectionResult | null;
  plugin?: BrowserPluginInfo | null;
  trace: PipelineTraceEntry[];
  ir: IRProject;
  engine: EngineMeta;
}

function normalizeDiagram(diagram?: string | null): DiagramKind {
  switch (diagram) {
    case 'sequenceDiagram':
    case 'classDiagram':
    case 'callGraph':
    case 'dependencyGraph':
      return diagram;
    default:
      return 'flowchart';
  }
}

function normalizeParserOptions(options?: ParserParseOptions): ParserParseOptions {
  const normalized = { ...options };
  normalized.runtime = 'browser';
  if (normalized.preferTreeSitter === false) {
    return normalized;
  }
  if (normalized.webTreeSitter) {
    normalized.preferTreeSitter = true;
  } else if (typeof normalized.preferTreeSitter === 'undefined') {
    normalized.preferTreeSitter = true;
  }
  return normalized;
}

function normalizePipelineOptions(diagram: DiagramKind, options: any | undefined): PipelineOptions {
  const candidateLangs = Array.isArray(options?.candidateLangs)
    ? (options?.candidateLangs as string[])
    : undefined;

  const parserOptions = normalizeParserOptions(options?.parserOptions as ParserParseOptions | undefined);
  const mermaidVersion = options?.mermaidVersion === 'v10' ? 'v10' : 'v11';

  return {
    diagram,
    lang: typeof options?.lang === 'string' ? (options.lang as string) : undefined,
    detect: options?.detect !== false,
    candidateLangs,
    parserOptions,
    mermaidVersion,
  };
}

function sanitizePlugin(plugin?: ParserPlugin | null): BrowserPluginInfo | null {
  if (!plugin) return null;
  const info: BrowserPluginInfo = {
    lang: plugin.lang,
    version: plugin.version,
  };
  if (Array.isArray(plugin.aliases)) info.aliases = [...plugin.aliases];
  if (plugin.capabilities) info.capabilities = { ...plugin.capabilities };
  if (typeof plugin.treeSitterModule === 'string') info.treeSitterModule = plugin.treeSitterModule;
  return info;
}

function buildLogEntries(result: PipelineResult, diagram: DiagramKind): WorkerLogEntry[] {
  const entries: WorkerLogEntry[] = [];
  if (result.detection) {
    entries.push({
      rule: 'pipeline.detect',
      msg: `detected ${result.detection.lang} (${result.detection.confidence})`,
      meta: { ...result.detection },
    });
  }
  if (result.ir?.parserMeta) {
    const meta = result.ir.parserMeta;
    if (meta.implementation === 'web-tree-sitter') {
      entries.push({ rule: 'worker.wts', msg: 'web-tree-sitter used', meta: { ...meta } as any });
    } else if (meta.implementation === 'tree-sitter') {
      entries.push({
        rule: 'pipeline.parser',
        msg: `tree-sitter (${meta.runtime ?? 'node'})`,
        meta: { ...meta } as any,
      });
    } else if (meta.implementation === 'fallback') {
      entries.push({
        rule: 'pipeline.parser',
        msg: 'fallback parser used',
        meta: { ...meta } as any,
      });
    }
  }
  for (const entry of result.trace || []) {
    entries.push({
      rule: `pipeline.${entry.stage}`,
      msg: `${entry.stage} (${Math.round(entry.durationMs)} ms)`,
      meta: {
        ...entry.meta,
        details: entry.details,
      } as any,
    });
  }
  if (result.notes?.length) {
    for (const note of result.notes) {
      entries.push({ rule: 'pipeline.fixNote', msg: note });
    }
  }
  entries.push({
    rule: 'pipeline.diagram',
    msg: `composed ${diagram} with ${result.fragments.length} fragment(s)`
      + (diagram === 'flowchart' ? ` and ${result.links.length} link(s)` : ''),
  });
  return entries;
}

function createBrowserResult(diagram: DiagramKind, pipeline: PipelineResult, extras: Partial<BrowserPipelineResult> = {}): BrowserPipelineResult {
  return {
    code: pipeline.code,
    dtype: diagram,
    errors: [],
    log: buildLogEntries(pipeline, diagram),
    fragments: pipeline.fragments,
    links: pipeline.links,
    rawCode: pipeline.rawCode,
    notes: pipeline.notes,
    detection: pipeline.detection,
    plugin: sanitizePlugin(pipeline.plugin),
    trace: pipeline.trace,
    ir: pipeline.ir,
    engine: { source: ENGINE_SOURCE, version: ENGINE_VERSION },
    ...extras,
  };
}

export async function runPipeline(files: Record<string, string>, options: any = {}): Promise<BrowserPipelineResult> {
  const diagram = normalizeDiagram((options.diagram as string) || (options.mode as string) || (options.dtype as string));
  const pipelineOptions = normalizePipelineOptions(diagram, options);
  const pipelineResult = await runCorePipeline(files || {}, pipelineOptions);
  return createBrowserResult(diagram, pipelineResult);
}

function ensureAnalysis(ir: IRProject): void {
  for (const mod of Object.values(ir.modules || {})) {
    for (const fn of mod.functions || []) {
      if (!fn.cfg) {
        fn.cfg = buildCFG(fn);
      }
    }
    for (const cls of mod.classes || []) {
      for (const method of cls.methods || []) {
        if (!method.cfg) {
          method.cfg = buildCFG(method);
        }
      }
    }
  }
  if (!ir.callGraph || !Array.isArray(ir.callGraph.edges)) {
    ir.callGraph = buildCallGraph(ir);
  }
  if (!ir.dependencyGraph || !Array.isArray(ir.dependencyGraph.edges)) {
    ir.dependencyGraph = buildDependencyGraph(ir);
  }
}

export async function runPipelineIR(ir: IRProject, options: any = {}): Promise<BrowserPipelineResult> {
  const diagram = normalizeDiagram((options.diagram as string) || (options.mode as string) || (options.dtype as string));
  const project: IRProject = ir || { modules: {} };
  ensureAnalysis(project);

  let fragments: MermaidFragment[] = [];
  switch (diagram) {
    case 'classDiagram':
      fragments = emitClassDiagramFragments(project);
      break;
    case 'sequenceDiagram':
      fragments = emitSequenceFragments(project);
      break;
    case 'callGraph':
      fragments = emitCallGraphFragments(project);
      break;
    case 'dependencyGraph':
      fragments = emitDependencyGraphFragments(project);
      break;
    default:
      fragments = emitFlowchartFragments(project);
      break;
  }

  const links: MermaidLink[] = diagram === 'flowchart'
    ? buildFlowchartLinks(project.callGraph, fragments)
    : [];

  const rawCode = composeMermaid(diagram, fragments, { links });
  const mermaidVersion = options?.mermaidVersion === 'v10' ? 'v10' : 'v11';
  const fixDiagram: 'flowchart' | 'classDiagram' | 'sequenceDiagram' =
    diagram === 'flowchart' || diagram === 'classDiagram' || diagram === 'sequenceDiagram'
      ? diagram
      : 'flowchart';
  const { code, notes } = applyAll(rawCode, { diagram: fixDiagram, mermaidVersion });

  const trace: PipelineTraceEntry[] = [
    {
      stage: 'emit',
      startedAt: Date.now(),
      durationMs: 0,
      details: 'runPipelineIR emit',
      meta: {
        diagram,
        fragments: fragments.length,
        links: links.length,
      },
    },
    {
      stage: 'fix',
      startedAt: Date.now(),
      durationMs: 0,
      details: 'runPipelineIR fix',
      meta: {
        notes: notes.length,
      },
    },
  ];

  const pipelineLike: PipelineResult = {
    code,
    notes,
    plugin: {
      lang: typeof options?.lang === 'string' ? (options.lang as string) : 'ir',
      version: 'ir',
      parseProject: () => project,
    } as ParserPlugin,
    detection: undefined,
    ir: project,
    rawCode,
    fragments,
    links,
    trace,
  };

  return createBrowserResult(diagram, pipelineLike);
}

const DiagramMenderCore = {
  runPipeline,
  runPipelineIR,
  composeMermaid,
  version: ENGINE_SOURCE,
};

if (typeof globalThis !== 'undefined') {
  (globalThis as typeof globalThis & { DiagramMenderCore?: typeof DiagramMenderCore }).DiagramMenderCore = DiagramMenderCore;
}

export default DiagramMenderCore;
