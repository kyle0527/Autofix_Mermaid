const rules = [];
export function register(rule) { rules.push(rule); }
export function list() { return rules.sort((a, b) => a.priority - b.priority); }
