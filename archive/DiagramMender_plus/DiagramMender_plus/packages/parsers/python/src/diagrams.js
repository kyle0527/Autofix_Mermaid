// Minimal diagrams.js - builds trivial Mermaid from analyze() result
/**
 * @param {{ modules: string[] }} analysis
 * @returns {{ arch: string, flow: string, stats: {modules: number, edges: number, entrypoints: number} }}
 */
export function buildPythonDiagrams(analysis) {
  const lines = ['flowchart LR', '  %% Modules'];
  for (const m of analysis.modules) {
    const id = 'mod_' + m.replace(/[^A-Za-z0-9_]/g, '_');
    lines.push(`  ${id}["${m}"]`);
  }
  return {
    arch: lines.join('\n'),
    flow: 'flowchart TD\n  %% (flow stub)',
    stats: { modules: analysis.modules.length, edges: 0, entrypoints: 0 },
  };
}
