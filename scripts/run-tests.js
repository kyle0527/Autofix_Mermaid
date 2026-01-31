import { access, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, '..');

async function assertExists(relativePath) {
  const fullPath = join(PROJECT_ROOT, relativePath);
  await access(fullPath);
  console.log(`✔ ${relativePath}`);
}

async function pathExists(relativePath) {
  try {
    const fullPath = join(PROJECT_ROOT, relativePath);
    await access(fullPath);
    return true;
  } catch {
    return false;
  }
}

async function getUnitTestFiles() {
  try {
    const dir = join(PROJECT_ROOT, 'test', 'unit');
    const entries = await readdir(dir);
    return entries
      .filter((entry) => entry.endsWith('.test.mjs') || entry.endsWith('.test.js'))
      .map((entry) => join('test', 'unit', entry));
  } catch {
    return [];
  }
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

async function main() {
  try {
    console.log('Checking project layout...');
    await assertExists('index.html');
    await assertExists('js/main.js');
    await assertExists('js/app.js');
    console.log('Sanity checks passed');

    const unitTestFiles = await getUnitTestFiles();
    if (unitTestFiles.length > 0) {
      console.log('Running unit tests...');
      await runCommand(process.execPath, ['--import', './test/setup.mjs', '--test', ...unitTestFiles]);
    } else {
      console.log('No unit tests found, skipping node --test.');
    }

    console.log('Validating schema definitions...');
    await runCommand(process.execPath, ['scripts/validate-schema.js']);

    if (await pathExists('rules/rulepack.json') || await pathExists('rules/promptpack.json')) {
      console.log('Validating rule/prompt packs...');
      await runCommand(process.execPath, ['scripts/validate_packs.mjs']);
    } else {
      console.log('No rule/prompt packs found, skipping validation.');
    }

    if (await pathExists('scripts/build-packs.mjs')) {
      console.log('Verifying generated packs (--check)...');
      await runCommand(process.execPath, ['scripts/build-packs.mjs', '--check']);
    }

    console.log('All tests completed successfully.');
  } catch (error) {
    console.error(`Test run failed: ${error?.message || error}`);
    process.exit(1);
  }
}

await main();
