import mermaid from 'mermaid';
import { sanitize } from './sanitize.js';
import { applyFixes } from './autofix.js';
import { applyLayoutSelection } from './layout.js';

mermaid.initialize({ startOnLoad:false, securityLevel:'strict' });

// tolerant selection: try multiple id variants (dash-case and camelCase) to match HTML
function $id(...names) {
  for (const n of names) {
    if (!n) continue;
    const byId = document.getElementById(n);
    if (byId) return byId;
    const byCssId = document.querySelector('#' + n);
    if (byCssId) return byCssId;
    // allow passing selectors directly
    try { const q = document.querySelector(n); if (q) return q; } catch {}
  }
  return null;
}

const editor = $id('editor', 'src');
const errors = $id('errors', 'log');
const preview = $id('preview', 'svg', 'graphDiv');
const themeSel = $id('theme', 'secLevel');
const layoutSel = $id('layout', 'layoutSelect');

if (!editor) console.warn('Editor element not found (tried #editor, #src)');
if (!errors) console.warn('Errors element not found (tried #errors, #log)');
if (!preview) console.warn('Preview element not found (tried #preview, #svg, #graphDiv)');

async function validate(code){
  errors.textContent='';
  try { await mermaid.parse(code); return true; }
  catch(e){ errors.textContent=(e&&e.str)?e.str:String(e); return false; }
}
async function render(){
  // Run autofixes but do NOT forcibly overwrite the editor by default.
  // This keeps render as a preview operation. If you want to persist fixes,
  // call render({ persistFixes: true }) or use the dedicated autofix button.
  const { code: fixedCode, notes } = applyFixes(editor.value);
  // If autofix returned notes, surface them in the errors panel for user feedback.
  if (Array.isArray(notes) && notes.length) {
    errors.textContent = notes.join('\n');
  }
  const codeToRender = (typeof fixedCode === 'string' && fixedCode.length > 0) ? fixedCode : editor.value;

  // Optionally persist fixes back to the editor. Keep default behavior = false to
  // avoid surprising UX where preview mutates user text on every render.
  // If you prefer the old behaviour, call render({ persistFixes: true }) or
  // set persistOnRender = true here.
  const persistOnRender = false;
  if (persistOnRender) editor.value = codeToRender;

  const theme = themeSel.value;
  applyLayoutSelection(mermaid, layoutSel.value);
  mermaid.initialize({ startOnLoad:false, securityLevel:'strict', theme });

  if(!(await validate(codeToRender))){ preview.innerHTML=''; return; }

  // mermaid.render can return either a string (svg) or an object { svg, bindFunctions }
  // depending on mermaid build/version. Handle both safely.
  const renderResult = await mermaid.render('mmd-'+Date.now(), codeToRender);
  const svg = (typeof renderResult === 'string') ? renderResult : (renderResult && renderResult.svg) ? renderResult.svg : String(renderResult);
  preview.innerHTML = sanitize(svg);
}

// tolerant button binding helper
function bindButton(handler, ...ids){
  for (const id of ids) {
    const el = $id(id, id.replace(/-/g, ''), id.replace(/-/g, '').replace(/^(.)/, m => m.toLowerCase()));
    if (el) { el.onclick = handler; return el; }
  }
  return null;
}

bindButton(async ()=>{ await validate(editor && editor.value); }, 'btn-validate', 'btnValidate', 'btnValidate');
bindButton(()=>render(), 'btn-render', 'btnRender', 'btnRender');
bindButton(()=>{ const r = applyFixes(editor && editor.value); if(r && r.code) editor.value = r.code; if(r && r.notes) errors.textContent = (Array.isArray(r.notes)?r.notes.join('\n'):String(r.notes)); }, 'btn-autofix', 'btnAutoFix', 'AutoFix', 'btnAutoFix');

themeSel.addEventListener('change', render);
layoutSel.addEventListener('change', render);

editor.value = `graph TD
  A([ Start: passthrough(payload) ]) --> B["Work"]
  B --> C{{"OK?"}}
  C -->|Yes| D([ End ]) 
  C -->|No| A
`;
