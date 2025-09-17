// worker.rules-loader.stub.js
// Minimal loader for RulePack + PromptPack in your Web Worker.

async function fetchJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}
import { validateRulepack, validatePromptpack } from './engine/rules-validator.js';

export async function loadPacks(config) {
  const rulepackPath = (config && config.rules && config.rules.rulepack_path) || 'rules/rulepack.json';
  const promptpackPath = 'rules/promptpack.json';
  const [rules, prompts] = await Promise.all([
    fetchJSON(rulepackPath),
    fetchJSON(promptpackPath).catch(() => ({ version: '1.0.0', prompts: [] }))
  ]);
  // Validate packs and sanitize
  const ruleIssues = validateRulepack(rules || {});
  if (ruleIssues.length) {
    // eslint-disable-next-line no-console
    console.warn('rulepack validation issues:', ruleIssues.slice(0,10));
    // disable invalid rules to be safe
    if (Array.isArray(rules && rules.rules)) {
      rules.rules = rules.rules.map(r => ({ ...r, enabled: !!r.enabled }));
    }
  }
  const promptIssues = validatePromptpack(prompts || {});
  if (promptIssues.length) {
    // eslint-disable-next-line no-console
    console.warn('promptpack validation issues:', promptIssues.slice(0,10));
  }
  return { rules, prompts };
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
        out = out.replace(re, r.fix_params_json.replacement);
      }
    } catch (e) {
      // swallow bad rules to avoid crashing
      // eslint-disable-next-line no-console
      console.warn('Bad rule', r.rule_id, e);
    }
  }
  return out;
}
