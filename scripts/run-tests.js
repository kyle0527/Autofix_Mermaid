#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { runSchemaValidationTests } from '../tests/schema-validation.mjs';
import { runRulesPipelineTests } from '../tests/rules-pipeline.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, '..');

async function assertExists(relativePath) {
  const fullPath = join(PROJECT_ROOT, relativePath);
  await access(fullPath);
  console.log(`✔ ${relativePath}`);
}

async function verifyPackBuildOutputs() {
  const scriptPath = join(PROJECT_ROOT, 'scripts', 'build-packs.mjs');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, '--check'], {
      stdio: 'inherit',
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Pack build check exited with code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    console.log('Checking project layout...');
    await assertExists('index.html');
    await assertExists('js/main.js');
    await assertExists('js/app.js');
    console.log('Sanity checks passed');

    console.log('Running pack schema validation tests...');
    await runSchemaValidationTests();
    console.log('Schema validation tests passed');

    console.log('Running rules pipeline fixtures...');
    await runRulesPipelineTests();
    console.log('Rules pipeline fixtures passed');

    console.log('Verifying generated rule/prompt packs against source workbook...');
    await verifyPackBuildOutputs();
    console.log('Rule/prompt packs are up to date');
  } catch (error) {
    console.error(`Test run failed: ${error?.message || error}`);
    process.exit(2);
  }
}

await main();
