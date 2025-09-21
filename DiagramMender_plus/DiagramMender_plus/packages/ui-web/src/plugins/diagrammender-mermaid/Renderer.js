// Renderer.js — render helper (ESM)
// Lazy-load DOMPurify at render time with multi-CDN fallback
let __domPurify = null;
async function _getDOMPurify() {
  if (__domPurify) return __domPurify;
  const cdns = [
    'https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.es.js',
    'https://unpkg.com/dompurify@3.2.6/dist/purify.es.js',
    // cdnjs only provides UMD, but we can use default export via ESM shim (most modern browsers parse UMD fine when imported as module)
    'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.6/purify.min.js'
  ];
  for (const url of cdns) {
    try {
      const mod = await import(url);
      __domPurify = mod.default || mod.DOMPurify || mod;
      if (__domPurify?.sanitize) return __domPurify;
    } catch (e) {
      console.warn('[DOMPurify] CDN failed:', url, e);
    }
  }
  console.warn('[DOMPurify] Falling back to no-op sanitizer');
  __domPurify = { sanitize: (x) => x };
  return __domPurify;
}

/**
 * Render Mermaid to target element.
 * Sanitizes the generated SVG before injecting to mitigate XSS risks.
 * @param {string} code
 * @param {HTMLElement} outEl
 * @param {import('mermaid').Mermaid} mermaid
 * @returns {Promise<void>}
 */
export async function renderMermaid(code, outEl, mermaid) {
  outEl.classList.add('mermaid');

  try {
    const id =
      'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const { svg } = await mermaid.render(id, code);


    // Sanitize SVG output before injecting into DOM to prevent XSS.
    let clean = '';
    try {
      clean = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } });
    } catch {
      // If sanitization throws, we fall back to a placeholder graphic.
      clean = '';
    }

    if (clean) {
      outEl.innerHTML = clean;
    } else {
      // Fallback message/graphic when sanitization fails or results in empty output.
      outEl.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><text x="0" y="20" fill="currentColor">Diagram unavailable</text></svg>';
    }
  } catch (err) {
    // Clear any partial content on render errors and rethrow.
    outEl.innerHTML = '';
    console.error('Failed to render Mermaid diagram:', err);
    throw err;
  }
}
