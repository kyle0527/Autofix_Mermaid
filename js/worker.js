// Use paths relative to this worker's script URL per Worker spec
importScripts('rules/applyRules.js'); // expects self.applyRules(text, options) -> { code, log, errors }
importScripts('ai/aiEngine.js');      // expects self.aiAnalyze(files, options) -> Promise<{ code, log, errors, dtype }>

self.onmessage = async (event) => {
  const { files, mode = 'rules', options = {} } = event.data || {};
  const dtype = options.diagram || 'flowchart';
  const start = Date.now();

  const baseLog = [];
  function ok(payload) {
    const ms = Date.now() - start;
    self.postMessage({ ...payload, dtype, log: [...(payload.log||[]), { rule: 'worker.time', msg: `done in ${ms}ms`}] });
  }
  function fail(e) {
    ok({ code: `graph TD\n  Error["分析失敗: ${String(e && e.message || e)}"]`, errors: [String(e)], log: baseLog.concat([{ rule:'worker.error', msg: String(e)}]) });
  }

  try {
    if (mode === 'ai') {
      const result = await self.aiAnalyze(files, options);
      if (!result || !result.code) throw new Error('AI returned empty result, falling back to rules');
      ok(result);
      return;
    }

    // Default: rules engine
    const seed = options.seedMermaid || `
      graph TD
        A[UI] --> B[Worker]
        B --> C{${dtype}}
        C -->|ok| A
    `;
    const applied = self.applyRules(seed, { dtype, ...options });
    ok(applied);

  } catch (e) {
    try {
      // Fallback to rules
      const applied = self.applyRules('graph TD\nA[Fallback]-->B[Rules]', { dtype, ...options, fallback: true });
      ok(applied);
    } catch (e2) {
      fail(e2);
    }
  }
};

