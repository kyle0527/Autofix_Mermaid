"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitClassDiagramFragments = emitClassDiagramFragments;
exports.emitClassDiagram = emitClassDiagram;
const compose_1 = require("./compose");
function buildClassFragment(modName, modPath, cls) {
    const lines = [];
    lines.push(`class ${cls.name} {`);
    for (const a of cls.attrs)
        lines.push(`  +${a}`);
    for (const m of cls.methods)
        lines.push(`  +${m.name}(${m.params.join(', ')})`);
    lines.push('}');
    for (const b of cls.bases)
        lines.push(`${b} <|-- ${cls.name}`);
    return {
        id: cls.id,
        title: cls.name,
        diagram: 'classDiagram',
        code: lines.join('\n'),
        source: { module: modName, path: modPath },
    };
}
function emitClassDiagramFragments(ir) {
    const fragments = [];
    for (const mod of Object.values(ir.modules)) {
        for (const cls of mod.classes) {
            fragments.push(buildClassFragment(mod.name, mod.path, cls));
        }
    }
    if (fragments.length === 0) {
        fragments.push({
            id: 'class-empty',
            title: 'empty',
            diagram: 'classDiagram',
            code: 'class _ { }',
        });
    }
    return fragments;
}
function emitClassDiagram(ir) {
    return (0, compose_1.composeMermaid)('classDiagram', emitClassDiagramFragments(ir));
}
