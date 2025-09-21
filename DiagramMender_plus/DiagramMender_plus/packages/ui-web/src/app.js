/* app.js — orchestrates UI */
// Dynamic loader with multi-CDN fallback (prevents blank page when a CDN is blocked)
async function loadMermaid() {
  const cdns = [
    'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs',
    'https://unpkg.com/mermaid@11/dist/mermaid.esm.min.mjs',
    'https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.0.0/mermaid.esm.min.mjs'
  ];
  const errors = [];
  for (const url of cdns) {
    try {
      const mod = await import(url);
      return mod.default || mod;
    } catch (e) {
      console.warn('[Mermaid] CDN failed:', url, e);
      errors.push(String(e));
    }
  }
  throw new Error('All Mermaid CDNs failed: ' + errors.join(' | '));
}
import { AutoFix } from './plugins/diagrammender-mermaid/AutoFix.js';
import { renderMermaid } from './plugins/diagrammender-mermaid/Renderer.js';
import { setupUI } from './plugins/ui/UI.js';

/** Initialize Mermaid & UI */
export async function initApp() {
  const mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'default',
    logLevel: 'fatal',
  });

  const els = {
    src: /** @type {HTMLTextAreaElement} */ (document.getElementById('src')),
    out: /** @type {HTMLDivElement} */ (document.getElementById('out')),
    log: /** @type {HTMLPreElement} */ (document.getElementById('log')),
    btn: /** @type {HTMLButtonElement} */ (
      document.getElementById('btn-render')
    ),
    chkDark: /** @type {HTMLInputElement} */ (
      document.getElementById('chk-dark')
    ),
  };

  setupUI({ els, mermaid, AutoFix, renderMermaid });
}
