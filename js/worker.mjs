// js/worker.mjs
import { aiAssist } from './ai/ai-assist.js';
import { runPipeline as runPipelineWrapper, runPipelineIR as runPipelineIRWrapper } from './engine-wrapper.mjs';
// Load simple text rules; it installs self.applyRules lazily
import './rules/applyRules.js';
// mark imported but optional engine helpers as used to avoid lint warnings
void runPipelineIRWrapper;

self.onmessage = async (event) => {
  const payload = event.data || {};
  const files = payload.files || {};
  // Accept both uiOptions and options (legacy)
  const uiOptions = payload.uiOptions || payload.options || {};
  const providedMermaid = files?.mermaid;
  const initialCode = providedMermaid ?? 'flowchart TD\nA-->B';
  const requestedDiagram = uiOptions?.diagram || guessDiagram(initialCode) || 'flowchart';
  const configSnapshot = uiOptions?.mermaidConfig || {};

  // Helper: apply simple rules if available
  async function applyRulesIfAny(text, dtype) {
    try {
      if (typeof self.applyRules === 'function') {
        const { code, log = [], errors = [] } = await self.applyRules(String(text || ''), { dtype });
        const appliedRules = Array.isArray(log) ? log.map(x => x?.rule).filter(Boolean) : [];
        return { code, log, errors, appliedRules };
      }
    } catch (e) {
      // ignore and return original
    }
    return { code: String(text || ''), log: [], errors: [], appliedRules: [] };
  }

  // Determine if Python sources are present
  const hasPython = Object.keys(files || {}).some(k => /\.py$/i.test(k));

  // 1) If Python present, prefer ESM engine pipeline
  if (hasPython) {
    try {
      const esm = await import('./engine-esm.js');
      const ir = esm.parsePythonProject(files);
      const result = await esm.runPipelineIR(ir, { diagram: requestedDiagram });
      const rulesRes = await applyRulesIfAny(result.code, result.dtype || requestedDiagram);
      self.postMessage({
        code: rulesRes.code,
        errors: (result.errors || []).concat(rulesRes.errors || []),
        log: (result.log || []).concat(rulesRes.log || []),
        dtype: result.dtype || requestedDiagram,
        appliedRules: rulesRes.appliedRules || []
      });
      return;
    } catch (e) {
      console.warn('engine-esm.runPipeline failed, trying wrapper:', e);
      try {
        const result = await runPipelineWrapper(files, { diagram: requestedDiagram });
        const rulesRes = await applyRulesIfAny(result.code, result.dtype || requestedDiagram);
        self.postMessage({
          code: rulesRes.code,
          errors: (result.errors || []).concat(rulesRes.errors || []),
          log: (result.log || []).concat(rulesRes.log || []),
          dtype: result.dtype || requestedDiagram,
          appliedRules: rulesRes.appliedRules || []
        });
        return;
      } catch (e2) {
        console.warn('engine-wrapper.runPipeline failed, falling back to AI path:', e2);
      }
    }
  } else {
    // 2) If UI explicitly requests engine mode (even without .py), try wrapper first
    try {
      const useEngine = !!(uiOptions && (uiOptions.useEngine || uiOptions.mode === 'engine'));
      if (useEngine) {
        try {
          const result = await runPipelineWrapper(files, { diagram: requestedDiagram });
          const rulesRes = await applyRulesIfAny(result.code, result.dtype || requestedDiagram);
          self.postMessage({
            code: rulesRes.code,
            errors: (result.errors || []).concat(rulesRes.errors || []),
            log: (result.log || []).concat(rulesRes.log || []),
            dtype: result.dtype || requestedDiagram,
            appliedRules: rulesRes.appliedRules || []
          });
          return;
        } catch (e) {
          console.warn('engine-wrapper.runPipeline failed (explicit engine), continuing to AI:', e);
        }
      }
    } catch (e) {
      console.warn('worker engine decision error:', e);
    }
  }

  // 3) AI 協助；若要先觀察建議而不自動套 patch，改 autoApplyFixes:false
  const { rulesHit, retrievals, qa, codePatched, changes } = await aiAssist({
    diagramType: requestedDiagram,
    code: initialCode,
    configSnapshot,
    contextText: '',
    autoApplyFixes: true
  });

  // return consistent payload shape (include ai details)
  self.postMessage({ code: codePatched, dtype: requestedDiagram, ai: { rulesHit, retrievals, qa, changes } });
};

function guessDiagram(txt) {
  const t = (txt||'').trim();
  if (/^classDiagram\b/m.test(t)) return 'classDiagram';
  if (/^sequenceDiagram\b/m.test(t)) return 'sequenceDiagram';
  if (/^gantt\b/m.test(t)) return 'gantt';
  if (/^(flowchart|graph)\b/m.test(t)) return 'flowchart';
  return null;
}
