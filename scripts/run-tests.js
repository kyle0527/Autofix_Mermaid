#!/usr/bin/env node
import { accessSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, '..');

function assertExists(relativePath) {
  const fullPath = join(PROJECT_ROOT, relativePath);
  accessSync(fullPath);
  console.log(`✔ ${relativePath}`);
}

try {
  console.log('Checking project layout...');
  assertExists('index.html');
  assertExists('js/main.js');
  assertExists('js/app.js');
  console.log('Sanity checks passed');
  process.exit(0);
} catch (error) {
  console.error(`Sanity check failed: ${error?.message || error}`);
  process.exit(2);
}
