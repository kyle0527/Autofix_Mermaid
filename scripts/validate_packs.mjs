#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRulepack, validatePromptpack } from '../js/engine/rules-validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesDir = path.join(__dirname, '..', 'rules');

async function run() {
  try {
    const rp = path.join(rulesDir, 'rulepack.json');
    const pp = path.join(rulesDir, 'promptpack.json');
    let fail = false;
    try {
      const rj = JSON.parse(await fs.readFile(rp, 'utf8'));
      const issues = validateRulepack(rj);
      if (issues.length) {
        console.error('rulepack.json validation issues:');
        issues.forEach(i => console.error('  -', i));
        fail = true;
      } else {
        console.log('rulepack.json OK');
      }
    } catch (e) {
      console.error('Failed to read/parse rulepack.json:', e.message);
      fail = true;
    }

    try {
      const pj = JSON.parse(await fs.readFile(pp, 'utf8'));
      const issues2 = validatePromptpack(pj);
      if (issues2.length) {
        console.error('promptpack.json validation issues:');
        issues2.forEach(i => console.error('  -', i));
        fail = true;
      } else {
        console.log('promptpack.json OK');
      }
    } catch (e) {
      console.error('Failed to read/parse promptpack.json:', e.message);
      fail = true;
    }

    if (fail) process.exitCode = 2;
  } catch (e) {
    console.error('Unexpected error validating packs:', e);
    process.exitCode = 2;
  }
}

run();
