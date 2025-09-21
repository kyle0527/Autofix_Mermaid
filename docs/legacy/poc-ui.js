import mermaid from '/assets/mermaid-11.11.0/mermaid.esm.mjs';
import { analyzeFilesToIR, irToMermaid } from './engine/analyzer.poc.js';

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const btnAutoFix = document.getElementById('btnAutoFix');
  const svgDiv = document.getElementById('svg');

  async function readFiles(fileList) {
    const out = [];
    for (const f of fileList) {
      // only text files for PoC
      try {
        const text = await f.text();
        out.push({ name: f.name, path: f.webkitRelativePath || f.name, content: text });
      } catch (e) {
        // ignore binary
      }
    }
    return out;
  }

  btnAutoFix.addEventListener('click', async () => {
    const files = fileInput.files;
    if (!files || files.length === 0) {
      alert('請先選擇資料夾或檔案（use the folder input）');
      return;
    }
    const fileObjs = await readFiles(files);
    const ir = analyzeFilesToIR(fileObjs);
    const mmd = irToMermaid(ir);
    // render
    try {
      const renderId = 'poc_' + Date.now();
      await mermaid.initialize({ startOnLoad: false });
      const { svg } = await mermaid.render(renderId, mmd);
      svgDiv.innerHTML = svg;
    } catch (e) {
      svgDiv.innerText = 'Render failed: ' + e.message;
    }
  });
});
