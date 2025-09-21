import { FixRule } from '../types';
export const GraphToFlowchart: FixRule = {
  name: 'GraphToFlowchart', priority: 20,
  run(code, ctx) {
    if (/^graph\s+[A-Z]{2}/mi.test(code)) {
      const c = code.replace(/^graph\s+([A-Z]{2})/gmi, 'flowchart $1');
      return { code: c, notes: ['Converted graph to flowchart'] };
    }
    return { code, notes: [] };
  }
};
