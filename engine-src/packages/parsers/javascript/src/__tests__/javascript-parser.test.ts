import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJavaScriptProject, javascriptParserPlugin } from '../index';

test('detectJavaScriptProject identifies JS files with high confidence', () => {
  const detection = javascriptParserPlugin.detect?.({
    'src/app.js': 'export const ok = true;',
    'README.md': '# docs',
  });
  assert.ok(detection);
  assert.strictEqual(detection?.lang, 'javascript');
  assert.strictEqual(detection?.confidence, 'high');
  assert.ok(detection?.matchedFiles?.includes('src/app.js'));
});

test('parseJavaScriptProject extracts modules, classes, functions, and call/import edges', async () => {
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

  const ir = await parseJavaScriptProject(files);
  const mod = ir.modules['src.index'];
  if (!mod) {
    throw new Error('module not found');
  }
  assert.ok(mod.imports.some((imp: string) => imp.includes('./helper')));
  const greeter = mod.classes.find((cls) => cls.name === 'Greeter');
  if (!greeter) {
    throw new Error('Greeter class missing');
  }
  const greet = greeter.methods.find((m) => m.name === 'greet');
  if (!greet) {
    throw new Error('greet method missing');
  }
  assert.ok(greet.calls.includes('console.log'));
  assert.ok(greet.calls.includes('helper'));
  assert.ok(mod.functions.some((fn) => fn.name === 'run'));
});

test('parseJavaScriptProject throws on syntax errors', async () => {
  await assert.rejects(async () => {
    await parseJavaScriptProject({ 'bad.js': 'function nope( { console.log(' });
  }, /syntax error/i);
});

test('parseJavaScriptProject throws when no JS files are provided', async () => {
  await assert.rejects(async () => {
    await parseJavaScriptProject({ 'notes.txt': 'todo' });
  }, /No JavaScript source files/);
});
