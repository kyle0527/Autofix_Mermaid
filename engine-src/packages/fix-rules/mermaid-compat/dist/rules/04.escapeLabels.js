"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscapeLabels = void 0;
exports.EscapeLabels = {
    name: 'EscapeLabels', priority: 40,
    run(code, ctx) {
        const c = code.replace(/([\[\{])(.*?)([\]\}])/g, (m, a, inner, b) => {
            inner = inner.replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\|/g, '\\|');
            return `${a}${inner}${b}`;
        });
        return { code: c, notes: ['Escaped bracket-like chars in labels'] };
    }
};
