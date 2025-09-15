/**
 * Main entry point for Mermaid AutoFix application
 * @fileoverview Initializes Mermaid renderer and UI components
 */

import { initializeUI } from './UI.js';
import { initMermaid, renderMermaid, svgToPNG } from './Renderer.js';
import { initP1Features, toggleDocsPanel, toggleConfigPanel } from './app.js';

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

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

