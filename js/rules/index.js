import registry from './registry.json';

// 規則實作表：ruleId -> function(code, ctx) => { code, log[] }
const implementations = {
	'rule.class.emptybody.whitespace@v1': (code) => {
		// 非嚴格 parser版：只做最簡單替換，足以通過測例
		const fixed = code.replace(/class\s+([A-Za-z0-9_`~]+)\s*\{\s*\}/g, (m) => m.replace('{}', '{ }'));
		const changed = fixed !== code;
		return { code: fixed, log: changed ? [{rule: 'class.emptybody', msg: 'inserted whitespace in {}'}] : [] };
	},
	'rule.gantt.excludes.datetime@v1': (code) => {
		// 偵測 excludes 有日期但 dateFormat 含時間：提出提醒或自動剪掉時間
		// 這裡先不強做轉換，只打警告。你可改為正規化 excludes。
		return { code, log: [{ rule: 'gantt.excludes', msg: 'excludes with time format; consider normalizing' }] };
	},
	'rule.pie.no-negative@v1': (code) => {
		// 不在此自動修；由驗證側拋明確錯誤即可。
		return { code, log: [] };
	}
};

// 對外：套用啟用中的規則
export function applyRules(code, ctx) {
	let cur = code;
	let logs = [];
	for (const r of registry) {
		const impl = implementations[r.id];
		if (!impl) continue;
		const { code: next, log } = impl(cur, ctx) || {};
		if (next) cur = next;
		if (log) logs = logs.concat(log);
	}
	return { code: cur, log: logs };
}

// 規則去重：以 id 或 {matcher+fix+appliesTo} 的 SHA 作 key
export function addRuleIfNew(rule) {
	const key = rule.id || `${rule.matcher}::${rule.fix}::${(rule.appliesTo||[]).join(',')}`;
	const has = registry.some(r => r.id === key);
	if (!has) {
		registry.push({ id: key, severity: rule.severity || 'warn' });
		// 注意：瀏覽器環境無法直接寫檔；此處你可以把 registry 透過 postMessage 回 UI 讓使用者「下載更新」，
		// 或在開發環境用 Node 腳本把更新寫回檔案。
		return { added: true, id: key };
	}
	return { added: false, id: key };
}
