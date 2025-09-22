import { loadDocList, loadDocInto } from './docs.js';
import { bindConfigPanel } from './configPanel.js';
import { t } from './i18n/index.js';
import {
  initializeRuleConfig,
  setRuleVersion,
  getAvailableRuleVersions,
  getManifestSummary,
} from './rules/state.js';

const DOC_PANEL_ID = 'docsPanel';
const DOC_SELECT_IDS = ['docSelect', 'doc-select'];
const DOC_VIEW_ID = 'docView';
const CONFIG_PANEL_ID = 'configPanel';
const RULE_VERSION_SELECT_ID = 'ruleVersionSelect';
const RULE_VERSION_INFO_ID = 'ruleVersionInfo';
const SETTINGS_STORAGE_KEY = 'autofix_mermaid_ui_v1';

function readStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    console.warn('Failed to read stored UI settings:', error);
    return {};
  }
}

let docsInitialized = false;
let docsVisible = false;
let configVisible = false;
let rulesInitialized = false;

function readStoredRuleVersion() {
  const data = readStoredSettings();
  if (typeof data?.rulesVersion === 'string' && data.rulesVersion.trim()) {
    return data.rulesVersion.trim();
  }
  return null;
}

function persistRuleVersion(version) {
  try {
    const data = readStoredSettings();
    if (version) {
      data.rulesVersion = version;
    } else {
      delete data.rulesVersion;
    }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to persist rule version:', error);
  }
}

function readStoredDocSelection() {
  const data = readStoredSettings();
  if (typeof data?.docsSelection === 'string' && data.docsSelection.trim()) {
    return data.docsSelection.trim();
  }
  return null;
}

function persistDocSelection(selection) {
  try {
    const data = readStoredSettings();
    if (selection) {
      data.docsSelection = selection;
    } else {
      delete data.docsSelection;
    }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to persist docs selection:', error);
  }
}

function readStoredPanelState() {
  const data = readStoredSettings();
  return {
    docsVisible: !!data.docsVisible,
    configVisible: !!data.configVisible,
  };
}

function persistPanelState(nextState = {}) {
  try {
    const data = readStoredSettings();
    if (Object.prototype.hasOwnProperty.call(nextState, 'docsVisible')) {
      data.docsVisible = !!nextState.docsVisible;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'configVisible')) {
      data.configVisible = !!nextState.configVisible;
    }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to persist panel state:', error);
  }
}

function formatRuleMetadata(entry) {
  if (!entry) return '';
  const parts = [];
  if (entry.generatedAt) {
    try {
      const date = new Date(entry.generatedAt);
      const formatted = Number.isNaN(date.getTime())
        ? entry.generatedAt
        : date.toLocaleString();
      parts.push(t('config.rules.generatedAt', { date: formatted }));
    } catch (error) {
      parts.push(t('config.rules.generatedAt', { date: entry.generatedAt }));
    }
  }
  if (entry.source) {
    parts.push(t('config.rules.source', { source: entry.source }));
  }
  return parts.join(' · ');
}

function updateRuleVersionInfo(selectedVersion) {
  const infoEl = document.getElementById(RULE_VERSION_INFO_ID);
  if (!infoEl) return;
  const versions = getAvailableRuleVersions();
  const match = versions.find((entry) => entry.version === selectedVersion);
  const metadata = formatRuleMetadata(match);
  infoEl.textContent = metadata;
  infoEl.style.display = metadata ? 'block' : 'none';
}

