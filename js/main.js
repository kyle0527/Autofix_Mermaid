/**
 * Main entry point for Mermaid AutoFix application
 * @fileoverview Initializes Mermaid renderer and UI components
 */

import { initializeUI } from './UI.js';
import { initMermaid, renderMermaid, svgToPNG } from './Renderer.js';

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

