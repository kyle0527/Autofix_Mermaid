// python-heuristic.js
// 無 wasm 時的輕量解析（import/def）
export function parse(src) {
  // ...Heuristic 解析流程略...
  // mark argument used to silence lint
  void src;
  return { ast: 'stub', method: 'heuristic' };
}
