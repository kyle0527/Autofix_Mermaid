#!/usr/bin/env node
/**
 * generate-architecture.mjs
 * 掃描專案模組並輸出 Mermaid 架構圖 (flowchart + grouping)。
 * 規則：
 *  - 掃描 js/engine 、 js/ai 、 engine-src/packages/*
 *  - 只解析 import / require / self.EngineCommon 等簡單模式
 *  - 產出：stdout Mermaid 以及 docs/architecture.generated.md (若存在 docs/)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const TARGET_DIRS = [
  'js/engine',
  'js/ai',
  'engine-src/packages'
];

function walk(dir, acc){
  if(!fs.existsSync(dir)) return;
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if(stat.isDirectory()) walk(p, acc);
    else if(/\.(js|mjs|cjs|ts)$/.test(name)) acc.push(p);
  }
}

function readSafe(p){
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

// 簡單正則抓 import / require pattern
const RE_IMPORT = /import\s+(?:[^'";]+?from\s+)?["']([^"']+)["']/g;
const RE_REQUIRE = /require\(\s*["']([^"']+)["']\s*\)/g;

function normalizeModuleId(file){
  // 取相對路徑簡化
  return file.replace(ROOT+path.sep,'').replace(/\\/g,'/');
}

function classifyNode(id){
  if(id.startsWith('engine-src/packages/')){
    const seg = id.split('/');
    return 'pkg:' + (seg[2]||'unknown');
  }
  if(id.startsWith('js/engine/')) return 'engine';
  if(id.startsWith('js/ai/')) return 'ai';
  return 'misc';
}

function resolveImport(fromFile, spec){
  if(spec.startsWith('.') || spec.startsWith('..')){
    const base = path.dirname(fromFile);
    let resolved = path.resolve(base, spec);
    const exts = ['.js','.mjs','.cjs','.ts'];
    if(fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()){
      for(const ix of ['index.js','index.mjs','index.ts']){
        const cand = path.join(resolved, ix);
        if(fs.existsSync(cand)) return normalizeModuleId(cand);
      }
    }
    for(const ext of exts){
      if(fs.existsSync(resolved+ext)) return normalizeModuleId(resolved+ext);
    }
    if(fs.existsSync(resolved)) return normalizeModuleId(resolved);
    return null;
  } else if(spec.startsWith('@diagrammender/')) {
    // map to local package root
    const name = spec.split('/')[1];
    const pkgDir = path.join('engine-src','packages', name.replace(/^emitters-/, 'emitters/').replace(/^parsers-/, 'parsers/').replace(/^fix-rules-/, 'fix-rules/'));
    if(fs.existsSync(pkgDir)) return normalizeModuleId(pkgDir);
    return spec; // fallback literal
  } else {
    return spec; // external
  }
}

function buildGraph(){
  const files = [];
  for(const d of TARGET_DIRS) walk(path.join(ROOT,d), files);
  const edges = new Set();
  const nodes = new Map();
  for(const f of files){
    const rel = normalizeModuleId(f);
    nodes.set(rel, classifyNode(rel));
    const code = readSafe(f);
    RE_IMPORT.lastIndex = 0; RE_REQUIRE.lastIndex=0;
    let m;
    while((m = RE_IMPORT.exec(code))){
      const to = resolveImport(f, m[1]);
      if(to) edges.add(rel + '::' + to);
    }
    while((m = RE_REQUIRE.exec(code))){
      const to = resolveImport(f, m[1]);
      if(to) edges.add(rel + '::' + to);
    }
  }
  return {nodes, edges:[...edges].map(e=>e.split('::'))};
}

function emitMermaid(graph){
  // group by category
  const groups = new Map();
  for(const [id, cat] of graph.nodes){
    if(!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(id);
  }
  let out = 'flowchart LR\n';
  const shortId = id => 'N'+Buffer.from(id).toString('base64').replace(/[^a-zA-Z0-9]/g,'');
  for(const [cat, list] of groups){
    out += `  subgraph ${cat}\n`;
    for(const id of list){
      out += `    ${shortId(id)}["${id.replace(/"/g,'&quot;')}"]\n`;
    }
    out += '  end\n';
  }
  for(const [from,to] of graph.edges){
    if(!graph.nodes.has(from) || !graph.nodes.has(to)) continue;
    out += `  ${shortId(from)} --> ${shortId(to)}\n`;
  }
  return out;
}

function main(){
  const g = buildGraph();
  const mermaid = emitMermaid(g);
  const md = `# Generated Architecture Diagram\n\n**Generated:** ${new Date().toISOString()}  \\nTotal modules: ${g.nodes.size}, edges: ${g.edges.length}\n\n\n\n\n
\n
\n\n\n\n\n\n
\n\n## Mermaid\n\n\n\n
\n
\n\n
\n\n
\n\n\n
\n\n
\n\n\n\n
\n\n
\n\n
\n\n
\n\n\n
\n\n
\n\n
\n\n
\n\n\n
\n\n
\n\n\n
\n\n
\n\n\n\n\n\n
\n
\n
\n
\n\n
\n\n
\n
\n\n\n\n
\n
\n
\n\n\n
\n\n\n\n\n
\n\n\n\n\n
\n\n
\n\n
\n
\n\n\n
\n\n
\n\n
\n
\n\n\n\n\n
\n\n\n\n----\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n\n\n\n\n
\n\n\n\n\n
\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n
\n\n**Diagram:**\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n
\n\n
\n\n\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n\n\n
\n\n\n\n\n\n\n\n\n\n\n
\n\n```mermaid\n${mermaid}\n```\n`;
  const docsDir = path.join(ROOT,'docs');
  if(fs.existsSync(docsDir)){
    fs.writeFileSync(path.join(docsDir,'architecture.generated.md'), md, 'utf-8');
  }
  console.log(mermaid);
}

main();
