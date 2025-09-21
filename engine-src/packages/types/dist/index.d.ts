/**
 * Core type definitions for DiagramMender
 * @fileoverview Intermediate Representation (IR) types for code analysis
 */
/**
 * Complete project analysis result
 */
export interface IRProject {
    /** Map of module name to module definition */
    modules: Record<string, IRModule>;
    /** Notes from fix rules processing */
    fixNotes?: string[];
    /** Call graph analysis result */
    callGraph?: CallGraph;
}
/**
 * Single module (file) representation
 */
export interface IRModule {
    /** Module name (derived from file path) */
    name: string;
    /** Original file path */
    path: string;
    /** Class definitions in this module */
    classes: IRClass[];
    /** Function definitions in this module */
    functions: IRFunction[];
    /** Import statements */
    imports: string[];
}
/**
 * Class definition
 */
export interface IRClass {
    /** Unique identifier (module.class) */
    id: string;
    /** Class name */
    name: string;
    /** Base class names */
    bases: string[];
    /** Class attributes */
    attrs: string[];
    /** Method definitions */
    methods: IRFunction[];
    /** Source position */
    pos: IRPos;
    /** Docstring */
    doc?: string;
}
/**
 * Function/method definition
 */
export interface IRFunction {
    /** Unique identifier (module.function) */
    id: string;
    /** Function name */
    name: string;
    /** Parameter names */
    params: string[];
    /** Function body statements */
    body: IRStatement[];
    /** Function calls (textual names, pre-analysis) */
    calls: string[];
    /** Source position */
    pos: IRPos;
    /** Docstring */
    doc?: string;
    /** Control flow graph (from analyzer) */
    cfg?: CFG;
}
/**
 * Python statement types
 */
export type IRStatement = IRIfStatement | IRForStatement | IRWhileStatement | IRTryStatement | IRSimpleStatement;
export interface IRIfStatement {
    kind: 'if';
    text: string;
    pos: IRPos;
    cond: string;
    then: IRStatement[];
    else?: IRStatement[];
}
export interface IRForStatement {
    kind: 'for';
    text: string;
    pos: IRPos;
    target: string;
    iter: string;
    body: IRStatement[];
    else?: IRStatement[];
}
export interface IRWhileStatement {
    kind: 'while';
    text: string;
    pos: IRPos;
    cond: string;
    body: IRStatement[];
    else?: IRStatement[];
}
export interface IRTryStatement {
    kind: 'try';
    text: string;
    pos: IRPos;
    body: IRStatement[];
    excepts: Array<{
        type?: string;
        name?: string;
        body: IRStatement[];
    }>;
    finally?: IRStatement[];
}
export interface IRSimpleStatement {
    kind: 'return' | 'raise' | 'break' | 'continue' | 'assign' | 'expr';
    text: string;
    pos: IRPos;
}
/**
 * Source code position information
 */
export interface IRPos {
    /** File path */
    file: string;
    /** Starting line number (1-based) */
    line: number;
    /** Ending line number (1-based) */
    endLine?: number;
}
/**
 * Control Flow Graph node
 */
export interface CFGNode {
    /** Unique node identifier */
    id: string;
    /** Node type */
    kind: 'start' | 'end' | 'op' | 'decision' | 'merge' | 'loop' | 'try' | 'except';
    /** Optional label for display */
    label?: string;
}
/**
 * Control Flow Graph edge
 */
export interface CFGEdge {
    /** Source node ID */
    from: string;
    /** Target node ID */
    to: string;
    /** Optional edge label */
    label?: string;
}
/**
 * Complete Control Flow Graph
 */
export interface CFG {
    /** All nodes in the graph */
    nodes: CFGNode[];
    /** All edges in the graph */
    edges: CFGEdge[];
}
/**
 * Call graph edge representing function call
 */
export interface CallEdge {
    /** Calling function ID */
    from: string;
    /** Called function name (textual) */
    toName: string;
    /** Called function ID (if resolved) */
    toId?: string;
}
/**
 * Complete call graph
 */
export interface CallGraph {
    /** All call relationships */
    edges: CallEdge[];
}
/**
 * Supported diagram types
 */
