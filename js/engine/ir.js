// Intermediate Representation (IR) 基礎骨架
// 後續可擴充：屬性細節 / 型別資訊 / 命名空間 / 修飾詞

export function createIR(meta = {}) {
  return {
    meta: { createdAt: new Date().toISOString(), ...meta },
    entities: [], // { id, kind, name, file?, line?, data? }
    relations: [] // { from, to, type, data? }
  };
}

export function addEntity(ir, entity) {
  if (!entity || !entity.id || !entity.kind || !entity.name) {
    throw new Error('Invalid entity: must include id, kind, name');
  }
  ir.entities.push(entity);
  return entity.id;
}

export function addRelation(ir, rel) {
  if (!rel || !rel.from || !rel.to || !rel.type) {
    throw new Error('Invalid relation: must include from, to, type');
  }
  ir.relations.push(rel);
  return ir.relations.length - 1;
}

export function findEntity(ir, id) {
  return ir.entities.find(e => e.id === id);
}

export function toMermaidClassDiagram(ir) {
  // 基礎：只將 kind === 'class' 的 entity 輸出為節點
  const lines = ['classDiagram'];
  for (const e of ir.entities.filter(e => e.kind === 'class')) {
    lines.push(`class ${e.name}`);
  }
  for (const r of ir.relations) {
    if (r.type === 'EXTENDS') {
      const from = findEntity(ir, r.from);
      const to = findEntity(ir, r.to);
      if (from && to) lines.push(`${to.name} <|-- ${from.name}`);
    }
  }
  return lines.join('\n');
}

// 預留更多轉換器（dependency graph, sequence, etc.）

// 為瀏覽器全域提供（可選）
if (typeof self !== 'undefined') {
  self.IR = { createIR, addEntity, addRelation, findEntity, toMermaidClassDiagram };
}
