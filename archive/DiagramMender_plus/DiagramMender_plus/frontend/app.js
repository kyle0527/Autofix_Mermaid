// DiagramMender_plus/frontend/app.js
const idle = (cb) => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 0));
const decodeB64 = (s) => { try { return atob(s); } catch { return ''; } };

const _$ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function showCodeBlocks() {
  const blocks = $$('[data-mermaid]');
  blocks.forEach(b => { if (b.tagName.toLowerCase() !== 'pre') return; b.style.display = 'block'; });
}

async function renderAll() {
  const blocks = $$('[data-mermaid]');
  if (blocks.length === 0) return;

  let mermaid;
  try {
    // 內建 vendor 的極小替代版（可離線），你可替換為官方 mermaid.esm.min.mjs
    mermaid = await import(/* @vite-ignore */ './vendor/mermaid.esm.min.mjs');
    // mermaid 11+：default 具 initialize/render
    mermaid.default.initialize?.({ startOnLoad: false, securityLevel: 'strict' });
  } catch (e) {
    console.warn('Mermaid 載入失敗：保持降級顯示', e);
    return; // 不阻塞首屏
  }

  for (const el of blocks) {
    idle(async () => {
      try {
        const isPre = el.tagName.toLowerCase() === 'pre';
        const b64 = el.getAttribute('data-code-b64');
        const code = b64 ? decodeB64(b64) : (isPre ? el.textContent : el.getAttribute('data-code')) || '';
        if (!code.trim()) return;

        const container = document.createElement('div');
        container.className = 'diagram-svg';
        el.replaceWith(container);

        const id = 'mmd-' + Math.random().toString(36).slice(2);
        const { svg } = await mermaid.default.render(id, code);
        container.innerHTML = svg;
      } catch (err) {
        console.error('渲染失敗：保留原始碼降級', err);
      }
    });
  }
}

document.getElementById('btnRender')?.addEventListener('click', renderAll);
document.getElementById('btnShowCode')?.addEventListener('click', showCodeBlocks);

// 延遲首屏：1.2s 後再嘗試渲染（避免阻塞首次繪製）
setTimeout(renderAll, 1200);
