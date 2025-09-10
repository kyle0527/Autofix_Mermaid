import { FixRule } from '../types';
export const EscapeLabels: FixRule = {
  name: 'EscapeLabels', priority: 40,
  run(code, ctx) {
    const c = code.replace(/([\[\{])(.*?)([\]\}])/g, (m, a, inner, b) => {
      inner = inner.replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\|/g, '\\|');
      return `${a}${inner}${b}`;
    });
    return { code: c, notes: ['Escaped bracket-like chars in labels'] };
  }
};
