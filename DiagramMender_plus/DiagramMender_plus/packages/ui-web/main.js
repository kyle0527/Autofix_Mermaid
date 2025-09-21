// ES6 module entry
import { initApp } from './src/app.js';

// Ensure DOM is ready (ESM executes after parsing but be explicit)
document.addEventListener('DOMContentLoaded', () => {
  initApp().catch(err => {
    console.error('[Init] failed', err);
    const log = document.getElementById('log');
    if (log) log.textContent = '初始化失敗：' + err;
  });
});
