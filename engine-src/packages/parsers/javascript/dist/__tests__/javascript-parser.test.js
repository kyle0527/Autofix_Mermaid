"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.default)('detectJavaScriptProject identifies JS files with high confidence', () => {
    const detection = index_1.javascriptParserPlugin.detect?.({
        'src/app.js': 'export const ok = true;',
        'README.md': '# docs',
    });
    strict_1.default.ok(detection);
    strict_1.default.strictEqual(detection?.lang, 'javascript');
    strict_1.default.strictEqual(detection?.confidence, 'high');
    strict_1.default.ok(detection?.matchedFiles?.includes('src/app.js'));
});
(0, node_test_1.default)('parseJavaScriptProject extracts modules, classes, functions, and call/import edges', () => {
    const files = {
        'src/index.js': `
import { helper } from './helper';

export class Greeter {
  greet(name) {
    console.log(name);
    helper(name);
  }
}

export const run = () => {
  const greeter = new Greeter();
  greeter.greet('world');
};
`,
    };
    const ir = (0, index_1.parseJavaScriptProject)(files);
    const mod = ir.modules['src.index'];
    strict_1.default.ok(mod, 'module not found');
    strict_1.default.ok(mod.imports.some((imp) => imp.includes('./helper')));
    const greeter = mod.classes.find((cls) => cls.name === 'Greeter');
    strict_1.default.ok(greeter, 'Greeter class missing');
    const greet = greeter.methods.find((m) => m.name === 'greet');
    strict_1.default.ok(greet, 'greet method missing');
    strict_1.default.ok(greet.calls.includes('console.log'));
    strict_1.default.ok(greet.calls.includes('helper'));
    strict_1.default.ok(mod.functions.some((fn) => fn.name === 'run'));
});
(0, node_test_1.default)('parseJavaScriptProject throws on syntax errors', () => {
    strict_1.default.throws(() => {
        (0, index_1.parseJavaScriptProject)({ 'bad.js': 'function nope( { console.log(' });
    }, /syntax error/i);
});
(0, node_test_1.default)('parseJavaScriptProject throws when no JS files are provided', () => {
    strict_1.default.throws(() => {
        (0, index_1.parseJavaScriptProject)({ 'notes.txt': 'todo' });
    }, /No JavaScript source files/);
});
