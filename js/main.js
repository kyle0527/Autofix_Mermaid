/**
 * Main entry point for Mermaid AutoFix application
 * @fileoverview Initializes Mermaid renderer and UI components
 */

import { initializeUI } from './UI.js';
import { initMermaid, renderMermaid, svgToPNG } from './Renderer.js';
import { initP1Features, toggleDocsPanel, toggleConfigPanel } from './app.js';
import {
  initI18n,
  translateDocument,
  setLocale,
  getLocale,
  onLocaleChange,
  getAvailableLocales,
  t,
} from './i18n/index.js';
// P2 imports
import { applyLayoutSelection } from './layout.js';

function setupLocalization() {
  initI18n({ defaultLocale: 'zh-Hant' });

  const renderLanguageOptions = () => {
    const selectEl = document.getElementById('languageSelect');
    if (!selectEl) return;

    const locales = getAvailableLocales();
    const current = getLocale();
    selectEl.innerHTML = '';
    for (const entry of locales) {
      const option = document.createElement('option');
      option.value = entry.code;
      option.textContent = t(entry.nameKey);
      option.setAttribute('data-i18n', entry.nameKey);
      selectEl.appendChild(option);
    }
    selectEl.value = current;
  };

  translateDocument();
  renderLanguageOptions();

  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.addEventListener('change', (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement) {
        setLocale(target.value);
      }
    });
  }

  onLocaleChange(() => {
    translateDocument();
    renderLanguageOptions();
  });
}

/**
 * Initialize application with error handling
 */
async function initializeApp() {
  try {
    setupLocalization();
    // Initialize Mermaid with safe defaults
    await initMermaid();
    console.info('Mermaid initialized successfully');

    // Wire up UI components
    const uiControls = initializeUI(renderMermaid, svgToPNG, initMermaid);
    console.info('UI initialized successfully');

    // Initialize P1 features (Docs and Config panels)
    await initP1Features();
    console.info('P1 features initialized successfully');

    // Initialize P2 features (AutoFix pipeline and Layout)
    initP2Features(uiControls);
    console.info('P2 features initialized successfully');

    // Bind P1 panel toggle buttons
    const btnDocs = document.getElementById('btnDocs');
    const btnConfig = document.getElementById('btnConfig');

    if (btnDocs) {
      btnDocs.addEventListener('click', toggleDocsPanel);
    }

    if (btnConfig) {
      btnConfig.addEventListener('click', toggleConfigPanel);
    }

  } catch (error) {
    console.error('Application initialization failed:', error);

    // Show user-friendly error message
    const noticeEl = document.getElementById('notice');
    if (noticeEl) {
      noticeEl.textContent = t('error.initFailed', { message: error.message });
      noticeEl.style.display = 'block';
    }
  }
}

/**
 * Initialize P2 features (AutoFix pipeline and Layout)
 */
function initP2Features(uiControls) {
  const btnValidate = document.getElementById('btnValidate');
  const btnAutoFix = document.getElementById('btnAutoFix');
  const layoutSelect = document.getElementById('layoutSelect');
  const srcTextarea = document.getElementById('src');
  const logPre = document.getElementById('log');

  if (btnValidate && srcTextarea && logPre) {
    btnValidate.addEventListener('click', async () => {
      const code = srcTextarea.value;
      try {
        await window.mermaid.parse(code);
        logPre.textContent = t('validate.success');
      } catch (error) {
        logPre.textContent = t('validate.failure', { message: error.message });
      }
    });
  }

  if (btnAutoFix && uiControls?.runAnalysis) {
    btnAutoFix.addEventListener('click', () => {
      uiControls.runAnalysis('autofix').catch((error) => {
        console.error('AutoFix invocation failed:', error);
        if (logPre) {
          const message = error instanceof Error ? error.message : String(error);
          logPre.textContent = t('notice.errorWithMessage', { message });
        }
      });
    });
  }

  if (layoutSelect) {
    layoutSelect.addEventListener('change', () => {
      applyLayoutSelection(window.mermaid, layoutSelect.value);
      // Trigger re-render if there's content
      if (srcTextarea && srcTextarea.value.trim()) {
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

