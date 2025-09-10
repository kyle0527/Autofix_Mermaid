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
export type IRStatement =
  | IRIfStatement
  | IRForStatement  
  | IRWhileStatement
  | IRTryStatement
  | IRSimpleStatement;

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
