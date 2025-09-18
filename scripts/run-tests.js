#!/usr/bin/env node
// Test runner stub: runs a few sanity checks (non-exhaustive)
const { execSync } = require('child_process');
try {
  console.log('Checking main entry...');
  const r = execSync('node -e "require(\'fs\').accessSync(\'index.html\')"');
  console.log('index.html exists');
} catch (e) {
  console.error('index.html missing');
  process.exit(2);
}
console.log('Sanity checks passed');
process.exit(0);
