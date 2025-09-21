import fs from 'fs/promises';
import path from 'path';

const MODELS_DIR = path.resolve('./js/models');
const OUT_DIR = path.resolve('./tests/output');

async function loadJSON(name){
  const p = path.join(MODELS_DIR, name);
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt);
}

function getByPath(obj, pathStr) {
  return pathStr.split('.').reduce((cur, k) => (cur && typeof cur === 'object') ? cur[k] : undefined, obj);
}

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
    try {
      if (r.detect?.regex_all) {
        hit = r.detect.regex_all.every(rx => new RegExp(rx, 'm').test(code));
      } else if (r.detect?.regex_any) {
        hit = r.detect.regex_any.some(rx => new RegExp(rx, 'm').test(code));
      } else {
        hit = true;
      }
    } catch(e){ hit = false; }
    if (hit) out.push(r);
  }
  return out;
}

function applyTextPatches(code, rule) {
  const actions = rule.fix?.actions || [];
  let patched = code, changes = [];
  for (const act of actions) {
    if (act.type === 'text_patch' && act.pattern) {
      const before = patched;
      try {
        const re = new RegExp(act.pattern, 'gm');
        patched = patched.replace(re, act.replacement ?? '');
        if (patched !== before) changes.push({ id: rule.id, type: 'text_patch', pattern: act.pattern });
      } catch(e){ /* skip invalid regex */ }
    }
  }
  return { patched, changes };
}

function guessDiagram(txt) {
  const t = (txt||'').trim();
  if (/^classDiagram\b/m.test(t)) return 'classDiagram';
  if (/^sequenceDiagram\b/m.test(t)) return 'sequenceDiagram';
  if (/^gantt\b/m.test(t)) return 'gantt';
  if (/^(flowchart|graph)\b/m.test(t)) return 'flowchart';
  return 'flowchart';
}

function simpleMermaidValidator(code){
  const res = { ok: true, problems: [] };
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    res.ok = false; res.problems.push('empty code'); return res;
  }
  const pairs = { '(':')','[':']','{':'}' };
  const stack = [];
  for (const ch of code) {
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (Object.values(pairs).includes(ch)) {
      const exp = stack.pop(); if (exp !== ch) { res.ok=false; res.problems.push('unbalanced brackets'); break; }
    }
  }
  if (stack.length) { res.ok=false; res.problems.push('unclosed brackets'); }
  if (!/\b(graph|flowchart|classDiagram|sequenceDiagram|gantt)\b/i.test(code)) { res.ok=false; res.problems.push('no diagram keyword'); }
  if (!/-->|<--|-->\|/.test(code) && !/\[.*\]/.test(code)) { res.ok=false; res.problems.push('no edges or nodes found'); }
  return res;
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const rulesPack = await loadJSON('rules_v1.json');

  // extract mermaid examples from official knowledge index
  const index = await loadJSON('knowledge_index_v1.json');
  const examples = [];
  const codeBlocks = [];
  const fenceRe = /```(?:mermaid\n)?([\s\S]*?)(?:```|$)/gmi;
  const docsArray = Array.isArray(index.docs) ? index.docs : (index.docs ? Object.values(index.docs) : []);
  for (const item of docsArray) {
    const body = item.body || item.description || '';
    let m;
    while ((m = fenceRe.exec(body))) {
      const code = m[1].trim();
      if (/\b(graph|flowchart|classDiagram|sequenceDiagram|gantt)\b/i.test(code)) {
        codeBlocks.push(code);
      }
    }
    // also attempt to find inline examples without fences
    const inlineRe = /\b(graph|flowchart|classDiagram|sequenceDiagram|gantt)\b[\s\S]{0,400}/gmi;
    const m2 = body.match(inlineRe);
    if (m2) {
      for (const s of m2) {
        const snippet = s.split('\n').slice(0,6).join('\n');
        if (!codeBlocks.includes(snippet) && /\b(graph|flowchart|classDiagram|sequenceDiagram|gantt)\b/i.test(snippet)) codeBlocks.push(snippet);
      }
    }
    if (codeBlocks.length >= 50) break;
  }

  // normalize and take up to 40 valid examples; if not enough, generate simple ones
  for (let i=0;i<Math.min(40, codeBlocks.length); i++) {
    const id = `official-${i}`;
    examples.push({ id, code: codeBlocks[i] });
  }
  // supplement if fewer than 40
  for (let i=examples.length;i<40;i++) {
    examples.push({ id: `synthetic-${i}`, code: `graph TD\n  A${i}-->B${i}\n  B${i}-->C${i}` });
  }

  // create broken variants (one per valid sample) by introducing small faults
  const brokenExamples = [];
  for (let i=0;i<examples.length;i++) {
    const src = examples[i].code;
    // fault1: remove a closing bracket if present
    let broken = src.replace(/\](?=[^\]]*$)/, '');
    if (broken === src) broken = src.replace(/-->/, '--'); // fallback: break an arrow
    brokenExamples.push({ id: examples[i].id + '-broken', code: broken });
  }
  // final test set: interleave valid and broken
  const finalExamples = [];
  for (let i=0;i<examples.length;i++) { finalExamples.push(examples[i]); finalExamples.push(brokenExamples[i]); }
  // ensure we have ~80 tests (40 valid + 40 broken)
  const testSet = finalExamples.slice(0, 80);

  const results = [];
  for (const ex of testSet) {
    const initialValid = simpleMermaidValidator(ex.code);
    const dtype = guessDiagram(ex.code);
    const rulesHit = matchRules(rulesPack, dtype, ex.code, {});
    let curr = ex.code;
    const allChanges = [];
    const trace = [];
    for (const r of rulesHit) {
      const { patched, changes } = applyTextPatches(curr, r);
      trace.push({ rule: r.id, changes });
      if (changes.length) {
        curr = patched;
        allChanges.push(...changes);
      }
    }
    const finalValid = simpleMermaidValidator(curr);
    const rec = {
      id: ex.id,
      initialValid: initialValid.ok,
      initialProblems: initialValid.problems,
      rulesHit: rulesHit.map(r=>r.id),
      trace,
      patchesApplied: allChanges,
      finalValid: finalValid.ok,
      finalProblems: finalValid.problems,
      codeBefore: ex.code,
      codeAfter: curr
    };
    results.push(rec);
  }

  await fs.writeFile(path.join(OUT_DIR,'results.json'), JSON.stringify(results, null, 2), 'utf8');
  const csv = ['id,initialValid,finalValid,rulesHit,patchCount,initialProblems,finalProblems'].join('\n') + '\n' + results.map(r=>[
    r.id, r.initialValid, r.finalValid, '"'+r.rulesHit.join(';')+'"', r.patchesApplied.length, '"'+(r.initialProblems||[]).join('|')+'"', '"'+(r.finalProblems||[]).join('|')+'"'
  ].join(',')).join('\n');
  await fs.writeFile(path.join(OUT_DIR,'results.csv'), csv, 'utf8');

  const okCount = results.filter(r=>r.finalValid).length;
  console.log(`Processed ${results.length} diagrams, ${okCount} passed final validation.`);
  // write a per-diagram trace file as well
  await fs.writeFile(path.join(OUT_DIR,'results-trace.json'), JSON.stringify(results, null, 2), 'utf8');
}

run().catch(e=>{ console.error(e); process.exit(2); });

