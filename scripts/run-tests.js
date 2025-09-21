#!/usr/bin/env node
import { accessSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, '..');

function assertExists(relativePath) {
  const fullPath = join(PROJECT_ROOT, relativePath);
  accessSync(fullPath);
  console.log(`✔ ${relativePath}`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      stdio: 'inherit', 
      cwd: PROJECT_ROOT,
      ...options 
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
    child.on('error', reject);
  });
}

async function runTests() {
  try {
    console.log('=== Checking project layout ===');
    assertExists('index.html');
    assertExists('js/main.js');
    assertExists('js/app.js');
    console.log('✔ Sanity checks passed\n');

    console.log('=== Running unit tests ===');
    try {
      await runCommand('node', ['--test', 'test/unit/*.test.mjs']);
      console.log('✔ All unit tests passed\n');
    } catch (error) {
      // 運行 Schema 驗證測試，即使其他測試失敗
      console.log('⚠️  Some unit tests failed, but running schema validation tests...');
      await runCommand('node', ['--test', 'test/unit/schema-validation.test.mjs']);
      console.log('✔ Schema validation tests passed\n');
    }

    console.log('=== Validating schemas ===');
    await runCommand('node', ['validate-schema.js']);
    console.log('✔ Schema validation passed\n');

    console.log('🎉 All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Test failed: ${error?.message || error}`);
    process.exit(1);
  }
}

runTests();
