#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['js/engine','js/ai','engine-src/packages'];

function walk(dir, acc){
  if(!fs.existsSync(dir)) return;
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir,name);
    const st = fs.statSync(p);
    if(st.isDirectory()) walk(p, acc); else if(/\.(js|mjs|cjs|ts)$/.test(name)) acc.push(p);
  }
}
function safeRead(f){ try { return fs.readFileSync(f,'utf-8'); } catch { return ''; } }
const RE_IMPORT = /import\s+(?:[^'";]+?from\s+)?["']([^"']+)["']/g;
const RE_REQUIRE = /require\(\s*["']([^"']+)["']\s*\)/g;
function rel(p){ return p.replace(ROOT+path.sep,'').replace(/\\/g,'/'); }
function classify(id){
  if(id.startsWith('engine-src/packages/')) return 'pkg:' + id.split('/')[2];
  if(id.startsWith('js/engine/')) return 'engine';
  if(id.startsWith('js/ai/')) return 'ai';
  return 'misc';
}
function resolveImport(fromFile, spec){
  if(spec.startsWith('.')){
    const base = path.dirname(fromFile);
    const target = path.resolve(base, spec);
    const exts = ['.js','.mjs','.cjs','.ts'];
    if(fs.existsSync(target) && fs.statSync(target).isDirectory()){
      for(const ix of ['index.js','index.mjs','index.ts']){
        const cand = path.join(target, ix);
        if(fs.existsSync(cand)) return rel(cand);
      }
    }
    for(const ext of exts){ if(fs.existsSync(target+ext)) return rel(target+ext); }
    if(fs.existsSync(target)) return rel(target);
    return null;
  }
  if(spec.startsWith('@diagrammender/')){
    const name = spec.split('/')[1];
    const guess = path.join('engine-src','packages', name.replace(/^emitters-/, 'emitters/').replace(/^parsers-/, 'parsers/').replace(/^fix-rules-/, 'fix-rules/'));
    if(fs.existsSync(guess)) return rel(guess);
  }
  return spec; // external or unresolved
}
function buildGraph(){
  const files = []; for(const d of TARGET_DIRS) walk(path.join(ROOT,d), files);
  const nodes = new Map(); const edges = new Set();
  for(const f of files){
    const r = rel(f); nodes.set(r, classify(r));
    const code = safeRead(f); RE_IMPORT.lastIndex = 0; RE_REQUIRE.lastIndex = 0; let m;
    while((m = RE_IMPORT.exec(code))){ const to = resolveImport(f, m[1]); if(to) edges.add(r + '::' + to); }
    while((m = RE_REQUIRE.exec(code))){ const to = resolveImport(f, m[1]); if(to) edges.add(r + '::' + to); }
  }
  return {nodes, edges: [...edges].map(e=>e.split('::'))};
}
function emitMermaid(g){
  const groups = new Map();
  for(const [id,cat] of g.nodes){ if(!groups.has(cat)) groups.set(cat,[]); groups.get(cat).push(id); }
  const shortId = id => 'N' + Buffer.from(id).toString('base64').replace(/[^a-zA-Z0-9]/g,'');
  let out = 'flowchart LR\n';
  for(const [cat,list] of groups){
    out += `  subgraph ${cat}\n`;
    for(const id of list){ out += `    ${shortId(id)}["${id.replace(/"/g,'&quot;')}"]\n`; }
    out += '  end\n';
  }
  for(const [a,b] of g.edges){ if(!g.nodes.has(a) || !g.nodes.has(b)) continue; out += `  ${shortId(a)} --> ${shortId(b)}\n`; }
  return out;
}
function main(){
  const g = buildGraph();
  const diagram = emitMermaid(g);
  const mdLines = [
    '# Generated Architecture Diagram',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Modules: ${g.nodes.size}  Edges: ${g.edges.length}`,
    '',
    '## Mermaid',
    '',
    '```mermaid',
    diagram,
    '```',
    ''
  ];
  const md = mdLines.join('\n');
  const docsDir = path.join(ROOT,'docs');
  if(fs.existsSync(docsDir)){
    fs.writeFileSync(path.join(docsDir,'architecture.generated.md'), md, 'utf-8');
  }
  console.log(diagram);
}
main();
