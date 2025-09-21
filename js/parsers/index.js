// index.js
// 自動選 WTS 或 Heuristic
export function parsePython(src, useWTS = false) {
  if (useWTS) {
    // 走 web-tree-sitter
    return import('./python-wts.js').then(mod => mod.parse(src));
  }
  // fallback: Heuristic
  return import('./python-heuristic.js').then(mod => mod.parse(src));
}
