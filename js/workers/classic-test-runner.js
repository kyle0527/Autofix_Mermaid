/* eslint-env worker */
(function (global) {
  'use strict';

  const renderer = global.ClassicRenderer;
  const utils = global.ClassicWorkerUtils;

  function getRenderFunction(environment = {}) {
    if (typeof environment.renderMermaid === 'function') {
      return environment.renderMermaid;
    }
    if (renderer && typeof renderer.renderMermaid === 'function') {
      return renderer.renderMermaid;
    }
    throw new Error('缺少 renderMermaid 實作，無法執行測試案例');
  }

  function getNormalizeFunction() {
    if (renderer && typeof renderer.normalizeSvg === 'function') {
      return renderer.normalizeSvg;
    }
    return (svg) => svg;
  }

  function pickApplyRules(environment = {}) {
    if (typeof environment.applyRulesFn === 'function') {
      return environment.applyRulesFn;
    }
    return null;
  }

  function pickAiAssist(environment = {}) {
    if (typeof environment.aiAssistFn === 'function') {
      return environment.aiAssistFn;
    }
    return null;
  }

  async function runCase(caseItem = {}, environment = {}) {
    const renderMermaid = getRenderFunction(environment);
    const normalizeSvg =
      typeof environment.normalizeSvg === 'function'
        ? environment.normalizeSvg
        : getNormalizeFunction();
    const applyRulesFn = pickApplyRules(environment);
    const aiAssistFn = pickAiAssist(environment);

    const mode = caseItem.mode || 'auto';
    let code = caseItem.input || '';
    let svg = null;
    let error = null;

    try {
      if ((mode === 'mender' || mode === 'auto') && applyRulesFn) {
        const applied = await applyRulesFn(code, caseItem);
        if (applied && typeof applied.code === 'string') {
          code = applied.code;
        }
      }

      if (mode === 'auto' && aiAssistFn) {
        try {
          const assisted = await aiAssistFn(code, caseItem);
          if (assisted && assisted.ok && typeof assisted.code === 'string') {
            code = assisted.code;
          }
        } catch (_) {
          // AI 輔助失敗不阻塞測試流程
        }
      }

      const renderResult = await renderMermaid(code, caseItem.config || {});
      svg = normalizeSvg(renderResult && renderResult.svg);
    } catch (err) {
      error = utils ? utils.toErrorMessage(err) : err instanceof Error ? err.message : String(err);
    }

    const expectation = caseItem.expect || {};
    let pass = true;
    const details = [];

    if (expectation.renderOk === true && error) {
      pass = false;
      details.push('expect renderOk=true but got error');
    }
    if (expectation.renderOk === false && !error) {
      pass = false;
      details.push('expect renderOk=false but rendered');
    }
    if (expectation.contains && svg) {
      for (const fragment of expectation.contains) {
        if (!svg.includes(fragment)) {
          pass = false;
          details.push(`missing: ${fragment}`);
        }
      }
    }
    if (expectation.notContains && svg) {
      for (const fragment of expectation.notContains) {
        if (svg.includes(fragment)) {
          pass = false;
          details.push(`should not contain: ${fragment}`);
        }
      }
    }
    if (expectation.errorIncludes && error) {
      for (const fragment of expectation.errorIncludes) {
        if (!error.includes(fragment)) {
          pass = false;
          details.push(`error missing: ${fragment}`);
        }
      }
    }

    return {
      pass,
      error,
      svg,
      details,
      codeUsed: code,
    };
  }

  async function runIssueCases(testDocs = [], opts = {}, environment = {}) {
    const renderMermaid = getRenderFunction(environment);
    const normalizeSvg =
      typeof environment.normalizeSvg === 'function'
        ? environment.normalizeSvg
        : getNormalizeFunction();
    const applyRulesFn = pickApplyRules(environment) || pickApplyRules(opts);
    const aiAssistFn = pickAiAssist(environment) || pickAiAssist(opts);

    const results = [];
    const suggestions = [];

    for (const doc of testDocs) {
      if (!doc || !Array.isArray(doc.cases)) continue;
      for (const c of doc.cases) {
        const outcome = await runCase(c, {
          renderMermaid,
          applyRulesFn,
          aiAssistFn,
          normalizeSvg,
        });

        results.push({
          id: doc.id,
          name: c.name,
          pass: outcome.pass,
          details: outcome.details,
          error: outcome.error,
        });

        if (!outcome.pass && c.ruleSuggestion) {
          suggestions.push({
            caseId: doc.id,
            caseName: c.name,
            rule: c.ruleSuggestion,
          });
        }
      }
    }

    return { results, suggestions };
  }

  global.ClassicTestRunner = Object.freeze({
    runCase,
    runIssueCases,
  });
})(self);
