import { DiagramKind, IRProject, ParserDetectionResult, MermaidFragment, MermaidLink, ParserCapabilities } from '@diagrammender/types';
import { PipelineTraceEntry } from './pipeline';
import { composeMermaid } from '@diagrammender/emitters-mermaid';
type WorkerLogEntry = {
    rule: string;
    msg: string;
    meta?: any;
};
type EngineMeta = {
    source: string;
    version: string;
};
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
    errors: Array<{
        message: string;
        stack?: string;
    }>;
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
export declare function runPipeline(files: Record<string, string>, options?: any): Promise<BrowserPipelineResult>;
export declare function runPipelineIR(ir: IRProject, options?: any): Promise<BrowserPipelineResult>;
declare const DiagramMenderCore: {
    runPipeline: typeof runPipeline;
    runPipelineIR: typeof runPipelineIR;
    composeMermaid: typeof composeMermaid;
    version: string;
};
export default DiagramMenderCore;
