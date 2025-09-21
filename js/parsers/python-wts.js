// python-wts.js
// 走 web-tree-sitter
export function parse(src) {
  // ...WTS 解析流程略...
  // mark argument used to silence lint
  void src;
  return { ast: 'stub', method: 'wts' };
}
