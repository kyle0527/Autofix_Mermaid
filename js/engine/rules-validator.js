// RulePack / PromptPack validator
// 目的：提供 AJV 驗證（含 fallback），在 loader 與 CI 中皆可使用。

const isNodeRuntime = typeof process !== 'undefined' && !!process.versions?.node;

let validatorInitPromise = null;
const validatorState = {
  attempted: false,
  ajvLoaded: false,
  error: null,
};

function pointerToPath(pointer) {
  if (!pointer) return '<root>';
  const parts = pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (!parts.length) return '<root>';
  let out = parts[0];
  for (let i = 1; i < parts.length; i += 1) {
    const segment = parts[i];
    out += /^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`;
  }
  return out;
}

function formatAjvErrors(errors) {
  if (!errors || !errors.length) {
    return ['Schema validation failed with an unknown error'];
  }
  return errors.map((err) => {
    const basePath = pointerToPath(err.instancePath);
    const missing = err.params && 'missingProperty' in err.params ? err.params.missingProperty : null;
    const location = missing
      ? basePath === '<root>'
        ? missing
        : `${basePath}.${missing}`
      : basePath;
    const message = err.message || 'is invalid';
    return `${location}: ${message}`;
  });
}

async function loadAjvValidators() {
  if (!isNodeRuntime) {
    validatorState.attempted = true;
    validatorState.ajvLoaded = false;
    validatorState.error = null;
    if (!validatorInitPromise) {
      validatorInitPromise = Promise.resolve(null);
    }
    return null;
  }
  if (!validatorInitPromise) {
    validatorInitPromise = (async () => {
      try {
        const [{ default: AjvModule }, fs, path, url] = await Promise.all([
          import('ajv/dist/2020.js'),
          import('node:fs/promises'),
          import('node:path'),
          import('node:url'),
        ]);
        const AjvCtor = AjvModule?.default ? AjvModule.default : AjvModule;
        const ajv = new AjvCtor({ allErrors: true, allowUnionTypes: true, strict: false });

        const moduleDir = path.dirname(url.fileURLToPath(import.meta.url));
        const projectRoot = path.resolve(moduleDir, '..', '..');
        const rulepackSchemaPath = path.join(projectRoot, 'rulepack.schema.json');
        const _promptpackSchemaPath = path.join(projectRoot, 'promptpack.schema.json');

        const [ruleSchemaRaw, promptSchemaRaw] = await Promise.all([
          fs.readFile(rulepackSchemaPath, 'utf8'),
          fs.readFile(_promptpackSchemaPath, 'utf8'),
        ]);

        const ruleSchema = JSON.parse(ruleSchemaRaw);
        const promptSchema = JSON.parse(promptSchemaRaw);
        const validators = {
          rulepackValidator: ajv.compile(ruleSchema),
          promptpackValidator: ajv.compile(promptSchema),
        };

        validatorState.attempted = true;
        validatorState.ajvLoaded = true;
        validatorState.error = null;

        return validators;
      } catch (error) {
        validatorState.attempted = true;
        validatorState.ajvLoaded = false;
        validatorState.error = error;
        console.warn('AJV validators unavailable, falling back to legacy checks:', error);
        return null;
      }
    })();
  }
  const validators = await validatorInitPromise;
  return validators;
}

function legacyRulepackCheck(obj) {
  const issues = [];
  if (!obj || typeof obj !== 'object') {
    issues.push('rulepack: not an object');
    return issues;
  }
  if (!obj.version) issues.push('rulepack.version: missing');
  if (!Array.isArray(obj.rules)) {
    issues.push('rulepack.rules: missing array');
    return issues;
  }
  const allowedPhases = new Set(['preprocess', 'parse', 'analyze', 'fix', 'emit']);
  const allowedPatternKinds = new Set(['regex', 'ast', 'token']);
  const allowedSeverities = new Set(['error', 'warning', 'info']);
  obj.rules.forEach((r, idx) => {
    if (!r.rule_id) issues.push(`rules[${idx}].rule_id: missing`);
    if (typeof r.enabled !== 'boolean') issues.push(`rules[${idx}].enabled: expected boolean`);
    if (!r.phase) {
      issues.push(`rules[${idx}].phase: missing`);
    } else if (!allowedPhases.has(r.phase)) {
      issues.push(`rules[${idx}].phase: invalid value ${r.phase}`);
    }
    if (!r.pattern_kind) {
      issues.push(`rules[${idx}].pattern_kind: missing`);
    } else if (!allowedPatternKinds.has(r.pattern_kind)) {
      issues.push(`rules[${idx}].pattern_kind: invalid value ${r.pattern_kind}`);
    }
    if (!r.fix_action) issues.push(`rules[${idx}].fix_action: missing`);
    if (r.severity && !allowedSeverities.has(r.severity)) {
      issues.push(`rules[${idx}].severity: invalid value ${r.severity}`);
    }
  });
  return issues;
}

function legacyPromptpackCheck(obj) {
  const issues = [];
  if (!obj || typeof obj !== 'object') {
    issues.push('promptpack: not an object');
    return issues;
  }
  if (!obj.version) issues.push('promptpack.version: missing');
  if (!Array.isArray(obj.prompts)) {
    issues.push('promptpack.prompts: missing array');
    return issues;
  }
  obj.prompts.forEach((p, idx) => {
    if (!p.prompt_id) issues.push(`prompts[${idx}].prompt_id: missing`);
    if (!p.intent) issues.push(`prompts[${idx}].intent: missing`);
    if (!p.input_type) issues.push(`prompts[${idx}].input_type: missing`);
    if (!p.template) issues.push(`prompts[${idx}].template: missing`);
  });
  return issues;
}

export async function validateRulepack(obj) {
  const validators = await loadAjvValidators();
  if (validators?.rulepackValidator) {
    const valid = validators.rulepackValidator(obj);
    if (valid) return [];
    return formatAjvErrors(validators.rulepackValidator.errors);
  }
  return legacyRulepackCheck(obj);
}

export async function validatePromptpack(obj) {
  const validators = await loadAjvValidators();
  if (validators?.promptpackValidator) {
    const valid = validators.promptpackValidator(obj);
    if (valid) return [];
    return formatAjvErrors(validators.promptpackValidator.errors);
  }
  return legacyPromptpackCheck(obj);
}

export async function getValidatorDiagnostics() {
  if (!validatorState.attempted) {
    await loadAjvValidators();
  }
  return {
    isNodeRuntime,
    attempted: validatorState.attempted,
    ajvLoaded: validatorState.ajvLoaded,
    error: validatorState.error,
  };
}

// For Node compatibility in scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateRulepack, validatePromptpack, getValidatorDiagnostics };
}
