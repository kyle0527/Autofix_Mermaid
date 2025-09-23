import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePythonProject, pythonParserPlugin } from '../index';
import type { ParserParseOptions } from '@diagrammender/types';

test('detectPythonProject identifies python files with high confidence', () => {
  const detection = pythonParserPlugin.detect?.({
    'src/app.py': 'print("hi")',
    'README.md': '# docs',
  });

  assert.ok(detection);
  assert.strictEqual(detection?.lang, 'python');
  assert.strictEqual(detection?.confidence, 'high');
  assert.ok(detection?.matchedFiles?.includes('src/app.py'));
});

test('parsePythonProject builds modules, classes, functions and call edges', async () => {
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

  const ir = await parsePythonProject(files);
  const mod = ir.modules['pkg.app'];
  assert.ok(mod, 'module not found');
  assert.ok(mod.imports.some((imp) => imp.includes('os')));
  assert.ok(mod.imports.some((imp) => imp.includes('helper')));
  assert.ok(mod.classes.some((cls) => cls.name === 'Greeter'));
  const greet = mod.classes[0].methods.find((m) => m.name === 'greet');
  assert.ok(greet, 'greet method not found');
  assert.ok(greet.calls.includes('helper'));
  assert.ok(mod.functions.some((fn) => fn.name === 'helper'));
});

test('parsePythonProject throws on syntax errors', async () => {
  await assert.rejects(
    () => parsePythonProject({ 'broken.py': 'def nope(:\n    pass' }),
    /syntax error/i,
  );
});

test('parsePythonProject throws when no python files are present', async () => {
  await assert.rejects(
    () => parsePythonProject({ 'README.md': '# nothing here' }),
    /No Python source files/i,
  );
});

test('parsePythonProject uses web-tree-sitter when configuration is provided', async () => {
  const calls: string[] = [];
  const stubLanguage = { id: 'python' };
  const stubModule = {
    Parser: class {
      lang: any;
      setLanguage(lang: any) {
        this.lang = lang;
      }
      parse(source: string) {
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
      async load(url: string) {
        calls.push(`load:${url}`);
        return stubLanguage;
      },
    },
    async init() {
      calls.push('init');
    },
  };

  const files = { 'pkg/app.py': 'print("hello")' };
  const options: ParserParseOptions = {
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

  const ir = await parsePythonProject(files, options);
  assert.ok(ir.modules['pkg.app']);
  assert.strictEqual(ir.parserMeta?.implementation, 'web-tree-sitter');
  assert.strictEqual(ir.parserMeta?.runtime, 'browser');
  assert.ok(calls.includes('init'));
  assert.ok(calls.includes('load:http://example.com/tree-sitter-python.wasm'));
});
