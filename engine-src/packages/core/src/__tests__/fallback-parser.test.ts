import test from 'node:test';
import assert from 'node:assert/strict';
import { createFallbackParserPlugin } from '../fallback-parser';

test('fallback parser extracts classes, methods, and calls for unsupported languages', async () => {
  const plugin = createFallbackParserPlugin('java');
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

  assert.ok(project.modules);
  const module = project.modules['src.Main'];
  assert.ok(module, 'expected module for src/Main.java');
  assert.deepEqual(module.imports, ['util.Helpers']);

  assert.equal(module.functions.length, 0);
  assert.equal(module.classes.length, 1);

  const mainClass = module.classes[0];
  assert.equal(mainClass.name, 'Main');
  assert.deepEqual(mainClass.bases, []);
  assert.equal(mainClass.methods.length, 2);

  const runMethod = mainClass.methods.find((m) => m.name === 'run');
  assert.ok(runMethod);
  assert.deepEqual(new Set(runMethod!.calls), new Set(['helper', 'Helpers.process']));

  const helperMethod = mainClass.methods.find((m) => m.name === 'helper');
  assert.ok(helperMethod);
  assert.deepEqual(helperMethod!.calls, []);

  assert.ok(project.fixNotes?.some((note) => note.includes('fallback parser')));
  assert.equal(project.parserMeta?.implementation, 'fallback');
  assert.equal(project.parserMeta?.details?.lang, 'java');
});

