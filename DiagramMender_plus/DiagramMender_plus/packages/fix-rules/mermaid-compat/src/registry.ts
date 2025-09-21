import { FixRule } from './types';
const rules: FixRule[] = [];
export function register(rule: FixRule) { rules.push(rule); }
export function list() { return rules.sort((a,b)=>a.priority-b.priority); }
