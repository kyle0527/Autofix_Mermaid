import { DiagramKind, MermaidFragment, MermaidLink } from '@diagrammender/types';
export interface ComposeMermaidOptions {
    /** Restrict the composition to a subset of fragment IDs. */
    include?: string[];
    /** Exclude specific fragment IDs from the final output. */
    exclude?: string[];
    /**
     * Sorting strategy: keep original order (`'stable'`), or sort by `id` / `title`.
     * Defaults to preserving the caller supplied order.
     */
    sort?: 'stable' | 'id' | 'title';
    /** Optional cross-fragment links that should be appended to the composition. */
    links?: MermaidLink[];
}
export declare function composeMermaid(diagram: DiagramKind, fragments: MermaidFragment[], options?: ComposeMermaidOptions): string;
