// DiagramMender_plus/frontend/sw.js
self.addEventListener('install', (_e) => {
  self.skipWaiting && self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // 清理舊快取或做遷移；此處最小化不做任何事
    // clients.claim 讓新 SW 立刻接手現有頁面
    await self.clients.claim?.();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting && self.skipWaiting();
  }
});

// 僅作網路優先；若離線回傳基礎 fallback（不做 aggressive cache）
self.addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    try {
      return await fetch(event.request);
    } catch (err) {
      return new Response('離線中；請稍後再試', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
