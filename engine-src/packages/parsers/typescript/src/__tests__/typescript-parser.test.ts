import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTypeScriptProject, typescriptParserPlugin } from '../index';

test('detectTypeScriptProject identifies TS files with high confidence', () => {
  const detection = typescriptParserPlugin.detect?.({
    'src/app.ts': 'export const ok = true;',
    'package.json': '{}',
  });
  assert.ok(detection);
  assert.strictEqual(detection?.lang, 'typescript');
  assert.strictEqual(detection?.confidence, 'high');
  assert.ok(detection?.matchedFiles?.includes('src/app.ts'));
});

test('parseTypeScriptProject extracts entities and edges', () => {
  const files = {
    'src/service.ts': `
import type { Config } from './types';
import { helper } from './helper';

export class Service {
  constructor(private readonly config: Config) {}

  run(): number {
    helper(this.config);
    return 1;
  }
}

export function bootstrap(): void {
  const svc = new Service({} as Config);
  svc.run();
}
`,
  };

  const ir = parseTypeScriptProject(files);
  const mod = ir.modules['src.service'];
  assert.ok(mod, 'module not found');
  assert.ok(mod.imports.some((imp) => imp.includes('./helper')));
  assert.ok(mod.imports.some((imp) => imp.includes('./types')));
  const service = mod.classes.find((cls) => cls.name === 'Service');
  assert.ok(service, 'Service class missing');
  const run = service.methods.find((m) => m.name === 'run');
  assert.ok(run, 'run method missing');
  assert.ok(run.calls.includes('helper'));
  assert.ok(mod.functions.some((fn) => fn.name === 'bootstrap'));
});

test('parseTypeScriptProject throws on syntax errors', () => {
  assert.throws(() => {
    parseTypeScriptProject({ 'broken.ts': 'export function nope(: void { return; }' });
  }, /syntax error/i);
});

test('parseTypeScriptProject throws when no TS files are provided', () => {
  assert.throws(() => {
    parseTypeScriptProject({ 'README.md': '# docs' });
  }, /No TypeScript source files/);
});
