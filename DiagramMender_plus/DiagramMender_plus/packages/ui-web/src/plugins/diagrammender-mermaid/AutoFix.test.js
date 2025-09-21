import { describe, it, expect } from 'vitest';
import { AutoFix } from './AutoFix.js';

describe('AutoFix', () => {
  it('handles BOM, CRLF, legacy graph and trailing semicolons', () => {
    const input = '\uFEFFgraph TD;\r\nA-->B;\r\n';
    const { code, notes } = AutoFix.run(input);
    expect(code).toBe('flowchart TD\nA-->B');
    expect(notes).toContain('已將 legacy "graph" 轉為 "flowchart"');
  });

  it('adds flowchart header when missing', () => {
    const { code, notes } = AutoFix.run('A-->B');
    expect(code).toBe('flowchart TD\nA-->B');
    expect(notes).toContain('未偵測到圖表宣告，已自動加入 `flowchart TD`');
  });

  it('removes trailing semicolons without other changes', () => {
    const { code, notes } = AutoFix.run('flowchart TD;\nA-->B;');
    expect(code).toBe('flowchart TD\nA-->B');
    expect(notes).toEqual([]);
  });
});
