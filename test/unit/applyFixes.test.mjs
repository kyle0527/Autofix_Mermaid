import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyFixes } from '../../js/autofix.js';

describe('applyFixes', () => {
  it('should add flowchart declaration when missing', () => {
    const input = 'A --> B';
    const res = applyFixes(input);
    assert.ok(res.code.includes('flowchart'));
    assert.ok(Array.isArray(res.notes));
    assert.ok(res.notes.includes('ensureDiagramDeclaration'));
  });

  it('should normalize newlines and remove trailing semicolons', () => {
    const input = 'graph TD\r\nA --> B;\r\n';
    const res = applyFixes(input);
    assert.ok(!res.code.includes('\r'));
    assert.ok(!res.code.trim().endsWith(';'));
    assert.ok(res.notes.some(n => n.includes('removeTrailingSemicolons') || n.includes('upgradeGraphKeyword')));
  });
});