function renderRuleVersionOptions(selectEl, versions, selectedVersion) {
  if (!selectEl) return;
  const manifest = getManifestSummary();
  const manifestDefault = manifest?.defaultVersion || null;

  selectEl.innerHTML = '';
  if (!versions.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = t('config.rules.versionUnavailable');
    selectEl.appendChild(option);
    selectEl.disabled = true;
    return;
  }

  for (const entry of versions) {
    const option = document.createElement('option');
    option.value = entry.version;
    const textParts = [entry.version];
    if (manifestDefault && entry.version === manifestDefault) {
      textParts.push(`(${t('config.rules.versionDefaultTag')})`);
    }
    option.textContent = textParts.join(' ');
    selectEl.appendChild(option);
  }

  const finalValue = selectedVersion && versions.some((entry) => entry.version === selectedVersion)
    ? selectedVersion
    : (manifestDefault || versions[0].version);
  selectEl.value = finalValue;
  selectEl.disabled = versions.length <= 1;
  updateRuleVersionInfo(selectEl.value);
}

async function ensureRuleVersionsLoaded() {
  if (rulesInitialized) return;
  const selectEl = document.getElementById(RULE_VERSION_SELECT_ID);
  if (!selectEl) return;

  selectEl.innerHTML = '';
  const loadingOption = document.createElement('option');
  loadingOption.value = '';
  loadingOption.textContent = t('config.rules.versionLoading');
  selectEl.appendChild(loadingOption);
  selectEl.disabled = true;

  const preferredVersion = readStoredRuleVersion();

  try {
    const { versions, selected } = await initializeRuleConfig({ preferredVersion });
    renderRuleVersionOptions(selectEl, versions, selected);
    persistRuleVersion(selectEl.value || null);
    const changeHandler = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const nextVersion = target.value || null;
      const appliedVersion = setRuleVersion(nextVersion);
      persistRuleVersion(appliedVersion || null);
      updateRuleVersionInfo(appliedVersion);
    };
    selectEl.addEventListener('change', changeHandler);
    rulesInitialized = true;
  } catch (error) {
    console.error('Failed to load rule versions:', error);
    selectEl.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = t('config.rules.versionUnavailable');
    selectEl.appendChild(option);
    selectEl.disabled = true;
    const infoEl = document.getElementById(RULE_VERSION_INFO_ID);
    if (infoEl) {
      infoEl.textContent = t('config.rules.versionUnavailable');
      infoEl.style.display = 'block';
    }
  }
}

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
      persistDocSelection(null);
      docsInitialized = true;
      return;
    }

    for (const file of files) {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = file.replace(/\.md$/i, '');
      selectEl.appendChild(option);
    }

    const storedSelection = readStoredDocSelection();
    if (storedSelection && files.includes(storedSelection)) {
      selectEl.value = storedSelection;
    } else {
      selectEl.selectedIndex = 0;
    }

    selectEl.addEventListener('change', () => {
      loadSelectedDoc(selectEl, viewEl);
      persistDocSelection(selectEl.value || null);
    });

    await loadSelectedDoc(selectEl, viewEl);
    persistDocSelection(selectEl.value || null);
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
  persistPanelState({ docsVisible });
}

export function toggleConfigPanel() {
  const panel = document.getElementById(CONFIG_PANEL_ID);
  if (!panel) {
    console.warn('Config panel not found.');
    return;
  }

  configVisible = !configVisible;
  updatePanelVisibility(panel, configVisible);
  persistPanelState({ configVisible });
}

export async function initP1Features() {
  await ensureDocsInitialized();

  const storedPanels = readStoredPanelState();

  const docsPanel = document.getElementById(DOC_PANEL_ID);
  if (docsPanel) {
    docsVisible = !!storedPanels.docsVisible;
    updatePanelVisibility(docsPanel, docsVisible);
  } else {
    docsVisible = false;
  }

  const configPanel = document.getElementById(CONFIG_PANEL_ID);
  if (configPanel) {
    configVisible = !!storedPanels.configVisible;
    updatePanelVisibility(configPanel, configVisible);
  } else {
    configVisible = false;
  }

  await ensureRuleVersionsLoaded();

  try {
    if (typeof window !== 'undefined' && window.mermaid) {
      bindConfigPanel(window.mermaid);
    }
  } catch (error) {
    console.warn('Failed to bind config panel:', error);
  }
}
