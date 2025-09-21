import { resolvePackSelection, applyPreprocessRules } from '../../worker.rules-loader.stub.js';

const DEFAULT_MANIFEST_PATH = 'rules/manifest.json';
const manifestCache = new Map();
const packCache = new Map();

function resolveUrl(pathname) {
  if (!pathname) return pathname;
  try {
    const url = new URL(pathname, (typeof document !== 'undefined' && document.baseURI)
      || (typeof location !== 'undefined' && location.href)
      || undefined);
    return url.toString();
  } catch (error) {
    console.warn('Failed to resolve URL for path', pathname, error);
    return pathname;
  }
}

async function fetchJson(pathname) {
  const url = resolveUrl(pathname);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${pathname}: ${response.status}`);
  }
  return await response.json();
}

export async function getManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  const path = manifestPath || DEFAULT_MANIFEST_PATH;
  if (!manifestCache.has(path)) {
    const promise = fetchJson(path).catch((error) => {
      manifestCache.delete(path);
      throw error;
    });
    manifestCache.set(path, promise);
  }
  return await manifestCache.get(path);
}

export async function getRuleVersions({ manifestPath = DEFAULT_MANIFEST_PATH } = {}) {
  const manifest = await getManifest(manifestPath);
  const entries = Object.entries(manifest?.versions || {});
  const versions = entries
    .map(([version, meta]) => ({
      version,
      rulepack: meta?.rulepack || '',
      promptpack: meta?.promptpack || '',
      generatedAt: meta?.generatedAt || '',
      source: meta?.source || '',
    }))
    .sort((a, b) => {
      const aTs = a.generatedAt ? Date.parse(a.generatedAt) : 0;
      const bTs = b.generatedAt ? Date.parse(b.generatedAt) : 0;
      if (aTs && bTs && aTs !== bTs) return bTs - aTs;
      if (a.version < b.version) return 1;
      if (a.version > b.version) return -1;
      return 0;
    });
  return { manifest, versions };
}

function buildRulesConfig(config = {}) {
  const manifestPath = config.manifest_path || DEFAULT_MANIFEST_PATH;
  const rules = {
    manifest_path: manifestPath,
  };
  if (config.version) rules.version = config.version;
  if (config.rulepack_path) rules.rulepack_path = config.rulepack_path;
  if (config.promptpack_path) rules.promptpack_path = config.promptpack_path;
  return { manifestPath, rules };
}

export async function ensureRulepack(config = {}) {
  const { manifestPath, rules } = buildRulesConfig(config);
  const manifest = await getManifest(manifestPath);
  const selection = resolvePackSelection({ rules }, manifest);
  const cacheKey = `${selection.rulepackPath}|${selection.promptpackPath}`;

  if (!packCache.has(cacheKey)) {
    const promise = (async () => {
      const [rulepack, promptpack] = await Promise.all([
        fetchJson(selection.rulepackPath),
        selection.promptpackPath
          ? fetchJson(selection.promptpackPath).catch(() => ({ version: '1.0.0', prompts: [] }))
          : { version: '1.0.0', prompts: [] },
      ]);
      return { rulepack, promptpack };
    })().catch((error) => {
      packCache.delete(cacheKey);
      throw error;
    });
    packCache.set(cacheKey, promise);
  }

  const packs = await packCache.get(cacheKey);
  return {
    manifest,
    selection,
    rulepack: packs.rulepack,
    promptpack: packs.promptpack,
  };
}

export async function preprocessMermaid(text, config = {}) {
  const input = typeof text === 'string' ? text : String(text || '');
  if (!input) return input;
  const { rulepack } = await ensureRulepack(config);
  return applyPreprocessRules(input, rulepack);
}

export function clearRulepackCache() {
  manifestCache.clear();
  packCache.clear();
}
