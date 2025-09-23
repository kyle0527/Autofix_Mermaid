"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.default)('detectPythonProject identifies python files with high confidence', () => {
    const detection = index_1.pythonParserPlugin.detect?.({
        'src/app.py': 'print("hi")',
        'README.md': '# docs',
    });
    strict_1.default.ok(detection);
    strict_1.default.strictEqual(detection?.lang, 'python');
    strict_1.default.strictEqual(detection?.confidence, 'high');
    strict_1.default.ok(detection?.matchedFiles?.includes('src/app.py'));
});
(0, node_test_1.default)('parsePythonProject builds modules, classes, functions and call edges', async () => {
    const files = {
        'pkg/app.py': `
import os
from utils import helper

class Greeter:
    def greet(self):
        helper()


def helper():
    return Greeter()
`,
    };
    const ir = await (0, index_1.parsePythonProject)(files);
    const mod = ir.modules['pkg.app'];
    strict_1.default.ok(mod, 'module not found');
    strict_1.default.ok(mod.imports.some((imp) => imp.includes('os')));
    strict_1.default.ok(mod.imports.some((imp) => imp.includes('helper')));
    strict_1.default.ok(mod.classes.some((cls) => cls.name === 'Greeter'));
    const greet = mod.classes[0].methods.find((m) => m.name === 'greet');
    strict_1.default.ok(greet, 'greet method not found');
    strict_1.default.ok(greet.calls.includes('helper'));
    strict_1.default.ok(mod.functions.some((fn) => fn.name === 'helper'));
});
(0, node_test_1.default)('parsePythonProject throws on syntax errors', async () => {
    await strict_1.default.rejects(() => (0, index_1.parsePythonProject)({ 'broken.py': 'def nope(:\n    pass' }), /syntax error/i);
});
(0, node_test_1.default)('parsePythonProject throws when no python files are present', async () => {
    await strict_1.default.rejects(() => (0, index_1.parsePythonProject)({ 'README.md': '# nothing here' }), /No Python source files/i);
});
(0, node_test_1.default)('parsePythonProject uses web-tree-sitter when configuration is provided', async () => {
    const calls = [];
    const stubLanguage = { id: 'python' };
    const stubModule = {
        Parser: class {
            setLanguage(lang) {
                this.lang = lang;
            }
            parse(source) {
                calls.push(source);
                return {
                    rootNode: {
                        type: 'module',
                        namedChildren: [],
                        children: [],
                        hasError: () => false,
                    },
                };
            }
        },
        Language: {
            async load(url) {
                calls.push(`load:${url}`);
                return stubLanguage;
            },
        },
        async init() {
            calls.push('init');
        },
    };
    const files = { 'pkg/app.py': 'print("hello")' };
    const options = {
        runtime: 'browser',
        preferTreeSitter: true,
        webTreeSitter: {
            module: stubModule,
            runtimeUrl: 'http://example.com/tree-sitter.wasm',
            languages: {
                python: 'http://example.com/tree-sitter-python.wasm',
            },
        },
    };
    const ir = await (0, index_1.parsePythonProject)(files, options);
    strict_1.default.ok(ir.modules['pkg.app']);
    strict_1.default.strictEqual(ir.parserMeta?.implementation, 'web-tree-sitter');
    strict_1.default.strictEqual(ir.parserMeta?.runtime, 'browser');
    strict_1.default.ok(calls.includes('init'));
    strict_1.default.ok(calls.includes('load:http://example.com/tree-sitter-python.wasm'));
});
