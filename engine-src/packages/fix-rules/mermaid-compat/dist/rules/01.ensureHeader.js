"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnsureHeader = void 0;
exports.EnsureHeader = {
    name: 'EnsureHeader', priority: 10,
    run(code, ctx) {
        const trimmed = code.trim();
        if (!/^(flowchart|classDiagram|sequenceDiagram|stateDiagram|erDiagram)\b/.test(trimmed)) {
            return { code: `flowchart TD\n${code}`, notes: ['Added diagram header: flowchart TD'] };
        }
        return { code, notes: [] };
    }
};
