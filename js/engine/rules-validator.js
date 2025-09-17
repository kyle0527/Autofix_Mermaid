// Basic rulepack / promptpack validator
// 目的：提供輕量驗證（必填欄位、欄位型別檢查、簡易 enum 檢查），在 loader 與 CI 中皆可使用。

export function validateRulepack(obj) {
  const issues = [];
  if (!obj || typeof obj !== 'object') {
    issues.push('rulepack is not an object');
    return issues;
  }
  if (!obj.version) issues.push('missing version');
  if (!Array.isArray(obj.rules)) issues.push('missing rules array');
  if (Array.isArray(obj.rules)) {
    obj.rules.forEach((r, idx) => {
      if (!r.rule_id) issues.push(`rules[${idx}].rule_id missing`);
      if (typeof r.enabled !== 'boolean') issues.push(`rules[${idx}].enabled not boolean`);
      if (!r.phase) issues.push(`rules[${idx}].phase missing`);
      if (!r.pattern_kind) issues.push(`rules[${idx}].pattern_kind missing`);
      if (!r.fix_action) issues.push(`rules[${idx}].fix_action missing`);
    });
  }
  return issues;
}

export function validatePromptpack(obj) {
  const issues = [];
  if (!obj || typeof obj !== 'object') {
    issues.push('promptpack is not an object');
    return issues;
  }
  if (!obj.version) issues.push('missing version');
  if (!Array.isArray(obj.prompts)) issues.push('missing prompts array');
  if (Array.isArray(obj.prompts)) {
    obj.prompts.forEach((p, idx) => {
      if (!p.prompt_id) issues.push(`prompts[${idx}].prompt_id missing`);
      if (!p.intent) issues.push(`prompts[${idx}].intent missing`);
      if (!p.input_type) issues.push(`prompts[${idx}].input_type missing`);
      if (!p.template) issues.push(`prompts[${idx}].template missing`);
    });
  }
  return issues;
}

// For Node compatibility in scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateRulepack, validatePromptpack };
}
