#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePackSelection, applyPreprocessRules } from '../worker.rules-loader.stub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

async function readJson(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

async function readText(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  return fs.readFile(fullPath, 'utf8');
}

export async function runRulesPipelineTests() {
  const manifest = await readJson('rules/manifest.json');
  assert.ok(manifest?.defaultVersion, 'manifest should define defaultVersion');
  assert.ok(manifest?.versions?.[manifest.defaultVersion], 'manifest should include entry for defaultVersion');

  const selection = resolvePackSelection({}, manifest);
  assert.strictEqual(selection.version, manifest.defaultVersion, 'default selection should use manifest default');
  assert.strictEqual(selection.rulepackPath, manifest.versions[manifest.defaultVersion].rulepack);
  assert.strictEqual(selection.promptpackPath, manifest.versions[manifest.defaultVersion].promptpack);

  const overrideSelection = resolvePackSelection(
    { rules: { rulepack_path: 'custom/rulepack.json' } },
    manifest,
  );
  assert.strictEqual(overrideSelection.rulepackPath, 'custom/rulepack.json', 'explicit rulepack_path should override manifest');
  assert.strictEqual(
    overrideSelection.promptpackPath,
    manifest.versions[manifest.defaultVersion].promptpack,
    'promptpack should fall back when only rulepack_path is provided',
  );

  const rulepack = await readJson(selection.rulepackPath);
  assert.ok(Array.isArray(rulepack.rules) && rulepack.rules.length > 0, 'rulepack should contain rules');

  const examplesDir = path.join('tests', 'fixtures', 'rules', 'examples');
  const cases = [
    {
      file: 'class-empty-body.mmd',
      verify(output) {
        assert.ok(/class Foo \{ \}/.test(output), 'class body should include whitespace');
      },
    },
    {
      file: 'flowchart-label-graph.mmd',
      verify(output) {
        assert.ok(/\[`graph`\]/.test(output), "graph label should be wrapped in backticks");
      },
    },
    {
      file: 'flowchart-multi-graph.mmd',
      verify(output) {
        const occurrences = output.match(/`graph`/g) || [];
        assert.strictEqual(occurrences.length, 2, 'both graph instances should be escaped');
      },
    },
  ];

  for (const testCase of cases) {
    const relativePath = path.join(examplesDir, testCase.file);
    const input = await readText(relativePath);
    const output = applyPreprocessRules(input, rulepack);
    assert.notStrictEqual(output, input, `${testCase.file} should be modified by preprocess rules`);
    testCase.verify(output);
    console.log(`✔ ${testCase.file} transformed by preprocess rules`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runRulesPipelineTests();
}
