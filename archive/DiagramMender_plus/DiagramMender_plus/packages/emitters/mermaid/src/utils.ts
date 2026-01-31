export function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'\\"');
}
export function wrap(s: string, width=28): string {
  const out: string[] = []; let line='';
  for (const ch of s) {
    line += ch;
    if (line.length >= width && (/[\s,;:，。！？、\]\)\}]/.test(ch) || line.length >= width+6)) {
      out.push(line); line='';
    }
  }
  if (line) out.push(line);
  return out.join('\n');
}
export function trunc(s: string, max=240): string {
  return s.length <= max ? s : s.slice(0, max-10) + '...(truncated)';
}
export function sid(prefix: string, key: string): string {
  let h = 2166136261 >>> 0;
  for (let i=0;i<key.length;i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${prefix}_${(h>>>0).toString(16)}`;
}
