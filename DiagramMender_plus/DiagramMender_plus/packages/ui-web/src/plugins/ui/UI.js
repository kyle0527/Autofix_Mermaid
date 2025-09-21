// UI.js — wire the UI (ESM)
/**
 * @typedef {{
 *   els: {
 *     src: HTMLTextAreaElement,
 *     out: HTMLDivElement,
 *     log: HTMLPreElement,
 *     btn: HTMLButtonElement,
 *     chkDark: HTMLInputElement,
 *   },
 *   mermaid: import('mermaid').Mermaid,
 *   AutoFix: { run(input: string): { code: string, notes: string[] } },
 *   renderMermaid: (code: string, outEl: HTMLElement, mermaid: import('mermaid').Mermaid) => Promise<void>,
 * }} Ctx
 */

/** @param {Ctx} ctx */
import { analyzePythonProject } from '../diagrammender-python/ProjectAnalyzer.js';

export function setupUI(ctx) {
  const { els, mermaid, AutoFix, renderMermaid } = ctx;

  // Sample starter
  els.src.value = [
    'graph TD',
    '  A[Start] --> B{Ready?}',
    '  B -- Yes --> C[Run]',
    '  B -- No --> D[Stop]',
  ].join('\n');

  // Folder upload for analysis -> generate diagrams automatically
  const uploader = document.createElement('input');
  uploader.type = 'file';
  uploader.webkitdirectory = true;
  uploader.multiple = true;
  uploader.style.display = 'none';
  document.body.appendChild(uploader);
  const uploadBtn = document.createElement('button');
  uploadBtn.textContent = '上傳專案資料夾並一鍵生成圖';
  uploadBtn.title = '產出 系統架構圖 + 運作流程圖';
  uploadBtn.style.margin = '8px 12px';
  document.querySelector('header .actions')?.appendChild(uploadBtn);
  uploadBtn.addEventListener('click', () => uploader.click());
  uploader.addEventListener('change', async () => {
    if (!uploader.files || uploader.files.length === 0) return;
    log(['正在分析專案檔案…']);
    try {
      const { arch, flow, stats } = await analyzePythonProject(uploader.files);
      const md = [arch, '', flow].join('\n\n');
      ctx.els.src.value = md;
      log([`✔ 產生完成：${stats.modules} 模組、${stats.edges} 依賴、${stats.entrypoints} entrypoint`]);
      await doRender();
    } catch (err) {
      log(['✖ 分析失敗', String(err && (err.message || err))]);
      uploader.value = '';
    }

  });

  const doRender = async () => {
    const t0 = performance.now();
    const { code, notes } = AutoFix.run(els.src.value);
    try {
      await renderMermaid(code, els.out, mermaid);
      const dt = (performance.now() - t0).toFixed(1);
      log([`✔ 渲染完成 (${dt}ms)`, ...notes]);
    } catch (err) {
      log(['✖ 渲染失敗', String(err && (err.message || err))]);
    }
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark', els.chkDark.checked);
    mermaid.initialize({ theme: els.chkDark.checked ? 'dark' : 'default' });
    doRender();
  };

  // Wire events
  els.btn.addEventListener('click', doRender);
  els.src.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      doRender();
    }
  });
  els.chkDark.addEventListener('change', toggleTheme);

  // Initial render
  doRender();
}

function log(lines) {
  const el = document.getElementById('log');
  if (!el) return;
  el.textContent = lines.join('\n');
}
