"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NormalizeArrows = void 0;
exports.NormalizeArrows = {
    name: 'NormalizeArrows', priority: 30,
    run(code, ctx) {
        let c = code;
        c = c.replace(/→|—>/g, '-->');
        c = c.replace(/->/g, '-->');
        return { code: c, notes: ['Normalized arrows'] };
    }
};
