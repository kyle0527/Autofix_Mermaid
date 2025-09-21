#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import xlsx from 'xlsx';
import { validatePromptpack, validateRulepack } from '../js/engine/rules-validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

function toProjectPath(relativePath) {
  if (!relativePath) return PROJECT_ROOT;
  const resolved = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(PROJECT_ROOT, relativePath);
  return resolved;
}

function toPosixRelative(targetPath) {
  const rel = path.relative(PROJECT_ROOT, targetPath);
  return rel.split(path.sep).join('/');
}

function parseJsonField(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  const text = String(value);
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('Failed to parse JSON field, falling back to object:', error.message);
    return fallback;
  }
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (!text) return false;
  return ['true', '1', 'yes', 'y'].includes(text);
}

function extractVersion(ruleRows, explicitVersion) {
  if (explicitVersion) return explicitVersion;
  for (const row of ruleRows) {
    if (row && typeof row.version === 'string' && row.version.trim()) {
      return row.version.trim();
    }
  }
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

async function loadManifest(manifestPath) {
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { defaultVersion: '', versions: {} };
  }
}

async function saveManifest(manifestPath, manifest) {
  const data = JSON.stringify(manifest, null, 2);
  await fs.writeFile(manifestPath, data, 'utf8');
}

async function readJsonFile(filePath, label) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`${label} is missing at ${toPosixRelative(filePath)} (reason: ${error?.message || error})`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} is not valid JSON at ${toPosixRelative(filePath)}: ${error?.message || error}`);
  }
}

async function ensureFileMatches(filePath, expectedObject, label) {
  const existing = await readJsonFile(filePath, label);
  const normalizedExisting = JSON.stringify(existing, null, 2);
  const normalizedExpected = JSON.stringify(expectedObject, null, 2);
  if (normalizedExisting !== normalizedExpected) {
    throw new Error(`${label} is out of date. Run the build script without --check to regenerate packs.`);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string', short: 's' },
      outDir: { type: 'string', short: 'o' },
      version: { type: 'string', short: 'v' },
      manifest: { type: 'string', short: 'm' },
      setDefault: { type: 'boolean' },
      check: { type: 'boolean' },
    },
  });

  const manifestPath = toProjectPath(values.manifest ?? path.join('rules', 'manifest.json'));
  let manifest = null;

  if (values.check && !values.version) {
    manifest = await loadManifest(manifestPath);
    if (manifest?.defaultVersion) {
      values.version = manifest.defaultVersion;
    } else {
      throw new Error('Unable to infer version for --check. Provide --version or set defaultVersion in rules/manifest.json.');
    }
  }

  const sourcePath = toProjectPath(values.source ?? path.join('__not_shipped__', 'data', 'diagram_knowledge_pack.xlsx'));
  const workbook = xlsx.readFile(sourcePath);

  const ruleRows = xlsx.utils.sheet_to_json(workbook.Sheets.RuleCatalog, { defval: '' });
  const promptRows = xlsx.utils.sheet_to_json(workbook.Sheets.AI_Prompts, { defval: '' });

  if (!Array.isArray(ruleRows) || ruleRows.length === 0) {
    throw new Error('RuleCatalog sheet is empty.');
  }

  const packVersion = extractVersion(ruleRows, values.version);
  const defaultOutDir = path.join('rules', 'versions', packVersion);
  const outDir = toProjectPath(values.outDir ?? defaultOutDir);
  if (values.check) {
    try {
      await fs.access(outDir);
    } catch (error) {
      throw new Error(`Expected output directory missing for version ${packVersion}: ${toPosixRelative(outDir)} (${error?.message || error})`);
    }
  } else {
    await fs.mkdir(outDir, { recursive: true });
  }

  const rules = [];
  for (const row of ruleRows) {
    if (!row?.rule_id) continue;
    rules.push({
      rule_id: row.rule_id,
      title: row.title || '',
      category: row.category || '',
      diagram_types: row.diagram_types || '',
      phase: row.phase || '',
      severity: row.severity || '',
      enabled: toBoolean(row.enabled ?? true),
      pattern_kind: row.pattern_kind || '',
      pattern: row.pattern || '',
      condition_json: parseJsonField(row.condition_json, {}),
      fix_action: row.fix_action || '',
      fix_params_json: parseJsonField(row.fix_params_json, {}),
      example_in: row.example_in || '',
      example_out: row.example_out || '',
      notes: row.notes || '',
      origin: row.origin || '',
      version: row.version || '',
      created_at: row.created_at || '',
      updated_at: row.updated_at || '',
    });
  }

  const prompts = [];
  for (const row of promptRows) {
    if (!row?.prompt_id) continue;
    prompts.push({
      prompt_id: row.prompt_id,
      intent: row.intent || '',
      input_type: row.input_type || '',
      template: row.template || '',
      schema_ref: row.schema_ref || '',
      system_instructions: row.system_instructions || '',
    });
  }

  const rulepack = { version: packVersion, rules };
  const promptpack = { version: packVersion, prompts };

  const [ruleIssues, promptIssues] = await Promise.all([
    validateRulepack(rulepack),
    validatePromptpack(promptpack),
  ]);

  if (ruleIssues.length) {
    throw new Error(`Generated rulepack failed schema validation:\n${ruleIssues.join('\n')}`);
  }

  if (promptIssues.length) {
    throw new Error(`Generated promptpack failed schema validation:\n${promptIssues.join('\n')}`);
  }

  const rulepackPath = path.join(outDir, 'rulepack.json');
  const promptpackPath = path.join(outDir, 'promptpack.json');

  if (values.check) {
    manifest = manifest ?? await loadManifest(manifestPath);
    if (!manifest?.versions?.[packVersion]) {
      throw new Error(`Manifest does not contain version ${packVersion}. Run the build script without --check to register it.`);
    }

    const manifestEntry = manifest.versions[packVersion];
    await ensureFileMatches(toProjectPath(manifestEntry.rulepack), rulepack, `Manifest rulepack entry (${manifestEntry.rulepack})`);
    await ensureFileMatches(toProjectPath(manifestEntry.promptpack), promptpack, `Manifest promptpack entry (${manifestEntry.promptpack})`);

    if (manifest.defaultVersion === packVersion) {
      await ensureFileMatches(path.join(PROJECT_ROOT, 'rules', 'rulepack.json'), rulepack, 'rules/rulepack.json');
      await ensureFileMatches(path.join(PROJECT_ROOT, 'rules', 'promptpack.json'), promptpack, 'rules/promptpack.json');
    }

    await ensureFileMatches(rulepackPath, rulepack, `${toPosixRelative(rulepackPath)}`);
    await ensureFileMatches(promptpackPath, promptpack, `${toPosixRelative(promptpackPath)}`);

    console.log(`Pack outputs already match manifest entry for version ${packVersion}`);
    return;
  }

  await fs.writeFile(rulepackPath, JSON.stringify(rulepack, null, 2), 'utf8');
  await fs.writeFile(promptpackPath, JSON.stringify(promptpack, null, 2), 'utf8');

  console.log(`Wrote packs for version ${packVersion} to ${toPosixRelative(outDir)}`);

  manifest = manifest ?? await loadManifest(manifestPath);
  manifest.versions[packVersion] = {
    rulepack: toPosixRelative(rulepackPath),
    promptpack: toPosixRelative(promptpackPath),
    source: toPosixRelative(sourcePath),
    generatedAt: new Date().toISOString(),
  };

  const setDefault = values.setDefault !== undefined ? values.setDefault : true;
  if (setDefault) {
    manifest.defaultVersion = packVersion;
    await fs.copyFile(rulepackPath, path.join(PROJECT_ROOT, 'rules', 'rulepack.json'));
    await fs.copyFile(promptpackPath, path.join(PROJECT_ROOT, 'rules', 'promptpack.json'));
  }

  await saveManifest(manifestPath, manifest);
  console.log(`Updated manifest at ${toPosixRelative(manifestPath)}`);
}

await main();
