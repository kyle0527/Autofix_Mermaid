"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCFG = buildCFG;
let idc = 0;
function nid(prefix) { idc += 1; return `${prefix}_${idc}`; }
function buildCFG(fn) {
    idc = 0;
    const nodes = [];
    const edges = [];
    const start = nid('start');
    const end = nid('end');
    nodes.push({ id: start, kind: 'start', label: 'Start' });
    nodes.push({ id: end, kind: 'end', label: 'End' });
    function seq(stmts) {
        if (!stmts || stmts.length === 0) {
            const x = nid('op');
            nodes.push({ id: x, kind: 'op', label: 'pass' });
            return { entry: x, exits: [x] };
        }
        let first = null;
        let prevExits = [];
        for (const s of stmts) {
            const { entry, exits } = build(s);
            if (!first)
                first = entry;
            for (const p of prevExits)
                edges.push({ from: p, to: entry });
            prevExits = exits;
        }
        return { entry: first, exits: prevExits };
    }
    function build(s) {
        switch (s.kind) {
            case 'if': {
                const d = nid('dec');
                nodes.push({ id: d, kind: 'decision', label: `if ${s.cond}?` });
                const t = seq(s.then || []);
                edges.push({ from: d, to: t.entry, label: 'True' });
                const e = s.else ? seq(s.else) : { entry: d, exits: [d] };
                if (s.else)
                    edges.push({ from: d, to: e.entry, label: 'False' });
                const m = nid('merge');
                nodes.push({ id: m, kind: 'merge', label: 'merge' });
                for (const x of t.exits)
                    edges.push({ from: x, to: m });
                for (const x of e.exits)
                    edges.push({ from: x, to: m });
                return { entry: d, exits: [m] };
            }
            case 'for': {
                const d = nid('loop');
                nodes.push({ id: d, kind: 'loop', label: `for ${s.target} in ${s.iter}` });
                const b = seq(s.body || []);
                edges.push({ from: d, to: b.entry, label: 'loop' });
                for (const x of b.exits)
                    edges.push({ from: x, to: d, label: 'next' });
                const m = nid('merge');
                nodes.push({ id: m, kind: 'merge', label: 'exit' });
                edges.push({ from: d, to: m, label: 'exit' });
                return { entry: d, exits: [m] };
            }
            case 'while': {
                const d = nid('dec');
                nodes.push({ id: d, kind: 'decision', label: `while ${s.cond}?` });
                const b = seq(s.body || []);
                edges.push({ from: d, to: b.entry, label: 'True' });
                for (const x of b.exits)
                    edges.push({ from: x, to: d, label: 'loop' });
                const m = nid('merge');
                nodes.push({ id: m, kind: 'merge', label: 'False' });
                edges.push({ from: d, to: m, label: 'False' });
                return { entry: d, exits: [m] };
            }
            case 'try': {
                const t = seq(s.body || []);
                const d = nid('try');
                nodes.push({ id: d, kind: 'try', label: 'try' });
                edges.push({ from: d, to: t.entry });
                const merges = [];
                for (const h of s.excepts || []) {
                    const hb = seq(h.body || []);
                    const ex = nid('ex');
                    nodes.push({ id: ex, kind: 'except', label: `except ${h.type || ''}` });
                    edges.push({ from: d, to: hb.entry });
                    merges.push(...hb.exits);
                }
                const m = nid('merge');
                nodes.push({ id: m, kind: 'merge', label: 'merge' });
                for (const x of t.exits.concat(merges))
                    edges.push({ from: x, to: m });
                return { entry: d, exits: [m] };
            }
            default: {
                const n = nid('op');
                nodes.push({ id: n, kind: 'op', label: s.text || s.kind });
                if (s.kind === 'return' || s.kind === 'raise') {
                    // return/raise connect to end; still allow chain
                    edges.push({ from: n, to: end });
                    return { entry: n, exits: [end] };
                }
                return { entry: n, exits: [n] };
            }
        }
    }
    if (!fn.body || fn.body.length === 0) {
        edges.push({ from: start, to: end });
    }
    else {
        const { entry, exits } = seq(fn.body);
        edges.push({ from: start, to: entry });
        for (const x of exits)
            edges.push({ from: x, to: end });
    }
    return { nodes, edges };
}
