import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoFix } from '../src/plugins/diagrammender-mermaid/AutoFix.js';

test('strips BOM', () => {
  const { code } = AutoFix.run('\uFEFFflowchart TD\nA-->B');
  assert.equal(code, 'flowchart TD\nA-->B');
});

test('normalizes CRLF to LF', () => {
  const { code } = AutoFix.run('flowchart TD\r\nA-->B\r\n');
  assert.equal(code, 'flowchart TD\nA-->B\n');
});

test('removes trailing semicolons', () => {
  const { code } = AutoFix.run('flowchart TD\nA-->B;\nC-->D;');
  assert.equal(code, 'flowchart TD\nA-->B\nC-->D');
});

test('inserts flowchart TD when missing', () => {
  const { code } = AutoFix.run('A-->B');
  assert.equal(code, 'flowchart TD\nA-->B');
});
