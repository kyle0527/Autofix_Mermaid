
import mermaid from 'mermaid';
import { sanitize } from './sanitize.js';
import { applyFixes } from './autofix.js';
import { applyLayoutSelection } from './layout.js';

mermaid.initialize({ startOnLoad:false, securityLevel:'strict' });

const $=(q)=>document.querySelector(q);
const editor=$('#editor'), errors=$('#errors'), preview=$('#preview'), themeSel=$('#theme'), layoutSel=$('#layout');

async function validate(code){
  errors.textContent='';
  try { await mermaid.parse(code); return true; }
  catch(e){ errors.textContent=(e&&e.str)?e.str:String(e); return false; }
}
async function render(){
  let { code, notes } = applyFixes(editor.value);
  editor.value = code; // keep in sync
  const theme = themeSel.value;
  applyLayoutSelection(mermaid, layoutSel.value);
  mermaid.initialize({ startOnLoad:false, securityLevel:'strict', theme });
  if(!(await validate(code))){ preview.innerHTML=''; return; }
  const { svg } = await mermaid.render('mmd-'+Date.now(), code);
  preview.innerHTML = sanitize(svg);
}

document.getElementById('btn-validate').onclick = async ()=>{ await validate(editor.value); };
document.getElementById('btn-render').onclick = render;
document.getElementById('btn-autofix').onclick = ()=>{ const r = applyFixes(editor.value); editor.value = r.code; errors.textContent = r.notes.join('\n'); };

themeSel.addEventListener('change', render);
layoutSel.addEventListener('change', render);

editor.value = `graph TD
  A([ Start: passthrough(payload) ]) --> B["Work"]
  B --> C{{"OK?"}}
  C -->|Yes| D([ End ]) 
  C -->|No| A
`;
