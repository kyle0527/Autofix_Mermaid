"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnsureParticipants = void 0;
exports.EnsureParticipants = {
    name: 'EnsureParticipants', priority: 60,
    run(code, ctx) {
        if (ctx.diagram !== 'sequenceDiagram')
            return { code, notes: [] };
        // ensure every arrow has both sides declared as participants (Mermaid v11 stricter)
        const lines = code.split(/\r?\n/);
        const participants = new Set();
        for (const ln of lines) {
            const pm = /^\s*participant\s+([A-Za-z0-9_]+)\b/.exec(ln);
            if (pm)
                participants.add(pm[1]);
        }
        let changed = false;
        const arrows = Array.from(code.matchAll(/([A-Za-z0-9_]+)->>?([A-Za-z0-9_]+)/g));
        const need = [];
        for (const m of arrows) {
            const a = m[1], b = m[2];
            if (!participants.has(a)) {
                need.push(`participant ${a}`);
                participants.add(a);
                changed = true;
            }
            if (!participants.has(b)) {
                need.push(`participant ${b}`);
                participants.add(b);
                changed = true;
            }
        }
        if (!changed)
            return { code, notes: [] };
        // insert participants after header
        const out = [];
        let inserted = false;
        for (const ln of lines) {
            out.push(ln);
            if (!inserted && /^\s*sequenceDiagram\b/.test(ln)) {
                for (const n of need)
                    out.push(n);
                inserted = true;
            }
        }
        return { code: out.join('\n'), notes: [`Inserted ${need.length} missing participants`] };
    }
};
