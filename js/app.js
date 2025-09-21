import { loadDocList, loadDocInto } from './docs.js';
import { bindConfigPanel } from './configPanel.js';
import { t } from './i18n/index.js';

const DOC_PANEL_ID = 'docsPanel';
const DOC_SELECT_IDS = ['docSelect', 'doc-select'];
const DOC_VIEW_ID = 'docView';
const CONFIG_PANEL_ID = 'configPanel';

let docsInitialized = false;
let docsVisible = false;
let configVisible = false;

function getDocSelectElement() {
  for (const id of DOC_SELECT_IDS) {
    const el = document.getElementById(id);
    if (el) {
      return /** @type {HTMLSelectElement} */ (el);
    }
  }
  return null;
}

function getDocViewElement() {
  const el = document.getElementById(DOC_VIEW_ID);
  return el ?? null;
}

async function loadSelectedDoc(selectEl, viewEl) {
  if (!selectEl || !viewEl) return;
  const docPath = selectEl.value;
  if (!docPath) {
    viewEl.textContent = '';
    return;
  }

  viewEl.setAttribute('data-i18n', 'docs.loading');
  viewEl.textContent = t('docs.loading');
  try {
    await loadDocInto(viewEl, docPath);
    viewEl.removeAttribute('data-i18n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    viewEl.removeAttribute('data-i18n');
    viewEl.textContent = t('docs.loadError', { message });
  }
}

async function ensureDocsInitialized() {
  if (docsInitialized) return;

  const selectEl = getDocSelectElement();
  const viewEl = getDocViewElement();

  if (!selectEl || !viewEl) {
    console.warn('Docs panel elements not found.');
    return;
  }

  try {
    const files = await loadDocList();
    selectEl.innerHTML = '';

    if (!files.length) {
      const option = document.createElement('option');
      option.value = '';
      option.dataset.i18n = 'docs.noneOption';
      option.textContent = t('docs.noneOption');
      selectEl.appendChild(option);
      viewEl.setAttribute('data-i18n', 'docs.emptyMessage');
      viewEl.textContent = t('docs.emptyMessage');
      docsInitialized = true;
      return;
    }

    for (const file of files) {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = file.replace(/\.md$/i, '');
      selectEl.appendChild(option);
    }

    selectEl.addEventListener('change', () => {
      loadSelectedDoc(selectEl, viewEl);
    });

    // Load the first document by default
    selectEl.selectedIndex = 0;
    await loadSelectedDoc(selectEl, viewEl);
    docsInitialized = true;
  } catch (error) {
    const viewEl = getDocViewElement();
    const message = error instanceof Error ? error.message : String(error);
    if (viewEl) {
      viewEl.removeAttribute('data-i18n');
      viewEl.textContent = t('docs.listError', { message });
    }
    console.error('Failed to initialize docs panel:', error);
  }
}

function updatePanelVisibility(panel, visible) {
  if (!panel) return;
  panel.style.display = visible ? 'block' : 'none';
  panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

export async function toggleDocsPanel() {
  const panel = document.getElementById(DOC_PANEL_ID);
  if (!panel) {
    console.warn('Docs panel not found.');
    return;
  }

  docsVisible = !docsVisible;
  if (docsVisible) {
    await ensureDocsInitialized();
  }
  updatePanelVisibility(panel, docsVisible);
}

export function toggleConfigPanel() {
  const panel = document.getElementById(CONFIG_PANEL_ID);
  if (!panel) {
    console.warn('Config panel not found.');
    return;
  }

  configVisible = !configVisible;
  updatePanelVisibility(panel, configVisible);
}

export async function initP1Features() {
  await ensureDocsInitialized();

  const docsPanel = document.getElementById(DOC_PANEL_ID);
  if (docsPanel) {
    docsPanel.style.display = 'none';
    docsPanel.setAttribute('aria-hidden', 'true');
  }

  const configPanel = document.getElementById(CONFIG_PANEL_ID);
  if (configPanel) {
    configPanel.style.display = 'none';
    configPanel.setAttribute('aria-hidden', 'true');
  }

  try {
    if (typeof window !== 'undefined' && window.mermaid) {
      bindConfigPanel(window.mermaid);
    }
  } catch (error) {
    console.warn('Failed to bind config panel:', error);
  }
}
