
// == 新增：簡單的 SVG 正規化，避免 snapshot/contains 因隨機 id 失敗 ==
function normalizeSvg(svg) {
  if (!svg) return svg;
  return svg
    .replace(/\s*id="[^"]+"/g, '')
    .replace(/\s*class="[^"]+"/g, '')
    .replace(/\s*data-.*?="[^"]*"/g, '')
    .replace(/\s*aria-.*?="[^"]*"/g, '');
}

// == 新增：單題執行 ==
async function runOneCase(caseItem, renderFn, applyRulesFn, aiAssistFn) {
  const mode = caseItem.mode || 'auto';
  let code = caseItem.input;
  const log = [];
  let error = null;
  let svg = null;

  try {
    // mode 選路：baseline -> 原樣，mender -> 套規則，auto -> 先規則，失敗再 AI（若你開啟）
    if (mode === 'mender' || mode === 'auto') {
      const r = applyRulesFn ? applyRulesFn(code, caseItem) : { code };
      code = r.code || code;
      if (r.log) log.push(...r.log);
    }
    if (mode === 'auto' && aiAssistFn) {
      try {
        const { ok, code: maybe } = await aiAssistFn(code, caseItem);
        if (ok && maybe) code = maybe;
      } catch (_) { /* AI 可選，不阻塞 */ }
    }

    const res = await renderFn(code, caseItem.config || {});
    svg = normalizeSvg(res.svg);
  } catch (e) {
    error = String(e && e.message ? e.message : e);
  }

  // 驗證期望
  const ex = caseItem.expect || {};
  let pass = true;
  const details = [];

  if (ex.renderOk === true && error) { pass = false; details.push('expect renderOk=true but got error'); }
  if (ex.renderOk === false && !error) { pass = false; details.push('expect renderOk=false but rendered'); }
  if (ex.contains && svg) {
    for (const t of ex.contains) if (!svg.includes(t)) { pass = false; details.push(`missing: ${t}`); }
  }
  if (ex.notContains && svg) {
    for (const t of ex.notContains) if (svg.includes(t)) { pass = false; details.push(`should not contain: ${t}`); }
  }
  if (ex.errorIncludes && error) {
    for (const t of ex.errorIncludes) if (!error.includes(t)) { pass = false; details.push(`error missing: ${t}`); }
  }

  return { pass, error, svg, log, details, codeUsed: code };
}

// == 與 UI 既有 renderMermaid 打通（你已有 renderMermaid，可透過 postMessage 方式注入或在 worker 內引入）==
async function renderMermaidInWorker(code, cfg) {
  // 假設你已在 worker 端可用 renderMermaid（若不行，可用 importScripts 拉入）
  // 若目前 renderMermaid 在主執行緒，請改走原本 worker<->UI 的渲染橋接。
  return await renderMermaid(code, cfg);
}

// 嘗試載入輕量複雜度估算器（非必要，失敗可略）
try {
  importScripts('./complexity-lite.js');
} catch (e) {
  // 在某些情境（跨源或未部署檔案）可能失敗，安全忽略
}
// expects global function estimateFlowchartComplexity（由 complexity-lite.js 以全域方式掛載）

