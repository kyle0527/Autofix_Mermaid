#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runPipeline } from '@diagrammender/core';
import type { DiagramKind } from '@diagrammender/types';

function walk(dir: string, acc: Record<string,string>) {
  const IGNORES = new Set(['.venv','venv','__pycache__','site-packages','dist','build','node_modules']);
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (IGNORES.has(name)) continue;
      walk(p, acc);
    } else {
      if (p.endsWith('.py')) {
        try { acc[path.relative(process.cwd(), p)] = fs.readFileSync(p, 'utf-8'); } catch {}
      }
    }
  }
}

function usageAndExit() {
  console.error(`Usage: diagrammender emit -i <path> --lang python --diagram <flowchart|classDiagram|sequenceDiagram> --format <mmd|html> --out <file-or-dir>`);
  process.exit(2);
}

function wrapHTML(mermaidCode: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>DiagramMender Preview</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>body{font-family:system-ui,Segoe UI,Arial;margin:0;padding:16px}</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>mermaid.initialize({startOnLoad:true,securityLevel:'strict'});</script>
</head><body><div class="mermaid">` + mermaidCode.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + `</div></body></html>`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== 'emit') usageAndExit();

  const i = args.indexOf('-i'); const li = args.indexOf('--lang');
  const di = args.indexOf('--diagram'); const fi = args.indexOf('--format'); const oi = args.indexOf('--out');
  if (i < 0 || li < 0 || di < 0 || fi < 0 || oi < 0) usageAndExit();

  const input = args[i+1]; const lang = args[li+1] as 'python';
  const diagram = args[di+1] as DiagramKind;
  const fmt = (args[fi+1] || 'mmd') as 'mmd'|'html';
  const out = args[oi+1];

  const files: Record<string,string> = {};
  const st = fs.statSync(input);
  if (st.isDirectory()) walk(input, files);
  else {
    if (!input.endsWith('.py')) { console.error('Only .py supported in this MVP'); process.exit(1); }
    files[path.basename(input)] = fs.readFileSync(input, 'utf-8');
  }

  const { code, notes } = await runPipeline(files, { lang, diagram, mermaidVersion: 'v11' });

  let outPath = out;
  if (fs.existsSync(out) && fs.statSync(out).isDirectory()) {
    const base = diagram + (fmt === 'mmd' ? '.mmd' : '.html');
    outPath = path.join(out, base);
  }

  if (fmt === 'mmd') fs.writeFileSync(outPath, code, 'utf-8');
  else fs.writeFileSync(outPath, wrapHTML(code), 'utf-8');

  if (notes.length) console.error('Notes:\n' + notes.map(n=>' - '+n).join('\n'));
  console.error('Saved:', outPath);
}

main().catch(e => { console.error(String(e?.stack || e)); process.exit(1); });
