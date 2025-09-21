import { applyFixes } from '@diagrammender/fix-rules-mermaid-compat';

/**
 * AutoFix adapter leveraging the shared Mermaid compatibility fix rules.
 */
export class AutoFix {
  /**
   * @param {string} input
   * @param {{ rules?: { noGraphKeyword?: boolean } }} [opts]
   * @returns {{ code: string, notes: string[] }}
   */
  static run(input, opts = {}) {
    const disabled = [];
    if (opts.rules?.noGraphKeyword) {
      disabled.push('upgradeGraphKeyword');
    }
    const fixOptions = disabled.length ? { disabled } : undefined;
    const result = applyFixes(input, fixOptions);
    return { code: result.code, notes: result.notes.slice() };
  }
}
