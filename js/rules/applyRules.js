/* Simple, battery-included rules applier
 * Loads js/models/rules_v1.json (same origin) and applies a few text-based fixes.
 */

self._rulesCache = null;

function resolveRulesUrl() {
  try {
    // Worker is located at .../js/worker.js — models is a sibling of worker.js under js/
    return new URL('models/rules_v1.json', self.location.href).toString();
  } catch (e) {
    // Fallback best-effort
    return 'js/models/rules_v1.json';
  }
}

async function loadRules() {
  if (self._rulesCache) return self._rulesCache;
  const url = resolveRulesUrl();
  const resp = await fetch(url, { cache: 'no-store' });
  self._rulesCache = await resp.json();
  return self._rulesCache;
}

function wrapWholeWordBackticks(text, word) {
  const re = new RegExp(`\\b${word}\\b`, 'g');
  return text.replace(re, '`' + word + '`');
}

function shouldApply(rule, text, cfg) {
  try {
    if (rule.applies_to && cfg && cfg.dtype && !rule.applies_to.includes(cfg.dtype)) {
      return false;
    }
    // very simple detection - run regex on the text
    if (rule.detect && rule.detect.type === 'regex' && rule.detect.pattern) {
      const re = new RegExp(rule.detect.pattern, 'm');
      if (!re.test(text)) return false;
    }
  } catch (e) {
    return false;
  }
  return true;
}

function applyOne(rule, text, log, errors) {
  try {
    if (rule.fix?.type === 'wrap_backticks_if_whole_word' && rule.fix.target_word) {
      const newText = wrapWholeWordBackticks(text, rule.fix.target_word);
      if (newText !== text) log.push({ rule: rule.id, msg: `wrapped '${rule.fix.target_word}' with backticks` });
      return newText;
    }
    if (rule.fix?.type === 'regex_replace' && rule.fix.pattern) {
      const re = new RegExp(rule.fix.pattern, 'm');
      const newText = text.replace(re, rule.fix.replacement || '');
      if (newText !== text) log.push({ rule: rule.id, msg: 'regex_replace applied' });
      return newText;
    }
    if (rule.fix?.type === 'remove_lines_matching' && rule.fix.pattern) {
      const re = new RegExp(rule.fix.pattern, 'm');
      const lines = text.split(/\r?\n/);
      const kept = lines.filter(l => !re.test(l));
      if (kept.length !== lines.length) log.push({ rule: rule.id, msg: 'removed lines matching rule' });
      return kept.join('\n');
    }
    if (rule.fix?.type === 'note_only' && rule.fix.message) {
      log.push({ rule: rule.id, msg: rule.fix.message });
      return text;
    }
  } catch (e) {
    errors.push(String(e));
  }
  return text;
}

// Initial no-op variant (until rules are loaded)
self.applyRules = function applyRules(mermaidText, _options) {
  const text = String(mermaidText || '');
  return {
    code: text,
    log: [{ rule: 'rules.init', msg: 'Rules not yet loaded; will apply after fetch.' }],
    errors: []
  };
};

// Lazy-load rules at worker bootstrap, then replace applyRules with active version
(async () => {
  try {
    const rules = await loadRules();
    self.applyRules = function(mermaidText, options) {
      let text = String(mermaidText || '');
      const log = [];
      const errors = [];
      const cfg = options || {};
      for (const rule of rules) {
        if (shouldApply(rule, text, cfg)) {
          text = applyOne(rule, text, log, errors);
        }
      }
      return { code: text, log, errors };
    };
  } catch (e) {
    // If load fails, keep the initial no-op applyRules
  }
})();
