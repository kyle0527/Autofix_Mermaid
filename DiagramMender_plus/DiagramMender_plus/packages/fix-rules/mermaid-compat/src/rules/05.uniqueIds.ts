import { FixRule } from '../types';
export const UniqueIds: FixRule = {
  name: 'UniqueIds', priority: 50,
  run(code, ctx) {
    const lines = code.split(/\r?\n/);
    const seen: Record<string, number> = {}; const notes: string[] = [];
    for (let i=0;i<lines.length;i++) {
      const m = /^(\w+)\s*(\(|\[|\{)/.exec(lines[i]);
      if (!m) continue;
      const id = m[1];
      seen[id] = (seen[id] ?? 0) + 1;
      if (seen[id] > 1) {
        const newId = `${id}__${seen[id]}`;
        lines[i] = lines[i].replace(id, newId);
        notes.push(`Renamed duplicate id ${id} -> ${newId}`);
      }
    }
    return { code: lines.join('\n'), notes };
  }
};
