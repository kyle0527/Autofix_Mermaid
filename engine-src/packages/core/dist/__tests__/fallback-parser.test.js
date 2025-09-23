"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const fallback_parser_1 = require("../fallback-parser");
(0, node_test_1.default)('fallback parser extracts classes, methods, and calls for unsupported languages', async () => {
    const plugin = (0, fallback_parser_1.createFallbackParserPlugin)('java');
    const project = await plugin.parseProject({
        'src/Main.java': `package demo;

import util.Helpers;

public class Main {
  public void run() {
    helper();
    Helpers.process();
  }

  private void helper() {}
}
`,
    });
    strict_1.default.ok(project.modules);
    const module = project.modules['src.Main'];
    strict_1.default.ok(module, 'expected module for src/Main.java');
    strict_1.default.deepEqual(module.imports, ['util.Helpers']);
    strict_1.default.equal(module.functions.length, 0);
    strict_1.default.equal(module.classes.length, 1);
    const mainClass = module.classes[0];
    strict_1.default.equal(mainClass.name, 'Main');
    strict_1.default.deepEqual(mainClass.bases, []);
    strict_1.default.equal(mainClass.methods.length, 2);
    const runMethod = mainClass.methods.find((m) => m.name === 'run');
    strict_1.default.ok(runMethod);
    strict_1.default.deepEqual(new Set(runMethod.calls), new Set(['helper', 'Helpers.process']));
    const helperMethod = mainClass.methods.find((m) => m.name === 'helper');
    strict_1.default.ok(helperMethod);
    strict_1.default.deepEqual(helperMethod.calls, []);
    strict_1.default.ok(project.fixNotes?.some((note) => note.includes('fallback parser')));
    strict_1.default.equal(project.parserMeta?.implementation, 'fallback');
    strict_1.default.equal(project.parserMeta?.details?.lang, 'java');
});
