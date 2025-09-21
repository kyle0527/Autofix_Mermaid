#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validatePromptpack,
  validateRulepack,
  getValidatorDiagnostics,
} from '../js/engine/rules-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'schema-invalid');

function logCaseResult(file, issues) {
  if (issues.length === 0) {
    throw new Error(`${file} was expected to fail schema validation`);
  }
  console.log(`✔ ${file} produced ${issues.length} schema error(s)`);
}

export async function runSchemaValidationTests() {
  const rulepackPath = path.join(PROJECT_ROOT, 'rules', 'rulepack.json');
  const promptpackPath = path.join(PROJECT_ROOT, 'rules', 'promptpack.json');

  const rulepack = JSON.parse(await readFile(rulepackPath, 'utf8'));
  const promptpack = JSON.parse(await readFile(promptpackPath, 'utf8'));

  const rulepackIssues = await validateRulepack(rulepack);
  if (rulepackIssues.length) {
    throw new Error(`rulepack.json failed schema validation:\n${rulepackIssues.join('\n')}`);
  }
  console.log('✔ rulepack.json matches schema');

  const promptpackIssues = await validatePromptpack(promptpack);
  if (promptpackIssues.length) {
    throw new Error(`promptpack.json failed schema validation:\n${promptpackIssues.join('\n')}`);
  }
  console.log('✔ promptpack.json matches schema');

  const diagnostics = await getValidatorDiagnostics();
  if (diagnostics.isNodeRuntime && !diagnostics.ajvLoaded) {
    const reason = diagnostics.error?.message || diagnostics.error || 'unknown reason';
    throw new Error(`AJV validators failed to load in Node runtime: ${reason}`);
  }

  const cases = [
    { file: 'rulepack-missing-version.json', validator: validateRulepack },
    { file: 'rulepack-invalid-phase.json', validator: validateRulepack },
    { file: 'promptpack-missing-template.json', validator: validatePromptpack },
  ];

  for (const testCase of cases) {
    const filePath = path.join(FIXTURE_DIR, testCase.file);
    const data = JSON.parse(await readFile(filePath, 'utf8'));
    const issues = await testCase.validator(data);
    logCaseResult(testCase.file, issues);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runSchemaValidationTests();
}
