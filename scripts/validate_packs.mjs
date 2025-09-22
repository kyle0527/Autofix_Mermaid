#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRulepack, validatePromptpack } from '../js/engine/rules-validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesDir = path.join(__dirname, '..', 'rules');

function logIssues(label, issues) {
  if (!issues.length) return;
  console.error(`${label} validation issues:`);
  for (const issue of issues) {
    console.error('  -', issue);
  }
}

async function validateFile(filePath, validator, label) {
  try {
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const issues = await validator(json);
    if (issues.length) {
      logIssues(label, issues);
      return false;
    }
    console.log(`${label} OK`);
    return true;
  } catch (error) {
    console.error(`Failed to read/parse ${label}:`, error?.message || error);
    return false;
  }
}

async function run() {
  try {
    const rp = path.join(rulesDir, 'rulepack.json');
    const pp = path.join(rulesDir, 'promptpack.json');

    const [ruleOk, promptOk] = await Promise.all([
      validateFile(rp, validateRulepack, 'rulepack.json'),
      validateFile(pp, validatePromptpack, 'promptpack.json'),
    ]);

    if (!ruleOk || !promptOk) {
      process.exitCode = 2;
    }
  } catch (error) {
    console.error('Unexpected error validating packs:', error);
    process.exitCode = 2;
  }
}

run();
