// DiagramMender_plus/frontend/sw-register.js
const SW_URL = './sw.js';
const SW_VERSION = 'v1.0.0'; // 每次部署升級此字串

async function _register() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register(SW_URL + '?v=' + SW_VERSION, { scope: './' });
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed') location.reload();
      });
    });
  } catch (e) {
    console.warn('SW 註冊失敗，照常運作：', e);
  }
}

// 預設不呼叫 _register()；待穩定後你再開啟
// _register();
