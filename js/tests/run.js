// 題庫執行器
export async function runAllIssueCases(worker, fileUrls) {
	// 讀入多個 JSON 題檔
	const testDocs = [];
	for (const url of fileUrls) {
		const txt = await (await fetch(url)).text();
		testDocs.push(JSON.parse(txt));
	}
	return new Promise((resolve) => {
	const _results = [];
		const onMsg = (e) => {
			const { type, results: r, rule } = e.data || {};
			// mark results used to silence lint when this runner is adapted
			void r;
			if (type === 'issueCasesDone') {
				worker.removeEventListener('message', onMsg);
				resolve(r);
			}
			if (type === 'suggestRule' && rule) {
				// 這裡可直接呼叫規則庫寫入 API（§5），或先暫存到 UI 顯示
				console.info('Rule suggestion:', rule);
			}
		};
		worker.addEventListener('message', onMsg);
		worker.postMessage({ type: 'runIssueCases', payload: { testDocs, opts: {} } });
	});
}
