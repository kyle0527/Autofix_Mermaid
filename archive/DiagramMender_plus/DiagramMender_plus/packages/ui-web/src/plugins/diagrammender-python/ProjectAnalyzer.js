// ProjectAnalyzer.js — lightweight, client-side Python project analyzer (ESM)
// This now delegates core analysis logic to the shared parser module.
import { analyzePythonFiles } from '../../../../parsers/python/src/analyze.js';
import { buildPythonDiagrams } from '../../../../parsers/python/src/diagrams.js';

/** @typedef {{ arch: string, flow: string, stats: {modules: number, edges: number, entrypoints: number} }} ProjectDiagrams */

export async function analyzePythonProject(files) {
  /** @type {{path:string,content:string}[]} */
  const entries = [];
  const readErrors = [];
  const fileList = Array.from(files);

  // Read files sequentially
  for (const f of fileList) {
    if (!/\.py$/i.test(f.name)) continue;
    const rel = (f.webkitRelativePath || f.name).replaceAll('\\', '/');
    try {
      const txt = await f.text();
      entries.push({ path: rel, content: txt });
    } catch (err) {
      readErrors.push(`Failed to read ${rel}: ${err}`);
    }
  }
  
  if (readErrors.length) {
    console.error('File read errors:\n' + readErrors.join('\n'));
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));

  const analysis = analyzePythonFiles(entries);
  return buildPythonDiagrams(analysis);
}
