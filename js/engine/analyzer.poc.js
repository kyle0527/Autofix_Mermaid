// Simple PoC analyzer (JS-only) - regex-based, NOT a full parser.
// Purpose: quickly extract classes and extends relations from small JS files
// and populate the IR defined in js/engine/ir.js

import { createIR, addEntity, addRelation, toMermaidClassDiagram } from './ir.js';

export function analyzeFilesToIR(files) {
  const ir = createIR({ source: 'poc-analyzer' });
  for (const f of files) {
    const content = f.content || '';
    const path = f.path || f.name || 'unknown';
    // find class declarations: `class ClassName` or `export class ClassName`
    const classRe = /(?:export\s+)?class\s+([A-Za-z0-9_]+)/g;
    let m;
    while ((m = classRe.exec(content)) !== null) {
      const id = `${path}::${m[1]}`;
      addEntity(ir, { id, kind: 'class', name: m[1], file: path });
    }

    // find extends: `class Sub extends Super`
    const extendsRe = /class\s+([A-Za-z0-9_]+)\s+extends\s+([A-Za-z0-9_]+)/g;
    while ((m = extendsRe.exec(content)) !== null) {
      const subId = `${path}::${m[1]}`;
      const supId = `${path}::${m[2]}`;
      // ensure entities exist
      try { addEntity(ir, { id: subId, kind: 'class', name: m[1], file: path }); } catch (e) {}
      try { addEntity(ir, { id: supId, kind: 'class', name: m[2], file: path }); } catch (e) {}
      addRelation(ir, { from: subId, to: supId, type: 'EXTENDS' });
    }

    // find simple imports to create dependency edges (import X from './y')
    const importRe = /import\s+(?:[\w\s{},*]+)\s+from\s+['"](.+)['"]/g;
    while ((m = importRe.exec(content)) !== null) {
      const impPath = m[1];
      // add a module entity for the import path
      const modId = `${path}::module::${impPath}`;
      try { addEntity(ir, { id: modId, kind: 'module', name: impPath, file: path }); } catch (e) {}
      const fileModuleId = `${path}::module::self`;
      try { addEntity(ir, { id: fileModuleId, kind: 'module', name: path, file: path }); } catch (e) {}
      addRelation(ir, { from: fileModuleId, to: modId, type: 'IMPORTS' });
    }
  }
  return ir;
}

export function irToMermaid(ir) {
  // Use existing toMermaidClassDiagram for classes; if no classes found, fall back to dependency graph
  const classes = ir.entities.filter(e => e.kind === 'class');
  if (classes.length) return toMermaidClassDiagram(ir);

  // fallback: simple dependency graph
  const lines = ['graph LR'];
  for (const e of ir.entities) {
    const id = e.id.replace(/[^A-Za-z0-9_]/g, '_');
    lines.push(`${id}["${e.name}"]`);
  }
  for (const r of ir.relations) {
    const from = r.from.replace(/[^A-Za-z0-9_]/g, '_');
    const to = r.to.replace(/[^A-Za-z0-9_]/g, '_');
    lines.push(`${from} --> ${to}`);
  }
  return lines.join('\n');
}
