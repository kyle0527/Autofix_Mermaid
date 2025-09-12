
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
  let log = [];
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

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};
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

  // ...你現有的其他訊息類型（分析/渲染等）保持原狀...
  // 例如原本的 rules/ai 分析流程可保留
};

