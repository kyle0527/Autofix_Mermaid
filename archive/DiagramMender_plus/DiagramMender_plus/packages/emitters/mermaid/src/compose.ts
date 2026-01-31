import { DiagramKind, MermaidFragment, MermaidLink } from '@diagrammender/types';

const DIAGRAM_HEADERS: Record<DiagramKind, string> = {
  flowchart: 'flowchart TD',
  classDiagram: 'classDiagram',
  sequenceDiagram: 'sequenceDiagram',
};

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

function uniqueFragments(
  fragments: MermaidFragment[],
  include?: Set<string>,
  exclude?: Set<string>,
): MermaidFragment[] {
  const seen = new Set<string>();
  const filtered: MermaidFragment[] = [];
  for (const fragment of fragments) {
    if (include && !include.has(fragment.id)) continue;
    if (exclude && exclude.has(fragment.id)) continue;
    if (seen.has(fragment.id)) continue;
    seen.add(fragment.id);
    filtered.push(fragment);
  }
  return filtered;
}

function sortFragments(
  fragments: MermaidFragment[],
  sort: ComposeMermaidOptions['sort'],
): MermaidFragment[] {
  if (!fragments.length) return fragments;
  if (!sort || sort === 'stable') return fragments;
  const copy = [...fragments];
  if (sort === 'id') {
    copy.sort((a, b) => a.id.localeCompare(b.id));
  } else if (sort === 'title') {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  return copy;
}

function resolveAnchor(
  fragment: MermaidFragment,
  preferred: keyof NonNullable<MermaidFragment['anchors']> | undefined,
  fallbacks: Array<keyof NonNullable<MermaidFragment['anchors']>>,
): string | undefined {
  const anchors = fragment.anchors;
  if (!anchors) return undefined;
  if (preferred && anchors[preferred]) {
    return anchors[preferred];
  }
  for (const key of fallbacks) {
    if (key === preferred) continue;
    const value = anchors[key];
    if (value) return value;
  }
  return undefined;
}

function arrowForStyle(style: MermaidLink['style']): string {
  switch (style) {
    case 'dashed':
      return '-.->';
    case 'dotted':
      return '..>';
    default:
      return '-->';
  }
}

function buildLinkLines(
  diagram: DiagramKind,
  fragments: MermaidFragment[],
  links?: MermaidLink[],
): string[] {
  if (!links || links.length === 0) {
    return [];
  }
  const fragmentMap = new Map<string, MermaidFragment>();
  for (const fragment of fragments) {
    fragmentMap.set(fragment.id, fragment);
  }
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const link of links) {
    if (link.diagram !== diagram) continue;
    const fromFragment = fragmentMap.get(link.fromFragment);
    const toFragment = fragmentMap.get(link.toFragment);
    if (!fromFragment || !toFragment) continue;
    const fromNode = resolveAnchor(fromFragment, link.fromAnchor, ['exit', 'center', 'entry']);
    const toNode = resolveAnchor(toFragment, link.toAnchor, ['entry', 'center', 'exit']);
    if (!fromNode || !toNode) continue;
    const arrow = arrowForStyle(link.style);
    const cleanLabel = link.label ? link.label.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').replace(/[|]/g, '/').trim() : '';
    const labelChunk = cleanLabel ? `|${cleanLabel}|` : '';
    const key = `${fromNode}|${toNode}|${labelChunk}|${arrow}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${fromNode} ${arrow}${labelChunk} ${toNode}`);
  }
  return lines;
}

export function composeMermaid(
  diagram: DiagramKind,
  fragments: MermaidFragment[],
  options?: ComposeMermaidOptions,
): string {
  const header = DIAGRAM_HEADERS[diagram] ?? 'flowchart TD';
  const include = options?.include?.length ? new Set(options.include) : undefined;
  const exclude = options?.exclude?.length ? new Set(options.exclude) : undefined;
  const unique = uniqueFragments(fragments, include, exclude);
  const ordered = sortFragments(unique, options?.sort);
  const bodySegments = ordered
    .map((fragment) => fragment.code)
    .filter((code) => code && code.trim().length > 0);
  const linkLines = buildLinkLines(diagram, ordered, options?.links);
  if (bodySegments.length === 0 && linkLines.length === 0) {
    return header;
  }
  const lines = [header];
  if (bodySegments.length > 0) {
    lines.push(bodySegments.join('\n'));
  }
  if (linkLines.length > 0) {
    if (bodySegments.length > 0) {
      lines.push('');
    }
    lines.push(...linkLines);
  }
  return lines.join('\n');
}
