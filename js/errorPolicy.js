import { t } from './i18n/index.js';

export const ErrorCat = {
  PARSE: 'E10x',
  RULES_MISSING: 'E20x',
  RULES_FETCH: 'E21x',
  RULES_NOMATCH: 'E22x',
  LAYOUT_MISSING: 'E30x',
  SANITIZED: 'E40x',
  WORKER_TIMEOUT: 'E50x',
  UNKNOWN_DIAGRAM: 'E60x',
  VERSION_MISMATCH: 'E70x',
  CHUNK_MISSING: 'E80x',
};

const ERROR_MESSAGES = {
  [ErrorCat.PARSE]: { key: 'error.parse', includeDetail: true },
  [ErrorCat.RULES_MISSING]: { key: 'error.rulesMissing' },
  [ErrorCat.RULES_FETCH]: { key: 'error.rulesFetch' },
  [ErrorCat.RULES_NOMATCH]: { key: 'error.rulesNoMatch' },
  [ErrorCat.LAYOUT_MISSING]: { key: 'error.layoutMissing' },
  [ErrorCat.SANITIZED]: { key: 'error.sanitized' },
  [ErrorCat.WORKER_TIMEOUT]: { key: 'error.workerTimeout' },
  [ErrorCat.UNKNOWN_DIAGRAM]: { key: 'error.unknownDiagram' },
  [ErrorCat.VERSION_MISMATCH]: { key: 'error.versionMismatch' },
  [ErrorCat.CHUNK_MISSING]: { key: 'error.chunkMissing' },
};

export function friendlyMessage(category, detail = '') {
  const entry = ERROR_MESSAGES[category] || { key: 'error.default' };
  const message = t(entry.key);
  if (entry.includeDetail && detail) {
    return `${message}\n${detail}`;
  }
  return message;
}
