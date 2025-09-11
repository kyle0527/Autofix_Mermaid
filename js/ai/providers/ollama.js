// js/ai/providers/ollama.js
// Ollama HTTP provider (localhost). Safe to fail and fallback.

(function(scope){
  'use strict';
  const impl = {
    version: '1.0.0',
    async analyze(files, options = {}){
      const dtype = options.diagram || 'flowchart';
      const provider = 'ollama';
      const seed = `graph TD\n  subgraph AI\n    P[Provider: ${provider}]\n    D[Diagram: ${dtype}]\n  end\n  P-->D`;
      const log = [{ rule: 'ai.start', msg: `provider=${provider}` }];
      try {
        const prompt = [
          'You are a Mermaid diagram repair assistant. ',
          'Return ONLY a valid Mermaid string. If unsure, produce a simple graph TD diagram.',
          'Files: ', Object.keys(files || {}).join(', ')
        ].join('\n');
        const body = JSON.stringify({
          model: options.model || 'qwen2.5:3b',
          prompt,
          stream: false,
          options: { temperature: 0.1 }
        });
        const resp = await fetch('http://localhost:11434/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body
        });
        if (!resp.ok) throw new Error(`ollama http ${resp.status}`);
        const data = await resp.json();
        const text = (data && (data.response || data.text || '')).trim();
        const code = text || seed;
        return { code, errors: [], log: log.concat([{ rule: 'ai.ollama', msg: 'ok' }]), dtype };
      } catch (e) {
        return { code: seed, errors: [], log: log.concat([{ rule: 'ai.ollama', msg: 'fallback', error: String(e) }]), dtype };
      }
    }
  };
  try { scope.registerAIProvider && scope.registerAIProvider('ollama', impl); } catch (e) {}
})(self);

