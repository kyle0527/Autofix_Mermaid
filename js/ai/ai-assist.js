// js/ai/ai-assist.js
// NOTE: This file resides at js/ai/ai-assist.js. When executed inside a module worker (js/worker.mjs),
// relative fetch paths are resolved against the module file URL (the importer / current module path).
// Using 'js/models/' here produced an incorrect doubled path like: /js/js/models/....
// Correct relative path from js/ai/ to js/models/ is '../models/'.
const AI_MODELS_BASE = '../models/';

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Load failed: ${path}`);
  return res.json();
}

export async function loadAIPack() {
  const [rules, index, qa] = await Promise.all([
    loadJSON(AI_MODELS_BASE + 'rules_v1.json'),
    loadJSON(AI_MODELS_BASE + 'knowledge_index_v1.json'),
    loadJSON(AI_MODELS_BASE + 'qa_templates_v1.json'),
  ]);
  return { rules, index, qa };
}

// tokenizer 與 knowledge_index_v1.json 對齊
function tokenize(text) {
  const re = /[A-Za-z0-9_:+#.\-/]{2,}/g;
  return (text?.toLowerCase().match(re) || []);
}

// TF-IDF 近似打分（使用 index 中的 top-40 postings）
function scoreDocs(index, query, k = 5) {
  const toks = tokenize(query);
  const acc = new Map();
  for (const t of toks) {
    const postings = index.inverted_index[t];
    if (!postings) continue;
    for (const [docId, w] of postings) {
      acc.set(docId, (acc.get(docId) || 0) + w);
    }
  }
  return [...acc.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id, score]) => ({ id, score, doc: index.docs[id] }));
}

function getByPath(obj, path) {
  return path.split('.').reduce((cur, k) => (cur && typeof cur === 'object') ? cur[k] : undefined, obj);
}

// 規則比對（支援 diagram、configRequires、regex_any/regex_all）
function matchRules(rulesPack, diagramType, code, configSnapshot) {
  const out = [];
  for (const r of rulesPack.rules) {
    if (r.detect?.diagram && r.detect.diagram !== diagramType) continue;

    if (r.detect?.config_requires) {
      let ok = true;
      for (const req of r.detect.config_requires) {
        const cur = getByPath(configSnapshot || {}, req.path);
        if (req.equals !== cur) { ok = false; break; }
      }
      if (!ok) continue;
    }

    let hit = false;
    if (r.detect?.regex_all) {
      hit = r.detect.regex_all.every(rx => new RegExp(rx, 'm').test(code));
    } else if (r.detect?.regex_any) {
      hit = r.detect.regex_any.some(rx => new RegExp(rx, 'm').test(code));
    } else {
      hit = true;
    }
    if (hit) out.push(r);
  }
  return out;
}

// 套用簡單的文字補丁
function applyTextPatches(code, rule) {
  const actions = rule.fix?.actions || [];
  let patched = code, changes = [];
  for (const act of actions) {
    if (act.type === 'text_patch' && act.pattern) {
      const before = patched;
      const re = new RegExp(act.pattern, 'gm');
      patched = patched.replace(re, act.replacement ?? '');
      if (patched !== before) {
        changes.push({ id: rule.id, type: 'text_patch', pattern: act.pattern });
      }
    }
  }
  return { patched, changes };
}

// 提供高階 API：回傳規則命中、檢索到的相似 issue、QA 及可選擇是否自動套 patch
export async function aiAssist({ diagramType, code, configSnapshot, contextText, autoApplyFixes = false }) {
  const pack = await loadAIPack();
  const rulesHit = matchRules(pack, diagramType, code, configSnapshot);
  const retrievals = scoreDocs(pack.index, [code, contextText || ''].join('\n'), 5);
  const qa = pack.qa.qa.filter(q => rulesHit.some(r => r.id === q.if_match_rule));

  let codePatched = code;
  const allChanges = [];
  if (autoApplyFixes) {
    for (const r of rulesHit) {
      const { patched, changes } = applyTextPatches(codePatched, r);
      if (changes.length) {
        codePatched = patched;
        allChanges.push(...changes);
      }
    }
  }
  return { rulesHit, retrievals, qa, codePatched, changes: allChanges };
}
