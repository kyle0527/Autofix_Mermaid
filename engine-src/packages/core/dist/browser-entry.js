"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPipeline = runPipeline;
exports.runPipelineIR = runPipelineIR;
const pipeline_1 = require("./pipeline");
const emitters_mermaid_1 = require("@diagrammender/emitters-mermaid");
const fix_rules_mermaid_compat_1 = require("@diagrammender/fix-rules-mermaid-compat");
const analyzers_1 = require("@diagrammender/analyzers");
const ENGINE_VERSION = '0.3.0';
const ENGINE_SOURCE = `browser-core@${ENGINE_VERSION}`;
function normalizeDiagram(diagram) {
    switch (diagram) {
        case 'sequenceDiagram':
        case 'classDiagram':
        case 'callGraph':
        case 'dependencyGraph':
            return diagram;
        default:
            return 'flowchart';
    }
}
function normalizeParserOptions(options) {
    const normalized = { ...options };
    normalized.runtime = 'browser';
    if (normalized.preferTreeSitter === false) {
        return normalized;
    }
    if (normalized.webTreeSitter) {
        normalized.preferTreeSitter = true;
    }
    else if (typeof normalized.preferTreeSitter === 'undefined') {
        normalized.preferTreeSitter = true;
    }
    return normalized;
}
function normalizePipelineOptions(diagram, options) {
    const candidateLangs = Array.isArray(options?.candidateLangs)
        ? options?.candidateLangs
        : undefined;
    const parserOptions = normalizeParserOptions(options?.parserOptions);
    const mermaidVersion = options?.mermaidVersion === 'v10' ? 'v10' : 'v11';
    return {
        diagram,
        lang: typeof options?.lang === 'string' ? options.lang : undefined,
        detect: options?.detect !== false,
        candidateLangs,
        parserOptions,
        mermaidVersion,
    };
}
function sanitizePlugin(plugin) {
    if (!plugin)
        return null;
    const info = {
        lang: plugin.lang,
        version: plugin.version,
    };
    if (Array.isArray(plugin.aliases))
        info.aliases = [...plugin.aliases];
    if (plugin.capabilities)
        info.capabilities = { ...plugin.capabilities };
    if (typeof plugin.treeSitterModule === 'string')
        info.treeSitterModule = plugin.treeSitterModule;
    return info;
}
function buildLogEntries(result, diagram) {
    const entries = [];
    if (result.detection) {
        entries.push({
            rule: 'pipeline.detect',
            msg: `detected ${result.detection.lang} (${result.detection.confidence})`,
            meta: { ...result.detection },
        });
    }
    if (result.ir?.parserMeta) {
        const meta = result.ir.parserMeta;
        if (meta.implementation === 'web-tree-sitter') {
            entries.push({ rule: 'worker.wts', msg: 'web-tree-sitter used', meta: { ...meta } });
        }
        else if (meta.implementation === 'tree-sitter') {
            entries.push({
                rule: 'pipeline.parser',
                msg: `tree-sitter (${meta.runtime ?? 'node'})`,
                meta: { ...meta },
            });
        }
        else if (meta.implementation === 'fallback') {
            entries.push({
                rule: 'pipeline.parser',
                msg: 'fallback parser used',
                meta: { ...meta },
            });
        }
    }
    for (const entry of result.trace || []) {
        entries.push({
            rule: `pipeline.${entry.stage}`,
            msg: `${entry.stage} (${Math.round(entry.durationMs)} ms)`,
            meta: {
                ...entry.meta,
                details: entry.details,
            },
        });
    }
    if (result.notes?.length) {
        for (const note of result.notes) {
            entries.push({ rule: 'pipeline.fixNote', msg: note });
        }
    }
    entries.push({
        rule: 'pipeline.diagram',
        msg: `composed ${diagram} with ${result.fragments.length} fragment(s)`
            + (diagram === 'flowchart' ? ` and ${result.links.length} link(s)` : ''),
    });
    return entries;
}
function createBrowserResult(diagram, pipeline, extras = {}) {
    return {
        code: pipeline.code,
        dtype: diagram,
        errors: [],
        log: buildLogEntries(pipeline, diagram),
        fragments: pipeline.fragments,
        links: pipeline.links,
        rawCode: pipeline.rawCode,
        notes: pipeline.notes,
        detection: pipeline.detection,
        plugin: sanitizePlugin(pipeline.plugin),
        trace: pipeline.trace,
        ir: pipeline.ir,
        engine: { source: ENGINE_SOURCE, version: ENGINE_VERSION },
        ...extras,
    };
}
async function runPipeline(files, options = {}) {
    const diagram = normalizeDiagram(options.diagram || options.mode || options.dtype);
    const pipelineOptions = normalizePipelineOptions(diagram, options);
    const pipelineResult = await (0, pipeline_1.runPipeline)(files || {}, pipelineOptions);
    return createBrowserResult(diagram, pipelineResult);
}
function ensureAnalysis(ir) {
    for (const mod of Object.values(ir.modules || {})) {
        for (const fn of mod.functions || []) {
            if (!fn.cfg) {
                fn.cfg = (0, analyzers_1.buildCFG)(fn);
            }
        }
        for (const cls of mod.classes || []) {
            for (const method of cls.methods || []) {
                if (!method.cfg) {
                    method.cfg = (0, analyzers_1.buildCFG)(method);
                }
            }
        }
    }
    if (!ir.callGraph || !Array.isArray(ir.callGraph.edges)) {
        ir.callGraph = (0, analyzers_1.buildCallGraph)(ir);
    }
    if (!ir.dependencyGraph || !Array.isArray(ir.dependencyGraph.edges)) {
        ir.dependencyGraph = (0, analyzers_1.buildDependencyGraph)(ir);
    }
}
async function runPipelineIR(ir, options = {}) {
    const diagram = normalizeDiagram(options.diagram || options.mode || options.dtype);
    const project = ir || { modules: {} };
    ensureAnalysis(project);
    let fragments = [];
    switch (diagram) {
        case 'classDiagram':
            fragments = (0, emitters_mermaid_1.emitClassDiagramFragments)(project);
            break;
        case 'sequenceDiagram':
            fragments = (0, emitters_mermaid_1.emitSequenceFragments)(project);
            break;
        case 'callGraph':
            fragments = (0, emitters_mermaid_1.emitCallGraphFragments)(project);
            break;
        case 'dependencyGraph':
            fragments = (0, emitters_mermaid_1.emitDependencyGraphFragments)(project);
            break;
        default:
            fragments = (0, emitters_mermaid_1.emitFlowchartFragments)(project);
            break;
    }
    const links = diagram === 'flowchart'
        ? (0, emitters_mermaid_1.buildFlowchartLinks)(project.callGraph, fragments)
        : [];
    const rawCode = (0, emitters_mermaid_1.composeMermaid)(diagram, fragments, { links });
    const mermaidVersion = options?.mermaidVersion === 'v10' ? 'v10' : 'v11';
    const fixDiagram = diagram === 'flowchart' || diagram === 'classDiagram' || diagram === 'sequenceDiagram'
        ? diagram
        : 'flowchart';
    const { code, notes } = (0, fix_rules_mermaid_compat_1.applyAll)(rawCode, { diagram: fixDiagram, mermaidVersion });
    const trace = [
        {
            stage: 'emit',
            startedAt: Date.now(),
            durationMs: 0,
            details: 'runPipelineIR emit',
            meta: {
                diagram,
                fragments: fragments.length,
                links: links.length,
            },
        },
        {
            stage: 'fix',
            startedAt: Date.now(),
            durationMs: 0,
            details: 'runPipelineIR fix',
            meta: {
                notes: notes.length,
            },
        },
    ];
    const pipelineLike = {
        code,
        notes,
        plugin: {
            lang: typeof options?.lang === 'string' ? options.lang : 'ir',
            version: 'ir',
            parseProject: () => project,
        },
        detection: undefined,
        ir: project,
        rawCode,
        fragments,
        links,
        trace,
    };
    return createBrowserResult(diagram, pipelineLike);
}
const DiagramMenderCore = {
    runPipeline,
    runPipelineIR,
    composeMermaid: emitters_mermaid_1.composeMermaid,
    version: ENGINE_SOURCE,
};
if (typeof globalThis !== 'undefined') {
    globalThis.DiagramMenderCore = DiagramMenderCore;
}
exports.default = DiagramMenderCore;