// --- Minimal in-worker rule implementations (mirrors src/core/rules subset) ---
function rule_legacy_to_flowchart(code){
  return code.replace(/^\s*graph\b/gi,'flowchart');
}
function rule_flow_direction(code){
  if(!/^flowchart/m.test(code)) return code;
  if(/^flowchart\s+(LR|RL|TB|BT|TD)/m.test(code)) return code;
  return code.replace(/^(flowchart)(?!\s+(LR|RL|TB|BT|TD))/m, '$1 LR');
}
function rule_id_normalize(code){
  const lines = code.split(/\n/).map(line=>{
    const m = line.match(/^\s*([A-Za-z0-9_\u0080-\uFFFF]+)(?=[\[(]|-->|===|:::|\s)/);
    if(!m) return line;
    const rawId = m[1];
    const norm = rawId.replace(/[^A-Za-z0-9_]/g,'_');
    if(norm===rawId) return line;
    return line.replace(rawId,norm);
  });
  return lines.join('\n');
}
function rule_label_truncate(code){
  // naive: truncate labels inside [ ... ] or ( ... ) if > 60 chars
  return code.replace(/(\[[^\]]+\]|\([^\)]+\))/g, seg => {
    const raw = seg.slice(1,-1);
    if(raw.length <= 60) return seg;
    return seg[0] + raw.slice(0,57) + '…' + seg[seg.length-1];
  });
}
const RULE_IMPL = {
  'legacy-syntax-upgrade': rule_legacy_to_flowchart,
  'flow-direction': rule_flow_direction,
  'id-normalize': rule_id_normalize,
  'label-truncate': rule_label_truncate
};
function applySelectedRules(code, enabled){
  const applied = [];
  (enabled||[]).forEach(id=>{
    const fn = RULE_IMPL[id];
    if(!fn) return;
    const next = fn(code);
    if(next!==code){ applied.push(id); code = next; }
  });
  return { code, applied };
}

self.onmessage = async (event) => {
  const { type, payload, files, uiConfig, mode, options } = event.data || {};
  if (type === 'runIssueCases') {
    const { testDocs, opts } = payload; // testDocs 是多個 JSON 題檔已讀進來的物件陣列
    const results = [];
    for (const doc of testDocs) {
      for (const c of (doc.cases || [])) {
        const r = await runOneCase(
          c,
          renderMermaidInWorker,
          (opts && opts.applyRulesFn) || null,
          (opts && opts.aiAssistFn) || null
        );
        results.push({ id: doc.id, name: c.name, pass: r.pass, details: r.details, error: r.error });
        // 若失敗且附帶 ruleSuggestion，就回傳給 UI 以便寫入規則庫（見 §5）
        if (!r.pass && c.ruleSuggestion) {
          self.postMessage({ type: 'suggestRule', rule: c.ruleSuggestion, caseId: doc.id, caseName: c.name });
        }
      }
    }
    self.postMessage({ type: 'issueCasesDone', results });
    return;
  }

  // Default path: handle classic rules mode basic transformation to mermaid (placeholder)
  if (files) {
    // naive: pick first file content
    const firstKey = Object.keys(files)[0];
    let code = files[firstKey];
    // Apply rules if provided
    let appliedRules = [];
    if (uiConfig && Array.isArray(uiConfig.enabledRules) && uiConfig.enabledRules.length){
      const r = applySelectedRules(code, uiConfig.enabledRules);
      code = r.code;
      appliedRules = r.applied;
    }
    // attempt complexity (flowchart only heuristic)
    let complexitySummary = null;
    try {
      if (typeof estimateFlowchartComplexity === 'function') {
        complexitySummary = estimateFlowchartComplexity(code);
      }
      if (uiConfig && uiConfig.limits) {
        const { maxNodes, maxEdges, maxDepth } = uiConfig.limits;
        if (complexitySummary) {
          complexitySummary.exceed = (complexitySummary.nodes > maxNodes) || (complexitySummary.edges > maxEdges) || (complexitySummary.depth > maxDepth);
          if (complexitySummary.exceed) {
            const reasons = [];
              if (complexitySummary.nodes > maxNodes) reasons.push('nodes>'+maxNodes);
              if (complexitySummary.edges > maxEdges) reasons.push('edges>'+maxEdges);
              if (complexitySummary.depth > maxDepth) reasons.push('depth>'+maxDepth);
            complexitySummary.reasons = reasons;
          }
        }
      }
    } catch {}
    const log = [{ rule:'worker.info', msg:'processed basic' }];
    if(appliedRules.length) log.push({ rule:'worker.rules', msg:'applied '+appliedRules.join(',') });
    self.postMessage({ code, errors: [], log, dtype: 'flowchart', complexitySummary, appliedRules });
    return;
  }
};

