"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const parsers_1 = require("../parsers");
function createStubPlugin(name, aliases = []) {
    return {
        lang: name,
        version: '0.0.1',
        aliases,
        parseProject: async () => ({ modules: {}, fixNotes: [] }),
    };
}
(0, node_test_1.default)('registerParserPlugin stores aliases and resolves via loader', async () => {
    (0, parsers_1.clearParserPlugins)();
    const plugin = createStubPlugin('demo', ['demo-alt']);
    (0, parsers_1.registerParserPlugin)(plugin);
    const loaded = await (0, parsers_1.loadParserPlugin)('demo-alt');
    strict_1.default.strictEqual(loaded, plugin);
    const plugins = (0, parsers_1.listParserPlugins)();
    strict_1.default.strictEqual(plugins.length, 1);
    strict_1.default.strictEqual(plugins[0], plugin);
});
(0, node_test_1.default)('loadParserPlugin throws for unknown languages', async () => {
    (0, parsers_1.clearParserPlugins)();
    await strict_1.default.rejects((0, parsers_1.loadParserPlugin)('unknown-lang'), /Parser plugin not found/);
});
(0, node_test_1.default)('resolveParserPlugin auto-detects using heuristics when lang is omitted', async () => {
    (0, parsers_1.clearParserPlugins)();
    const plugin = createStubPlugin('python');
    (0, parsers_1.registerParserPlugin)(plugin);
    const { plugin: resolved, detection } = await (0, parsers_1.resolveParserPlugin)({
        files: { 'src/app.py': 'def main():\n  return 0\n' },
    });
    strict_1.default.strictEqual(resolved, plugin);
    strict_1.default.ok(detection);
    strict_1.default.strictEqual(detection?.lang, 'python');
    strict_1.default.strictEqual(detection?.confidence, 'high');
    strict_1.default.ok(detection?.matchedFiles?.includes('src/app.py'));
});
(0, node_test_1.default)('resolveParserPlugin uses candidate languages when heuristics are unavailable', async () => {
    (0, parsers_1.clearParserPlugins)();
    const plugin = createStubPlugin('demo');
    plugin.detect = () => ({ lang: 'demo', confidence: 'medium', reason: 'mock-detect' });
    (0, parsers_1.registerParserPlugin)(plugin);
    const { plugin: resolved, detection } = await (0, parsers_1.resolveParserPlugin)({
        lang: 'auto',
        files: { 'README.md': '# demo project' },
        candidates: ['demo'],
    });
    strict_1.default.strictEqual(resolved, plugin);
    strict_1.default.ok(detection);
    strict_1.default.strictEqual(detection?.lang, 'demo');
    strict_1.default.strictEqual(detection?.confidence, 'medium');
});
(0, node_test_1.default)('resolveParserPlugin requires files when language is auto', async () => {
    (0, parsers_1.clearParserPlugins)();
    await strict_1.default.rejects((0, parsers_1.resolveParserPlugin)({ lang: 'auto' }), /requires files/);
});
