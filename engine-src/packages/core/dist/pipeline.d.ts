import { IRProject, DiagramKind, ParserParseOptions, ParserPlugin, ParserDetectionResult, MermaidFragment, MermaidLink } from '@diagrammender/types';
import { FixResult } from '@diagrammender/fix-rules-mermaid-compat';
export interface PipelineOptions {
    lang?: string;
    diagram: DiagramKind;
    mermaidVersion?: 'v10' | 'v11';
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
export declare function runPipeline(files: Record<string, string>, opts: PipelineOptions): Promise<PipelineResult>;
