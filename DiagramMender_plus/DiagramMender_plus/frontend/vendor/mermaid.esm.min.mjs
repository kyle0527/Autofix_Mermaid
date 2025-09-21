// Minimal offline stub for Mermaid ESM API (initialize + render).
// 目的：在沒有真正 mermaid 庫時，避免前端卡死或報錯；會把原始碼畫進 SVG 文字中。
// 想要真正渲染，請替換成官方 mermaid.esm.min.mjs。

function escapeHTML(s) {
  return String(s).replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}

const api = {
  initialize() { /* no-op for stub */ },
  async render(id, code) {
    const text = escapeHTML(code || '');
    // 建立簡單 SVG，把 mermaid 原始碼顯示出來，確保「可讀、可選取」
    const lines = text.split(/\r?\n/);
    const lineHeight = 18;
    const width = 820;
    const height = Math.max(60, 20 + lines.length * lineHeight);
    const content = lines.map((ln, i) => `<text x="12" y="${20 + (i+1)*lineHeight}" font-family="monospace" font-size="13">${ln}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#fff" stroke="#ddd"/>
  <g>${content}</g>
</svg>`;
    return { svg };
  }
};

export default api;
