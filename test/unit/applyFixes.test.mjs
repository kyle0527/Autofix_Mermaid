import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyFixes } from '../../js/autofix.js';

describe('applyFixes', () => {
  it('should add flowchart declaration when missing', () => {
    const input = 'A --> B';
    const res = applyFixes(input);
    assert.ok(res.code.includes('flowchart'));
    assert.ok(Array.isArray(res.notes));
    assert.ok(res.notes.some(n => n.includes('ensureDiagramDeclaration')));
  });

  it('should normalize newlines and remove trailing semicolons', () => {
    const input = 'graph TD\r\nA --> B;\r\n';
    const res = applyFixes(input);
    assert.ok(!res.code.includes('\r'));
    assert.ok(!res.code.trim().endsWith(';'));
    assert.ok(res.notes.some(n => n.includes('removeTrailingSemicolons') || n.includes('upgradeGraphKeyword')));
  });

  it('renames keyword nodes and updates references consistently', () => {
    const input = `
flowchart TD
  start((Start))
  end((End))
  start -->|go to end| end
  class end highlight
  subgraph cluster
    start --> end
  end
`;

    const res = applyFixes(input);
    const code = res.code;

    assert.ok(code.includes('startNode((Start))'));
    assert.ok(code.includes('endNode((End))'));
    assert.ok(code.includes('startNode -->|go to end| endNode'));
    assert.ok(code.includes('class endNode highlight'));
    assert.ok(code.includes('|go to end|'));
    assert.ok(!code.includes('|go to endNode|'));
    assert.ok(code.includes('startNode --> endNode'));

    const trimmedLines = code.split('\n').map(line => line.trim());
    assert.ok(trimmedLines.includes('end'));
    assert.ok(res.notes.includes('fixKeywordNodeId(end)'));
    assert.ok(res.notes.includes('fixKeywordNodeId(start)'));
  });
});
