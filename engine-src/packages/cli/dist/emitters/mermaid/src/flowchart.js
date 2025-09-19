"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitFlowchart = emitFlowchart;
const utils_1 = require("./utils");
function emitFlowchart(ir) {
    const lines = ['flowchart TD'];
    for (const mod of Object.values(ir.modules)) {
        for (const fn of mod.functions) {
            const base = `${mod.name}.${fn.name}`;
            lines.push(`subgraph ${base}`);
            const cfg = fn.cfg;
            if (!cfg || cfg.nodes.length === 0) {
                const A = (0, utils_1.sid)('A', base), B = (0, utils_1.sid)('B', base);
                lines.push(`${A}((Start))`);
                lines.push(`${B}((End))`);
                lines.push(`${A} --> ${B}`);
            }
            else {
                for (const n of cfg.nodes) {
                    const label = (0, utils_1.esc)((0, utils_1.wrap)((0, utils_1.trunc)(n.label || n.kind, 120)));
                    const id = (0, utils_1.sid)('N', base + ':' + n.id);
                    switch (n.kind) {
                        case 'start':
                            lines.push(`${id}((Start))`);
                            break;
                        case 'end':
                            lines.push(`${id}((End))`);
                            break;
                        case 'decision':
                            lines.push(`${id}{${label}}`);
                            break;
                        default: lines.push(`${id}[${label}]`);
                    }
                }
                for (const e of cfg.edges) {
                    const a = (0, utils_1.sid)('N', base + ':' + e.from);
                    const b = (0, utils_1.sid)('N', base + ':' + e.to);
                    const lab = e.label ? ` -- ${(0, utils_1.esc)(e.label)} --> ` : ' --> ';
                    lines.push(`${a}${lab}${b}`);
                }
            }
            lines.push(`end`);
        }
    }
    if (lines.length === 1)
        lines.push('A((Start))-->B((End))');
    return lines.join('\n');
}
