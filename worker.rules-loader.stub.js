// worker.rules-loader.stub.js
// Minimal loader for RulePack + PromptPack in your Web Worker.

const DEFAULT_RULEPACK_PATH = 'rules/rulepack.json';
const DEFAULT_PROMPTPACK_PATH = 'rules/promptpack.json';
const DEFAULT_MANIFEST_PATH = 'rules/manifest.json';

async function fetchJSON(pathname) {
  const res = await fetch(pathname, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${pathname}: ${res.status}`);
  return await res.json();
}
import { validateRulepack, validatePromptpack } from './js/engine/rules-validator.js';

function getManifestPath(config = {}) {
  return config?.rules?.manifest_path || DEFAULT_MANIFEST_PATH;
}

export function resolvePackSelection(config = {}, manifest = null) {
  const rulesConfig = config?.rules || {};
  const selection = {
    manifestPath: getManifestPath(config),
    version: null,
    rulepackPath: rulesConfig.rulepack_path || null,
    promptpackPath: rulesConfig.promptpack_path || null,
  };

  if (manifest && typeof manifest === 'object') {
    const desiredVersion = rulesConfig.version || manifest.defaultVersion || null;
    if (desiredVersion) {
      const entry = manifest?.versions?.[desiredVersion];
      if (entry) {
        selection.version = desiredVersion;
        if (!selection.rulepackPath && entry.rulepack) {
          selection.rulepackPath = entry.rulepack;
        }
        if (!selection.promptpackPath && entry.promptpack) {
          selection.promptpackPath = entry.promptpack;
        }
      } else if (typeof console !== 'undefined' && console?.warn) {
        console.warn(`Rules manifest missing requested version "${desiredVersion}"`);
      }
    }
  }

  if (!selection.rulepackPath) {
    selection.rulepackPath = DEFAULT_RULEPACK_PATH;
  }
  if (!selection.promptpackPath) {
    selection.promptpackPath = DEFAULT_PROMPTPACK_PATH;
  }

  return selection;
}

export async function loadPacks(config) {
  const manifestPath = getManifestPath(config);
  let manifest = null;

  try {
    manifest = await fetchJSON(manifestPath);
  } catch (error) {
    if (typeof console !== 'undefined' && console?.warn) {
      console.warn(`Failed to load rules manifest at ${manifestPath}:`, error?.message || error);
    }
  }

  const selection = resolvePackSelection(config, manifest);
  const [rules, prompts] = await Promise.all([
    fetchJSON(selection.rulepackPath),
    fetchJSON(selection.promptpackPath).catch(() => ({ version: '1.0.0', prompts: [] })),
  ]);

  // Validate packs and sanitize
  const ruleIssues = await validateRulepack(rules || {});
  if (ruleIssues.length) {
    if (typeof console !== 'undefined' && console?.warn) {
      console.warn('rulepack validation issues:', ruleIssues.slice(0, 10));
    }
    if (Array.isArray(rules?.rules)) {
      rules.rules = rules.rules.map((r) => ({ ...r, enabled: !!r.enabled }));
    }
  }

  const promptIssues = await validatePromptpack(prompts || {});
  if (promptIssues.length && typeof console !== 'undefined' && console?.warn) {
    console.warn('promptpack validation issues:', promptIssues.slice(0, 10));
  }

  return { rules, prompts, manifest, selection };
}

export function dedupeRules(rulepack) {
  const out = [];
  const seen = new Set();
  for (const r of rulepack.rules || []) {
    const fp = `${r.pattern_kind}|${r.pattern}|${r.fix_action}|${JSON.stringify(r.fix_params_json||{})}`;
    if (!seen.has(fp)) {
      seen.add(fp);
      out.push(r);
    }
  }
  return { ...rulepack, rules: out };
}

// Example apply rule (regex/replace) for preprocess phase
export function applyPreprocessRules(code, rulepack) {
  let out = code;
  for (const r of rulepack.rules || []) {
    if (!r.enabled) continue;
    if (r.phase !== 'preprocess') continue;
    if (r.pattern_kind !== 'regex') continue;
    try {
      const re = new RegExp(r.pattern, 'gm');
      if (r.fix_action === 'replace' && r.fix_params_json && r.fix_params_json.replacement) {
        const replacement = String(r.fix_params_json.replacement);
        const jsReplacement = replacement.replace(/\\(\d+)/g, (_, idx) => `$${idx}`);
        out = out.replace(re, jsReplacement);
      }
    } catch (e) {
      // swallow bad rules to avoid crashing
      // eslint-disable-next-line no-console
      console.warn('Bad rule', r.rule_id, e);
    }
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadPacks,
    dedupeRules,
    applyPreprocessRules,
    resolvePackSelection,
  };
}
