// js/ai/providers/webllm.js
// WebLLM provider (must be pre-exposed on worker global as self.webllm)
/* eslint-disable no-unused-vars */

(function(scope){
  'use strict';
  const impl = {
    version: '1.0.0',
    async analyze(files, options = {}){
      const provider = 'webllm';
      const dtype = options.diagram || 'flowchart';
      const seed = `graph TD\n  subgraph AI\n    P[Provider: ${provider}]\n    D[Diagram: ${dtype}]\n  end\n  P-->D`;
      const log = [{ rule: 'ai.start', msg: `provider=${provider}` }];
      try {
        if (!scope.webllm) throw new Error('webllm not available in worker scope');
        const session = await scope.webllm.create();
        const res = await session.chat([
          { role: 'system', content: 'You repair Mermaid diagrams.' },
          { role: 'user', content: 'Return a valid Mermaid graph summarizing the project.' }
        ]);
        const code = (res && res.text) ? res.text : seed;
        return { code, errors: [], log: log.concat([{ rule: 'ai.webllm', msg: 'ok' }]), dtype };
      } catch (e) {
        return { code: seed, errors: [], log: log.concat([{ rule: 'ai.webllm', msg: 'fallback', error: String(e) }]), dtype };
      }
    }
  };
  try { scope.registerAIProvider && scope.registerAIProvider('webllm', impl); } catch (e) {}
})(self);

