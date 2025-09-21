"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esc = esc;
exports.wrap = wrap;
exports.trunc = trunc;
exports.sid = sid;
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '\\"');
}
function wrap(s, width = 28) {
    const out = [];
    let line = '';
    for (const ch of s) {
        line += ch;
        if (line.length >= width && (/[\s,;:，。！？、\]\)\}]/.test(ch) || line.length >= width + 6)) {
            out.push(line);
            line = '';
        }
    }
    if (line)
        out.push(line);
    return out.join('\n');
}
function trunc(s, max = 240) {
    return s.length <= max ? s : s.slice(0, max - 10) + '...(truncated)';
}
function sid(prefix, key) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return `${prefix}_${(h >>> 0).toString(16)}`;
}
