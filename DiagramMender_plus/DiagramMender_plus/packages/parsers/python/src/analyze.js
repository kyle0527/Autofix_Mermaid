// Minimal analyze.js - builds a trivial module list from file paths
/**
 * @typedef {{path: string, content: string}} Entry
 */

/**
 * @param {Entry[]} entries
 * @returns {{ modules: string[] }}
 */
export function analyzePythonFiles(entries) {
  const modules = entries.map(e => e.path);
  return { modules };
}
