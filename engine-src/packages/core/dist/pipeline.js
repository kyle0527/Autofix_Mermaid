"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPipeline = runPipeline;
const analyzers_1 = require("@diagrammender/analyzers");
const emitters_mermaid_1 = require("@diagrammender/emitters-mermaid");
const fix_rules_mermaid_compat_1 = require("@diagrammender/fix-rules-mermaid-compat");
const parsers_1 = require("./parsers");
async function runPipeline(files, opts) {
    const trace = [];
    const now = () => Date.now();
    const detectStart = now();
    const { plugin, detection } = await (0, parsers_1.resolveParserPlugin)({
        lang: opts.lang,
        files,
        detect: opts.detect !== false,
        candidates: opts.candidateLangs,
    });
    trace.push({
        stage: 'detect',
        startedAt: detectStart,
        durationMs: now() - detectStart,
        details: detection
            ? `resolved ${detection.lang} (${detection.confidence})`
            : `explicit ${plugin.lang}`,
        meta: {
            plugin: plugin.lang,
            version: plugin.version,
            detection,
        },
    });
    const parseStart = now();
    const ir = await plugin.parseProject(files, opts.parserOptions);
    trace.push({
        stage: 'parse',
        startedAt: parseStart,
        durationMs: now() - parseStart,
        meta: {
            modules: Object.keys(ir.modules ?? {}).length,
            capabilities: plugin.capabilities,
        },
    });
    const analyzeStart = now();
    let functionCount = 0;
    let methodCount = 0;
    let classCount = 0;
    // analyzers
    for (const mod of Object.values(ir.modules)) {
        classCount += mod.classes?.length ?? 0;
        for (const fn of mod.functions) {
            functionCount += 1;
            fn.cfg = (0, analyzers_1.buildCFG)(fn);
        }
        for (const cls of mod.classes || []) {
            for (const method of cls.methods || []) {
                functionCount += 1;
                methodCount += 1;
                method.cfg = (0, analyzers_1.buildCFG)(method);
            }
        }
    }
    ir.callGraph = (0, analyzers_1.buildCallGraph)(ir);
    trace.push({
        stage: 'analyze',
        startedAt: analyzeStart,
        durationMs: now() - analyzeStart,
        meta: {
            functions: functionCount,
            methods: methodCount,
            classes: classCount,
            callEdges: ir.callGraph?.edges.length ?? 0,
        },
    });
    // emit
    const diagram = opts.diagram;
    const emitStart = now();
    let fragments = [];
    switch (diagram) {
        case 'flowchart':
            fragments = (0, emitters_mermaid_1.emitFlowchartFragments)(ir);
            break;
        case 'classDiagram':
            fragments = (0, emitters_mermaid_1.emitClassDiagramFragments)(ir);
            break;
        case 'sequenceDiagram':
            fragments = (0, emitters_mermaid_1.emitSequenceFragments)(ir);
            break;
        default:
            fragments = (0, emitters_mermaid_1.emitFlowchartFragments)(ir);
            break;
    }
    const links = diagram === 'flowchart'
        ? (0, emitters_mermaid_1.buildFlowchartLinks)(ir.callGraph, fragments)
        : [];
    const rawCode = (0, emitters_mermaid_1.composeMermaid)(diagram, fragments, { links });
    trace.push({
        stage: 'emit',
        startedAt: emitStart,
        durationMs: now() - emitStart,
        meta: {
            diagram,
            fragments: fragments.length,
            links: links.length,
            rawLength: rawCode.length,
        },
    });
    // fix
    const fixStart = now();
    const { code: fixed, notes } = (0, fix_rules_mermaid_compat_1.applyAll)(rawCode, { diagram, mermaidVersion: opts.mermaidVersion ?? 'v11' });
    trace.push({
        stage: 'fix',
        startedAt: fixStart,
        durationMs: now() - fixStart,
        meta: {
            notes: notes.length,
            delta: fixed.length - rawCode.length,
        },
    });
    if (notes.length) {
        ir.fixNotes = (ir.fixNotes || []).concat(notes);
    }
    return { code: fixed, notes, plugin, detection, ir, rawCode, fragments, links, trace };
}
