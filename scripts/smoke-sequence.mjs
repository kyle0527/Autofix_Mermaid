// scripts/smoke-sequence.mjs
// Simple smoke test: Python -> IR -> Mermaid sequenceDiagram
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const engine = await import('../js/engine-esm.js');
  const files = {
    'main.py': [
      'def a(x):',
      '  return x',
      '',
      'def b(y):',
      '  return a(y)',
      '',
      'def c(z):',
      '  t = b(z)',
      '  return t',
      '',
    ].join('\n'),
  };

  const ir = engine.parsePythonProject(files);
  const res = await engine.runPipelineIR(ir, { diagram: 'sequenceDiagram' });
  const out = String(res.code || '');

  // Basic assertions
  const okHeader = /^\s*sequenceDiagram\b/m.test(out);
  const hasParticipant = /\bparticipant\b/.test(out);

  // Write artifact
  const outDir = resolve(__dirname, '..', 'test-output');
  try { mkdirSync(outDir, { recursive: true }); } catch {}
  const outFile = resolve(outDir, 'smoke_sequence.mmd');
  writeFileSync(outFile, out, 'utf8');

  const pass = okHeader && hasParticipant;
  if (!pass) {
    console.error('Smoke test FAILED');
    console.error('Header ok:', okHeader, ' participants:', hasParticipant);
    console.error('Output:\n' + out);
    process.exit(1);
  }
  console.log('Smoke test PASS');
  console.log('Wrote', outFile);
}

main().catch((e) => { console.error(e); process.exit(1); });
