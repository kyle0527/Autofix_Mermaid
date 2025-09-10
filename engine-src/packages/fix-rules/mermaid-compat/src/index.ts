import { FixContext, FixResult } from './types';
import { register, list } from './registry';
import { EnsureHeader } from './rules/01.ensureHeader';
import { GraphToFlowchart } from './rules/02.graphToFlowchart';
import { NormalizeArrows } from './rules/03.normalizeArrows';
import { EscapeLabels } from './rules/04.escapeLabels';
import { UniqueIds } from './rules/05.uniqueIds';
import { EnsureParticipants } from './rules/06.ensureParticipants';

register(EnsureHeader);
register(GraphToFlowchart);
register(NormalizeArrows);
register(EscapeLabels);
register(UniqueIds);
register(EnsureParticipants);

export function applyAll(code: string, ctx: FixContext): FixResult {
  const notes: string[] = []; let cur = code;
  for (const r of list()) { const res = r.run(cur, ctx); cur = res.code; if (res.notes.length) notes.push(...res.notes.map(n => `${r.name}: ${n}`)); }
  return { code: cur, notes };
}
export type { FixContext, FixResult } from './types';
