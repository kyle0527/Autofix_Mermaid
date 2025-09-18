// js/worker.mjs
// Ensure providers are registered in ESM worker environment
import { registerAll as registerAIPublishers } from './ai/compat.mjs';
import { aiAssist } from './ai/ai-assist.js';
import { runPipeline, runPipelineIR } from './engine-wrapper.mjs';
<<<<<<< HEAD
import { aiAnalyze } from './ai/aiEngine-esm.mjs';
=======
// mark imported but optional engine helpers as used to avoid lint warnings
void runPipelineIR;
>>>>>>> origin/main

self.onmessage = async (event) => {
  // Ensure providers are registered (ESM providers)
  try {
    const ok = await registerAIPublishers(self).catch(()=>false);
    if (!ok) {
      // If providers couldn't be registered via ESM, log and rely on legacy aiEngine (if available)
      console.warn('ESM providers registration failed; ensure legacy providers are available via aiEngine.js');
    }
  } catch (e) {
    console.warn('Provider registration error:', e);
  }

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
  // Prefer using explicit aiAnalyze from ESM engine when available
  let aiResult;
  try {
    aiResult = await aiAnalyze({ mermaid: code }, { diagram: dtype, provider: uiOptions.provider });
  } catch (e) {
    // fall back to aiAssist flow when aiAnalyze fails
    aiResult = null;
  }

  if (aiResult) {
    // aiAnalyze returned a final suggestion shape
    self.postMessage({ code: aiResult.code || code, dtype: aiResult.dtype || dtype, ai: { ...aiResult } });
    return;
  }

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

// js/worker.mjs
// Ensure providers are registered in ESM worker environment
import { registerAll as registerAIPublishers } from './ai/compat.mjs';
import { aiAssist } from './ai/ai-assist.js';
import { runPipeline, runPipelineIR } from './engine-wrapper.mjs';
import { aiAnalyze } from './ai/aiEngine-esm.mjs';

// mark imported but optional engine helpers as used to avoid lint warnings
void runPipelineIR;

self.onmessage = async (event) => {
  // Ensure providers are registered (ESM providers)
  try {
    const ok = await registerAIPublishers(self).catch(()=>false);
    if (!ok) {
      // If providers couldn't be registered via ESM, log and rely on legacy aiEngine (if available)
      console.warn('ESM providers registration failed; ensure legacy providers are available via aiEngine.js');
    }
  } catch (e) {
    console.warn('Provider registration error:', e);
  }

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
  // Prefer using explicit aiAnalyze from ESM engine when available
  let aiResult;
  try {
    aiResult = await aiAnalyze({ mermaid: code }, { diagram: dtype, provider: uiOptions.provider });
  } catch (e) {
    // fall back to aiAssist flow when aiAnalyze fails
    aiResult = null;
  }

  if (aiResult) {
    // aiAnalyze returned a final suggestion shape
    self.postMessage({ code: aiResult.code || code, dtype: aiResult.dtype || dtype, ai: { ...aiResult } });
    return;
  }

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
