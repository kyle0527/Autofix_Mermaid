import { IRProject, CallGraph, MermaidFragment, MermaidLink } from '@diagrammender/types';
export declare function emitFlowchartFragments(ir: IRProject): MermaidFragment[];
export declare function buildFlowchartLinks(callGraph: CallGraph | undefined, fragments: MermaidFragment[]): MermaidLink[];
export declare function emitFlowchart(ir: IRProject): string;
