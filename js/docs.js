
export async function loadDocList() {
  // The docs are local files under ./docs/
  const files = [
    'flowchart.md','sequenceDiagram.md','stateDiagram.md','classDiagram.md','erDiagram.md','gantt.md',
    'architecture.md','c4.md','timeline.md','treemap.md','xychart.md','mindmap.md','pie.md','user-journey.md','quadrantChart.md'
  ];
  return files;
}
export async function loadDocInto(el, path) {
  try {
    const txt = await (await fetch('./docs/' + path)).text();
    const esc = (s)=>s.replace(/[&<>]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
    const lines = txt.split(/\r?\n/);
    let html = ''; let inCode=false;
    for (const ln of lines) {
      if (ln.startsWith('```')) { inCode=!inCode; html+= inCode? '<pre>':'</pre>'; continue; }
      if (inCode) { html += esc(ln) + '\n'; continue; }
      const m = /^(#{1,3})\s+(.*)$/.exec(ln);
      if (m) { const lvl = m[1].length; html += `<h${lvl}>${esc(m[2])}</h${lvl}>`; continue; }
      if (ln.trim()==='') { html += '<br/>'; continue; }
      html += `<p>${esc(ln)}</p>`;
    }
    el.innerHTML = html;
  } catch (e) {
    el.textContent = 'Failed to load doc: ' + path + ' — ' + e;
  }
}
