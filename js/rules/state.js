import { getRuleVersions, ensureRulepack, preprocessMermaid as preprocessWithConfig } from './client.js';

const DEFAULT_MANIFEST_PATH = 'rules/manifest.json';
let manifestPath = DEFAULT_MANIFEST_PATH;
let manifestData = null;
let versionEntries = [];
let currentVersion = null;
const listeners = new Set();

function notify() {
  const snapshot = getRuleConfig();
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn('Rule config listener error:', error);
    }
  }
}

export function onRuleConfigChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRuleConfig() {
  return {
    version: currentVersion,
    manifest_path: manifestPath,
  };
}

export function getAvailableRuleVersions() {
  return versionEntries.slice();
}

export function getManifestSummary() {
  return manifestData;
}

export async function initializeRuleConfig({ preferredVersion, manifestPath: overridePath } = {}) {
  if (overridePath) {
    manifestPath = overridePath;
  }
  const { manifest, versions } = await getRuleVersions({ manifestPath });
  manifestData = manifest;
  versionEntries = versions;
  const availableVersions = versions.map((entry) => entry.version);

  if (preferredVersion && availableVersions.includes(preferredVersion)) {
    currentVersion = preferredVersion;
  } else if (!currentVersion || !availableVersions.includes(currentVersion)) {
    currentVersion = manifest?.defaultVersion || versions[0]?.version || null;
  }

  notify();
  return { manifest, versions, selected: currentVersion };
}

export function setRuleVersion(version) {
  if (version === currentVersion) {
    return currentVersion;
  }
  currentVersion = version || null;
  notify();
  return currentVersion;
}

export async function ensureRulepackForCurrentConfig() {
  return await ensureRulepack(getRuleConfig());
}

export async function preprocessMermaid(text) {
  if (!text) return text;
  try {
    return await preprocessWithConfig(text, getRuleConfig());
  } catch (error) {
    console.warn('Rule preprocess failed:', error);
    return text;
  }
}
