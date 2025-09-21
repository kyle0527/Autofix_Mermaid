/* eslint-env worker */
(function (global) {
  'use strict';

  const MERMAID_SCRIPT = '../assets/mermaid-11.11.0/mermaid.min.js';
  let mermaidLoaded = false;
  let mermaidLoadError = null;

  function normalizeSvg(svg) {
    if (!svg) return svg;
    return String(svg)
      .replace(/\s*id="[^"]+"/g, '')
      .replace(/\s*class="[^"]+"/g, '')
      .replace(/\s*data-.*?="[^"]*"/g, '')
      .replace(/\s*aria-.*?="[^"]*"/g, '');
  }

  function ensureMermaid(config = {}) {
    if (!mermaidLoaded) {
      try {
        importScripts(MERMAID_SCRIPT);
        mermaidLoaded = true;
      } catch (error) {
        mermaidLoadError = error instanceof Error ? error : new Error(String(error));
        throw mermaidLoadError;
      }
    }

    if (mermaidLoadError) {
      throw mermaidLoadError;
    }

    const mermaidLib = global.mermaid;
    if (!mermaidLib) {
      throw new Error('Mermaid 全域物件未在 classic worker 中建立');
    }

    const baseConfig = {
      startOnLoad: false,
      securityLevel: 'strict',
    };

    const flowchartConfig = {
      curve: config?.curve || config?.flowchart?.curve || 'basis',
      ...(config?.flowchart || {}),
    };

    const finalConfig = {
      ...baseConfig,
      ...config,
      flowchart: flowchartConfig,
    };

    try {
      mermaidLib.initialize(finalConfig);
    } catch (error) {
      console.warn('Mermaid 初始化警告（可能已初始化）:', error);
    }

    return mermaidLib;
  }

  async function renderMermaid(code, cfg = {}) {
    const mermaidLib = ensureMermaid(cfg);
    const renderKey = `mmd-worker-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const result = await mermaidLib.render(renderKey, code);
    if (typeof result === 'string') {
      return { svg: result };
    }
    if (result && typeof result.svg === 'string') {
      return result;
    }
    return { svg: String(result ?? '') };
  }

  global.ClassicRenderer = Object.freeze({
    ensureMermaid,
    renderMermaid,
    normalizeSvg,
  });
})(self);
