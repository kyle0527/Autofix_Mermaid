
// Simple smoke test for DiagramMender+AutoFix engine
// Usage: node smoke-test.mjs <path-to-code-file>
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { runPipeline } from './packages/core/dist/index.js';

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node smoke-test.mjs <file>");
    process.exit(1);
  }
  const abs = path.resolve(target);
  const content = await fs.readFile(abs, "utf8");
  const files = { [abs]: content };

  const res = await runPipeline(files, {
    lang: "python",
    diagramKind: "flowchart",
    withLinks: true,
    trace: true
  });

  console.log("Kind:", res.kind);
  console.log("Score:", res.score);
  console.log("Fragments:", res.fragments.length);
  console.log("\n--- Mermaid ---\n");
  console.log(res.mermaid);
}

main().catch(e => { console.error(e); process.exit(2); });
