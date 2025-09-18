"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const pipeline_1 = require("../pipeline");
const parsers_1 = require("../parsers");
const emitters_mermaid_1 = require("@diagrammender/emitters-mermaid");
function createStubProject() {
    const mainFn = {
        id: 'demo.main',
        name: 'main',
        params: [],
        body: [
            { kind: 'expr', text: 'widget = Widget()', pos: { file: 'demo/app.demo', line: 5 } },
            { kind: 'expr', text: 'widget.render()', pos: { file: 'demo/app.demo', line: 6 } },
        ],
        calls: ['demo.Widget.render'],
        pos: { file: 'demo/app.demo', line: 4 },
    };
    const renderFn = {
        id: 'demo.Widget.render',
        name: 'render',
        params: [],
        body: [
            { kind: 'expr', text: 'print("render")', pos: { file: 'demo/app.demo', line: 9 } },
        ],
        calls: [],
        pos: { file: 'demo/app.demo', line: 8 },
    };
    const module = {
        name: 'demo',
        path: 'demo/app.demo',
        classes: [
            {
                id: 'demo.Widget',
                name: 'Widget',
                bases: [],
                attrs: ['value'],
                methods: [renderFn],
                pos: { file: 'demo/app.demo', line: 1 },
                doc: 'Example widget',
            },
        ],
        functions: [mainFn],
        imports: [],
    };
    return { modules: { demo: module } };
}
function createStubPlugin() {
    return {
        lang: 'demo',
        version: '1.0.0',
        aliases: ['demo-lang'],
        detect: () => ({ lang: 'demo', confidence: 'high', reason: 'stub plugin' }),
        capabilities: { incremental: true },
        async parseProject() {
            const project = createStubProject();
            return JSON.parse(JSON.stringify(project));
        },
    };
}
(0, node_test_1.default)('runPipeline exposes raw output, fragments and trace for debugging', async () => {
    (0, parsers_1.clearParserPlugins)();
    const plugin = createStubPlugin();
    (0, parsers_1.registerParserPlugin)(plugin);
    try {
        const result = await (0, pipeline_1.runPipeline)({ 'demo/app.demo': 'class Widget: pass' }, {
            lang: 'demo',
            diagram: 'flowchart',
        });
        strict_1.default.strictEqual(result.plugin, plugin);
        strict_1.default.ok(result.detection);
        strict_1.default.ok(result.rawCode.startsWith('flowchart TD'));
        strict_1.default.ok(result.fragments.length > 0);
        strict_1.default.ok(result.links.length > 0);
        strict_1.default.strictEqual((0, emitters_mermaid_1.composeMermaid)('flowchart', result.fragments, { links: result.links }), result.rawCode);
        strict_1.default.ok(result.trace.some((entry) => entry.stage === 'emit'));
        strict_1.default.ok(result.ir.callGraph);
        strict_1.default.ok(result.ir.callGraph?.edges.length); // ensure analyzer ran
        strict_1.default.ok(result.fragments.some((fragment) => fragment.id === 'demo.main'));
        strict_1.default.ok(result.fragments.some((fragment) => fragment.id === 'demo.Widget.render'));
        strict_1.default.ok(result.links.some((link) => link.fromFragment === 'demo.main' && link.toFragment === 'demo.Widget.render'));
    }
    finally {
        (0, parsers_1.clearParserPlugins)();
    }
});
