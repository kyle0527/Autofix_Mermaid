/**
 * Main entry point for Mermaid AutoFix application
 * @fileoverview Initializes Mermaid renderer and UI components
 */

import { initializeUI } from './UI.js';
import { initMermaid, renderMermaid, svgToPNG } from './Renderer.js';
import { initP1Features, toggleDocsPanel, toggleConfigPanel } from './app.js';
// P2 imports
import { applyFixes } from './autofix.js';
import { applyLayoutSelection } from './layout.js';

/**
 * Initialize application with error handling
 */
async function initializeApp() {
  try {
    // Initialize Mermaid with safe defaults
    await initMermaid();
    console.info('Mermaid initialized successfully');

    // Wire up UI components
    initializeUI(renderMermaid, svgToPNG, initMermaid);
    console.info('UI initialized successfully');

    // Initialize P1 features (Docs and Config panels)
    initP1Features();
    console.info('P1 features initialized successfully');

    // Initialize P2 features (AutoFix pipeline and Layout)
    initP2Features();
    console.info('P2 features initialized successfully');

    // Bind P1 panel toggle buttons
    const btnDocs = document.getElementById('btnDocs');
    const btnConfig = document.getElementById('btnConfig');

    if (btnDocs) {
      btnDocs.addEventListener('click', toggleDocsPanel);
    }

    if (btnConfig) {
      // For now, we'll use the existing config in the toolbar
      // btnConfig.addEventListener('click', toggleConfigPanel);
    }

  } catch (error) {
    console.error('Application initialization failed:', error);

    // Show user-friendly error message
    const noticeEl = document.getElementById('notice');
    if (noticeEl) {
      noticeEl.textContent = `初始化失敗：${error.message}`;
      noticeEl.style.display = 'block';
    }
  }
}

// Mark optional import as used to avoid lint warning when it's intentionally unused
/* eslint-disable no-unused-vars */
void toggleConfigPanel;

/**
 * Initialize P2 features (AutoFix pipeline and Layout)
 */
function initP2Features() {
  const btnValidate = document.getElementById('btnValidate');
  const btnAutoFix = document.getElementById('btnAutoFix');
  const layoutSelect = document.getElementById('layoutSelect');
  const srcTextarea = document.getElementById('src');
  const logPre = document.getElementById('log');

  if (btnValidate) {
    btnValidate.addEventListener('click', async () => {
      const code = srcTextarea.value;
      try {
        await window.mermaid.parse(code);
        logPre.textContent = '✅ 驗證通過';
      } catch (error) {
        logPre.textContent = `❌ 驗證失敗: ${error.message}`;
      }
    });
  }

  if (btnAutoFix) {
    btnAutoFix.addEventListener('click', () => {
      const result = applyFixes(srcTextarea.value);
      srcTextarea.value = result.code;
      logPre.textContent = result.notes.join('\n');
    });
  }

  if (layoutSelect) {
    layoutSelect.addEventListener('change', () => {
      applyLayoutSelection(window.mermaid, layoutSelect.value);
      // Trigger re-render if there's content
      if (srcTextarea.value.trim()) {
        // This will be handled by the existing render logic
      }
    });
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

