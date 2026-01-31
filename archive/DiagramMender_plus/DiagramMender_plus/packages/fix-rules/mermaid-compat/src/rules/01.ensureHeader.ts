import { FixRule } from '../types';
export const EnsureHeader: FixRule = {
  name: 'EnsureHeader', priority: 10,
  run(code, ctx) {
    const trimmed = code.trim();
    if (!/^(flowchart|classDiagram|sequenceDiagram|stateDiagram|erDiagram)\b/.test(trimmed)) {
      return { code: `flowchart TD\n${code}`, notes: ['Added diagram header: flowchart TD'] };
    }
    return { code, notes: [] };
  }
};