export type DiagramKind = 'flowchart' | 'classDiagram' | 'sequenceDiagram';
/**
 * Anchor points that other fragments or links can target when composing diagrams.
 *
 * - `entry` typically maps to the first logical node in the fragment (e.g., CFG start).
 * - `exit` maps to the terminating node of the fragment.
 * - `center` can be used for class/sequence diagrams to point at a stable element.
 */
export interface MermaidFragmentAnchors {
    entry?: string;
    exit?: string;
    center?: string;
}
/**
 * Describes a connection between two fragments so the composer can weave them together.
 */
export interface MermaidLink {
    /** Diagram that the link belongs to. */
    diagram: DiagramKind;
    /** Fragment providing the source anchor for the link. */
    fromFragment: string;
    /** Fragment providing the destination anchor for the link. */
    toFragment: string;
    /** Optional anchor hint on the source fragment (`entry`, `exit`, `center`). */
    fromAnchor?: keyof MermaidFragmentAnchors;
    /** Optional anchor hint on the destination fragment (`entry`, `exit`, `center`). */
    toAnchor?: keyof MermaidFragmentAnchors;
    /** Optional label that will be rendered on the link (implementation specific). */
    label?: string;
    /** Optional style hint (solid | dashed | dotted). */
    style?: 'solid' | 'dashed' | 'dotted';
}
/**
 * Reusable chunk of Mermaid syntax that can be composed into larger diagrams.
 */
export interface MermaidFragment {
    /** Stable identifier for the fragment. */
    id: string;
    /** Human readable label for UIs. */
    title: string;
    /** Diagram type this fragment belongs to. */
    diagram: DiagramKind;
    /** Mermaid syntax representing the fragment body (no header). */
    code: string;
    /** Optional source attribution for debugging. */
    source?: {
        module?: string;
        function?: string;
        class?: string;
        path?: string;
    };
    /** Anchor metadata used for downstream composition utilities. */
    anchors?: MermaidFragmentAnchors;
}
/**
 * Supported parser runtime targets
 */
export type ParserRuntime = 'node' | 'browser';
/**
 * Optional parsing options that can be provided to parser plugins.
 * They express high level intents (prefer tree-sitter, allow incremental parsing, etc.).
 */
export interface ParserParseOptions {
    /**
     * Hint for the parser to attempt tree-sitter when available. Defaults to true in Node.
     */
    preferTreeSitter?: boolean;
    /**
     * Whether the caller is requesting incremental parsing support (if the plugin implements it).
     */
    incremental?: boolean;
    /**
     * Runtime environment where the parser executes.
     */
    runtime?: ParserRuntime;
}
/**
 * Confidence score returned by parser detection heuristics.
 */
export type ParserDetectConfidence = 'low' | 'medium' | 'high';
/**
 * Result of running detection logic on an arbitrary file set.
 */
export interface ParserDetectionResult {
    /** Resolved language identifier. */
    lang: string;
    /** Confidence level of the detection. */
    confidence: ParserDetectConfidence;
    /** Short human readable reason. */
    reason?: string;
    /** Representative files used for detection. */
    matchedFiles?: string[];
}
/**
 * Capabilities advertised by the parser plugin.
 */
export interface ParserCapabilities {
    /** Supports incremental parsing. */
    incremental?: boolean;
    /** Uses tree-sitter internally (Node build). */
    treeSitter?: boolean;
    /** Provides a fallback parser when tree-sitter is unavailable. */
    fallback?: boolean;
}
/**
 * Parser plugin contract used by the core pipeline.
 */
export interface ParserPlugin {
    /** Primary language identifier (e.g. `python`). */
    lang: string;
    /** Plugin semantic version. */
    version: string;
    /** Optional alternative identifiers. */
    aliases?: string[];
    /** Execute parsing and return an IR project. */
    parseProject(files: Record<string, string>, options?: ParserParseOptions): IRProject | Promise<IRProject>;
    /**
     * Optional detection hook that can auto-detect if a plugin applies to the provided files.
     */
    detect?(files: Record<string, string>): ParserDetectionResult | null;
    /**
     * Optional capabilities metadata describing the parser implementation.
     */
    capabilities?: ParserCapabilities;
    /**
     * Optional tree-sitter module name (Node build) for dynamic loading hints.
     */
    treeSitterModule?: string;
}
