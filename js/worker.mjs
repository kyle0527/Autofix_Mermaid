// js/worker.mjs
import { aiAssist } from './ai/ai-assist.js';
import { runPipeline, runPipelineIR } from './engine-wrapper.mjs';
// mark imported but optional engine helpers as used to avoid lint warnings
void runPipelineIR;

self.onmessage = async (event) => {
  const { files = {}, uiOptions = {} } = event.data || {};
  const code = files?.mermaid ?? 'flowchart TD\nA-->B';
  const dtype = guessDiagram(code) || 'flowchart';
  const configSnapshot = uiOptions?.mermaidConfig || {};

  // If UI requested engine execution, prefer engine-wrapper path (calls global DiagramMenderCore via wrapper)
  try {
    const useEngine = !!(uiOptions && (uiOptions.useEngine || uiOptions.mode === 'engine'));
    if (useEngine) {
      try {
        const result = await runPipeline(files, uiOptions || {});
        // result shape is { code, errors, log, dtype }
        self.postMessage(result);
        return;
      } catch (e) {
        console.warn('engine-wrapper.runPipeline failed, falling back to AI path:', e);
      }
    }
  } catch (e) {
    console.warn('worker engine decision error:', e);
  }

  // AI 協助；若要先觀察建議而不自動套 patch，改 autoApplyFixes:false
  const { rulesHit, retrievals, qa, codePatched, changes } = await aiAssist({
    diagramType: dtype,
    code,
    configSnapshot,
    contextText: '',
    autoApplyFixes: true
  });

  // return consistent payload shape (include ai details)
  self.postMessage({ code: codePatched, dtype, ai: { rulesHit, retrievals, qa, changes } });
};

function guessDiagram(txt) {
  const t = (txt||'').trim();
  if (/^classDiagram\b/m.test(t)) return 'classDiagram';
  if (/^sequenceDiagram\b/m.test(t)) return 'sequenceDiagram';
  if (/^gantt\b/m.test(t)) return 'gantt';
  if (/^(flowchart|graph)\b/m.test(t)) return 'flowchart';
  return null;
}
