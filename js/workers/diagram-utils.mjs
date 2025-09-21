export function guessDiagramFromCode(text = '') {
  const trimmed = text.trim();
  if (/^sequenceDiagram\b/m.test(trimmed)) return 'sequenceDiagram';
  if (/^classDiagram\b/m.test(trimmed)) return 'classDiagram';
  if (/^stateDiagram\b/m.test(trimmed)) return 'stateDiagram';
  if (/^erDiagram\b/m.test(trimmed)) return 'erDiagram';
  if (/^gantt\b/m.test(trimmed)) return 'gantt';
  if (/^journey\b/m.test(trimmed)) return 'journey';
  if (/^(flowchart|graph)\b/m.test(trimmed)) return 'flowchart';
  return 'flowchart';
}

export function guessDiagramFromFiles(files = {}, options = {}) {
  if (options && typeof options.diagram === 'string') {
    return options.diagram;
  }
  const source = typeof files.mermaid === 'string' ? files.mermaid : '';
  return guessDiagramFromCode(source);
}

export default guessDiagramFromCode;
