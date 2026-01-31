"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyAll = applyAll;
const registry_1 = require("./registry");
const _01_ensureHeader_1 = require("./rules/01.ensureHeader");
const _02_graphToFlowchart_1 = require("./rules/02.graphToFlowchart");
const _03_normalizeArrows_1 = require("./rules/03.normalizeArrows");
const _04_escapeLabels_1 = require("./rules/04.escapeLabels");
const _05_uniqueIds_1 = require("./rules/05.uniqueIds");
const _06_ensureParticipants_1 = require("./rules/06.ensureParticipants");
(0, registry_1.register)(_01_ensureHeader_1.EnsureHeader);
(0, registry_1.register)(_02_graphToFlowchart_1.GraphToFlowchart);
(0, registry_1.register)(_03_normalizeArrows_1.NormalizeArrows);
(0, registry_1.register)(_04_escapeLabels_1.EscapeLabels);
(0, registry_1.register)(_05_uniqueIds_1.UniqueIds);
(0, registry_1.register)(_06_ensureParticipants_1.EnsureParticipants);
function applyAll(code, ctx) {
    const notes = [];
    let cur = code;
    for (const r of (0, registry_1.list)()) {
        const res = r.run(cur, ctx);
        cur = res.code;
        if (res.notes.length)
            notes.push(...res.notes.map(n => `${r.name}: ${n}`));
    }
    return { code: cur, notes };
}
