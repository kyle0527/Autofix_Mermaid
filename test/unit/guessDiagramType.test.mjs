import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guessDiagramType } from '../../js/engine/common.js';

const cases = [
  { input: 'sequenceDiagram\nA->>B: hi', expect: 'sequenceDiagram' },
  { input: ' classDiagram\nClass01 <|-- Class02', expect: 'classDiagram' },
  { input: '\n\nstateDiagram-v2', expect: 'stateDiagram' },
  { input: 'erDiagram\nUSER ||--|| ACCOUNT : owns', expect: 'erDiagram' },
  { input: 'pie title Pets\n"Dogs" : 50', expect: 'pie' },
  { input: 'gantt\ntitle Roadmap', expect: 'gantt' },
  { input: 'timeline\n2020 : Event', expect: 'timeline' },
  { input: 'block beta\nA-->B', expect: 'block' },
  { input: 'flowchart LR\nA-->B', expect: 'flowchart' },
  { input: 'graph TD\nA-->B', expect: 'flowchart' },
  { input: '  graph LR', expect: 'flowchart' },
  { input: '', expect: 'unknown' },
  { input: '/* comment */', expect: 'unknown' }
];

describe('guessDiagramType', () => {
  for (const c of cases){
    it(`should detect ${c.expect} for input snippet: ${JSON.stringify(c.input.slice(0,25))}`, () => {
      assert.equal(guessDiagramType(c.input), c.expect);
    });
  }

  it('should not mis-detect when flowchart appears later only', () => {
    const input = 'note left of A: this mentions flowchart but not at start';
    assert.equal(guessDiagramType(input), 'unknown');
  });
});
