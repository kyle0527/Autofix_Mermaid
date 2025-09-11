// js/ai/providers/none.js
// Heuristic fallback provider. Always available.

(function(scope){
  'use strict';
  const impl = {
    version: '1.0.0',
    async analyze(files, options = {}){
      const dtype = options.diagram || 'flowchart';
      const keys = Object.keys(files || {});
      const label = (keys[0] || 'Project');
      const code = `graph TD\n  A[Provider: none]-->B[Diagram: ${dtype}]\n  B-->C[Files: ${keys.length}]\n  C-->D[First: ${label}]`;
      const log = [{ rule: 'ai.none', msg: 'heuristics used' }];
      return { code, errors: [], log, dtype };
    }
  };
  try { scope.registerAIProvider && scope.registerAIProvider('none', impl); } catch (e) {}
})(self);

