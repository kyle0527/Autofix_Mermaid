import { estimateFlowchartComplexity } from './complexity-lite.js';

const DEFAULT_RULES = [
  'legacy-syntax-upgrade',
  'flow-direction',
  'id-normalize',
  'diagram-kind-infer',
  'dangling-node-prune',
  'label-truncate'
];

const LS_KEY = 'autofix_mermaid_complexity_v1';
let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return { limits:{maxNodes:60,maxEdges:100,maxDepth:6}, enabledRules:[...DEFAULT_RULES], debug:false };
    const parsed = JSON.parse(raw);
    return {
      limits: parsed.limits && typeof parsed.limits==='object' ? {
        maxNodes: parsed.limits.maxNodes||60,
        maxEdges: parsed.limits.maxEdges||100,
        maxDepth: parsed.limits.maxDepth||6
      } : {maxNodes:60,maxEdges:100,maxDepth:6},
      enabledRules: Array.isArray(parsed.enabledRules) && parsed.enabledRules.length ? parsed.enabledRules.filter(r=>DEFAULT_RULES.includes(r)) : [...DEFAULT_RULES],
      debug: !!parsed.debug
    };
  }catch{
    return { limits:{maxNodes:60,maxEdges:100,maxDepth:6}, enabledRules:[...DEFAULT_RULES], debug:false };
  }
}

function persist(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch{}
}

function $(id){ return document.getElementById(id); }

function renderRules(){
  const host = $('rulesList');
  if(!host) return;
  host.innerHTML = '';
  state.enabledRules = state.enabledRules.filter(r => DEFAULT_RULES.includes(r));
  DEFAULT_RULES.forEach(rule => {
    const id = 'rule_' + rule;
    const wrap = document.createElement('label');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '4px';
    wrap.style.fontSize = '12px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = state.enabledRules.includes(rule);
    cb.addEventListener('change', () => {
      if(cb.checked){ if(!state.enabledRules.includes(rule)) state.enabledRules.push(rule); }
      else { state.enabledRules = state.enabledRules.filter(r => r!==rule); }
      broadcast();
    });
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(rule));
    host.appendChild(wrap);
  });
}

function readLimits(){
  const nn = parseInt($('limitNodes')?.value||'60',10)||60;
  const ee = parseInt($('limitEdges')?.value||'100',10)||100;
  const dd = parseInt($('limitDepth')?.value||'6',10)||6;
  state.limits = { maxNodes:nn, maxEdges:ee, maxDepth:dd };
}

function broadcast(extra={}){
  const detail = { ...state, ...extra };
  document.dispatchEvent(new CustomEvent('ui-config-changed',{ detail }));
  persist();
  if(state.debug) console.debug('[ui-config]', detail);
}

function updateComplexityDisplay(summary){
  const box = $('complexityStatus');
  if(!box) return;
  if(!summary){ box.textContent='(尚未分析)'; return; }
  const { nodes, edges, depth, fanoutP95, exceed, reasons, parts } = summary;
  let lines = [];
  lines.push(`nodes: ${nodes} edges: ${edges} depth: ${depth} fanoutP95: ${fanoutP95}`);
  if(exceed){ lines.push('EXCEED: ' + reasons.join(',')); }
  if(parts){ lines.push('parts: ' + parts.map(p=>`${p.id}(${p.nodes})`).join(', ')); }
  box.textContent = lines.join('\n');
  box.classList.toggle('muted', false);
}

function reAnalyzeFromCurrentEditor(){
  const src = $('src')?.value || '';
  if(!src.trim()) { updateComplexityDisplay(null); return; }
  // quick estimate only for flowchart now
  const summary = estimateFlowchartComplexity(src);
  summary.exceed = (summary.nodes > state.limits.maxNodes) || (summary.edges > state.limits.maxEdges) || (summary.depth > state.limits.maxDepth);
  if(summary.exceed){
    summary.reasons = [];
    if(summary.nodes > state.limits.maxNodes) summary.reasons.push('nodes>'+state.limits.maxNodes);
    if(summary.edges > state.limits.maxEdges) summary.reasons.push('edges>'+state.limits.maxEdges);
    if(summary.depth > state.limits.maxDepth) summary.reasons.push('depth>'+state.limits.maxDepth);
  }
  updateComplexityDisplay(summary);
  broadcast({ lastComplexity: summary });
}

export function initComplexityPanel(){
  // hydrate inputs from state
  if($("limitNodes")) $("limitNodes").value = state.limits.maxNodes;
  if($("limitEdges")) $("limitEdges").value = state.limits.maxEdges;
  if($("limitDepth")) $("limitDepth").value = state.limits.maxDepth;
  if($("debugMode")) $("debugMode").checked = state.debug;
  renderRules();
  // buttons
  $('btnRulesAll')?.addEventListener('click', ()=>{ state.enabledRules=[...DEFAULT_RULES]; renderRules(); broadcast(); });
  $('btnRulesNone')?.addEventListener('click', ()=>{ state.enabledRules=[]; renderRules(); broadcast(); });
  $('btnReAnalyze')?.addEventListener('click', ()=>{ readLimits(); reAnalyzeFromCurrentEditor(); });
  $('debugMode')?.addEventListener('change', (e)=>{ state.debug = e.target.checked; broadcast(); });
  // limits change (debounce simple)
  ['limitNodes','limitEdges','limitDepth'].forEach(id=>{
    $(id)?.addEventListener('input', ()=>{ readLimits(); });
  });
  // initial broadcast
  broadcast();
}

// auto init
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initComplexityPanel);
}else{
  initComplexityPanel();
}

// external API for UI.js to push new complexity after worker result
window.__updateComplexityFromWorker = updateComplexityDisplay;
