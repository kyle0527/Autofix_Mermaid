"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPipeline = runPipeline;
const parsers_python_1 = require("@diagrammender/parsers-python");
const analyzers_1 = require("@diagrammender/analyzers");
const emitters_mermaid_1 = require("@diagrammender/emitters-mermaid");
const fix_rules_mermaid_compat_1 = require("@diagrammender/fix-rules-mermaid-compat");
async function runPipeline(files, opts) {
    var _a;
    let ir;
    switch (opts.lang) {
        case 'python':
            ir = (0, parsers_python_1.parsePythonProject)(files);
            break;
        default:
            throw new Error(`Unsupported lang: ${opts.lang}`);
    }
    // analyzers
    for (const mod of Object.values(ir.modules)) {
        for (const fn of mod.functions) {
            fn.cfg = (0, analyzers_1.buildCFG)(fn);
        }
    }
    ir.callGraph = (0, analyzers_1.buildCallGraph)(ir);
    // emit
    let code = '';
    switch (opts.diagram) {
        case 'flowchart':
            code = (0, emitters_mermaid_1.emitFlowchart)(ir);
            break;
        case 'classDiagram':
            code = (0, emitters_mermaid_1.emitClassDiagram)(ir);
            break;
        case 'sequenceDiagram':
            code = (0, emitters_mermaid_1.emitSequenceDiagram)(ir);
            break;
        default: code = (0, emitters_mermaid_1.emitFlowchart)(ir);
    }
    // fix
    const { code: fixed, notes } = (0, fix_rules_mermaid_compat_1.applyAll)(code, { diagram: opts.diagram, mermaidVersion: (_a = opts.mermaidVersion) !== null && _a !== void 0 ? _a : 'v11' });
    return { code: fixed, notes };
}
