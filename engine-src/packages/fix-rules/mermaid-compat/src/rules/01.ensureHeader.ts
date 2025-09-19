import { FixRule } from '../types';
export const EnsureHeader: FixRule = {
  name: 'EnsureHeader', priority: 10,
  run(code, ctx) {
    const trimmed = code.trim();
    // If no valid diagram header present, add one based on ctx.diagram
    if (!/^(flowchart|classDiagram|sequenceDiagram|stateDiagram|erDiagram)\b/.test(trimmed)) {
      const kind = ctx?.diagram || 'flowchart';
      let header = 'flowchart TD';
      if (kind === 'classDiagram') header = 'classDiagram';
      else if (kind === 'sequenceDiagram') header = 'sequenceDiagram';
      // default fallbacks remain flowchart TD for better layout determinism
      return { code: `${header}\n${code}`, notes: [`Added diagram header: ${header}`] };
    }
    return { code, notes: [] };
  }
};
