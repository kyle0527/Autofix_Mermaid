
export async function loadDocList() {
  // The docs are local files under ./docs/
  const files = [
    'guides/USER_MANUAL.md',
    'guides/plantuml-offline.md',
    'diagrams/flowchart.md',
    'diagrams/sequenceDiagram.md',
    'diagrams/stateDiagram.md',
    'diagrams/classDiagram.md',
    'diagrams/erDiagram.md',
    'diagrams/gantt.md',
    'diagrams/architecture.md',
    'diagrams/c4.md',
    'diagrams/timeline.md',
    'diagrams/treemap.md',
    'diagrams/xychart.md',
    'diagrams/mindmap.md',
    'diagrams/pie.md',
    'diagrams/user-journey.md',
    'diagrams/quadrantChart.md'
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
