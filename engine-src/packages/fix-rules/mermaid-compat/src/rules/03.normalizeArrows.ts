import { FixRule } from '../types';
export const NormalizeArrows: FixRule = {
  name: 'NormalizeArrows', priority: 30,
  run(code, ctx) {
    let c = code; c = c.replace(/→|—>/g, '-->'); c = c.replace(/->/g, '-->');
    return { code: c, notes: ['Normalized arrows'] };
  }
};
