// DiagramMender_plus/frontend/error-guard.js
const banner = document.getElementById('errorBanner');
function showErrorBanner(msg) {
  if (!banner) return;
  banner.style.display = 'block';
  banner.innerHTML = `
    <strong>前端執行錯誤：</strong> ${String(msg || '未知錯誤')}
    <span style="margin-left:8px;">
      <a href="#" id="btnReload">重整</a> ·
      <a href="#" id="btnHardReset">清快取並重整</a>
    </span>`;
  document.getElementById('btnReload')?.addEventListener('click', (e) => { e.preventDefault(); location.reload(); });
  document.getElementById('btnHardReset')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch {}
    location.reload();
  });
}

window.addEventListener('error', (ev) => showErrorBanner(ev.message || '未知錯誤'));
window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev?.reason;
  const msg = (reason && (reason.message || reason.toString())) || '未處理的 Promise 錯誤';
  showErrorBanner(msg);
});
