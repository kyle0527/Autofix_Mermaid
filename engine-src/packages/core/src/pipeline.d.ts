import { DiagramKind } from '@diagrammender/types';
import { FixResult } from '@diagrammender/fix-rules-mermaid-compat';
export interface PipelineOptions {
    lang: 'python';
    diagram: DiagramKind;
    mermaidVersion?: 'v10' | 'v11';
}
export declare function runPipeline(files: Record<string, string>, opts: PipelineOptions): Promise<FixResult>;
