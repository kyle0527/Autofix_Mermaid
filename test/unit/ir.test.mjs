import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIR, addEntity, addRelation, toMermaidClassDiagram } from '../../js/engine/ir.js';

describe('IR basic operations', () => {
  it('should create empty IR', () => {
    const ir = createIR();
    assert.ok(ir.entities.length === 0);
    assert.ok(ir.relations.length === 0);
  });

  it('should add entities and relation then output classDiagram', () => {
    const ir = createIR();
  addEntity(ir, { id: 'A', kind: 'class', name: 'Base' });
  addEntity(ir, { id: 'B', kind: 'class', name: 'Child' });
    addRelation(ir, { from: 'B', to: 'A', type: 'EXTENDS' });
    const out = toMermaidClassDiagram(ir);
    assert.match(out, /classDiagram/);
    assert.match(out, /Base <\|-- Child/);
  });

  it('should throw on invalid entity', () => {
    const ir = createIR();
    assert.throws(() => addEntity(ir, { id: 'X', kind: 'class' }), /Invalid entity/);
  });
});
