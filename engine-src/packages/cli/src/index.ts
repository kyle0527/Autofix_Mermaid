#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runPipeline } from '@diagrammender/core';
import type { DiagramKind } from '@diagrammender/types';

const IGNORES = new Set(['.venv','venv','__pycache__','site-packages','dist','build','node_modules']);
const SUPPORTED_EXTS = new Set([
  '.py','.pyi','.js','.jsx','.ts','.tsx','.mjs','.cjs','.java','.go','.cs','.rb','.php','.rs','.c','.cc','.cpp','.cxx','.hh','.hpp','.m','.swift'
]);

function sanitizeFragmentName(id: string): string {
  const normalized = id.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return (normalized || 'fragment').slice(0, 80);
}

function walk(dir: string, acc: Record<string,string>) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (IGNORES.has(name)) continue;
      walk(p, acc);
    } else {
      const ext = path.extname(p).toLowerCase();
      if (!SUPPORTED_EXTS.has(ext)) continue;
      try {
        acc[path.relative(process.cwd(), p)] = fs.readFileSync(p, 'utf-8');
      } catch {}
    }
  }
}

function usageAndExit() {
  console.error(`Usage: diagrammender emit -i <path> [--lang <language|auto>] --diagram <flowchart|classDiagram|sequenceDiagram> [--format <mmd|html>] --out <file-or-dir> [--debug] [--fragments-dir <dir>]`);
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
  const dbg = args.indexOf('--debug');
  const fragmentsIdx = args.indexOf('--fragments-dir');
  if (i < 0 || di < 0 || oi < 0) usageAndExit();

  const input = args[i+1];
  const lang = li >= 0 ? args[li+1] : 'auto';
  const diagram = args[di+1] as DiagramKind;
  const fmt = (fi >= 0 ? args[fi+1] : undefined) as 'mmd'|'html'|undefined;
  const out = args[oi+1];
  const debug = dbg >= 0;
  const fragmentsDir = fragmentsIdx >= 0 ? args[fragmentsIdx + 1] : undefined;
  if (!input || !diagram || !out) usageAndExit();
  if (li >= 0 && !lang) usageAndExit();
  if (fi >= 0 && !fmt) usageAndExit();
  if (fragmentsIdx >= 0 && !fragmentsDir) usageAndExit();

  const format = fmt ?? 'mmd';
  if (format !== 'mmd' && format !== 'html') usageAndExit();

  const files: Record<string,string> = {};
  const st = fs.statSync(input);
  if (st.isDirectory()) walk(input, files);
  else {
    const ext = path.extname(input).toLowerCase();
    if (!ext) { console.error('Input file must have an extension'); process.exit(1); }
    files[path.basename(input)] = fs.readFileSync(input, 'utf-8');
  }

  if (Object.keys(files).length === 0) {
    console.error('No supported source files found under the provided input path.');
    process.exit(1);
  }

  const pipelineResult = await runPipeline(files, {
    lang,
    diagram,
    mermaidVersion: 'v11',
  });
  const { code, notes, detection, plugin, fragments, rawCode, links, trace } = pipelineResult;

  let outPath = out;
  if (fs.existsSync(out) && fs.statSync(out).isDirectory()) {
    const base = diagram + (format === 'mmd' ? '.mmd' : '.html');
    outPath = path.join(out, base);
  }

  if (format === 'mmd') fs.writeFileSync(outPath, code, 'utf-8');
  else fs.writeFileSync(outPath, wrapHTML(code), 'utf-8');

  if (fragmentsDir) {
    fs.mkdirSync(fragmentsDir, { recursive: true });
    const manifestPath = path.join(fragmentsDir, 'manifest.json');
    const manifest: {
      diagram: DiagramKind;
      fragments: Array<Record<string, unknown>>;
      links: typeof links;
    } = { diagram, fragments: [], links };
    fragments.forEach((fragment, idx) => {
      const safe = sanitizeFragmentName(fragment.id || `fragment_${idx + 1}`);
      const fileName = `${String(idx + 1).padStart(2, '0')}_${safe}.mmd`;
      fs.writeFileSync(path.join(fragmentsDir, fileName), fragment.code + '\n', 'utf-8');
      manifest.fragments.push({
        index: idx,
        id: fragment.id,
        title: fragment.title,
        file: fileName,
        source: fragment.source,
        anchors: fragment.anchors,
        length: fragment.code.length,
      });
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.error(`Fragments directory: ${fragmentsDir}`);
    console.error(`Fragment manifest: ${manifestPath}`);
  }

  console.error(`Parser plugin: ${plugin.lang}@${plugin.version}`);
  if (detection) {
    const reason = detection.reason ? ` (${detection.reason})` : '';
    console.error(`Detected language: ${detection.lang} [${detection.confidence}]${reason}`);
    if (detection.matchedFiles?.length) {
      console.error(`Matched files: ${detection.matchedFiles.join(', ')}`);
    }
  } else if (lang !== 'auto') {
    console.error(`Language specified explicitly: ${lang}`);
  } else {
    console.error('Language detection disabled or inconclusive; defaulting to explicit plugin.');
  }

  if (debug) {
    if (plugin.capabilities) {
      const enabledCaps = Object.entries(plugin.capabilities)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key);
      if (enabledCaps.length) {
        console.error(`Plugin capabilities: ${enabledCaps.join(', ')}`);
      }
    }
    if (trace?.length) {
      console.error('Pipeline trace:');
      for (const entry of trace) {
        const detail = entry.details ? ` - ${entry.details}` : '';
        console.error(`  ${entry.stage.padEnd(7)} ${entry.durationMs.toString().padStart(4)}ms${detail}`);
      }
    }
    console.error(`Fragments generated: ${fragments.length} (raw ${rawCode.length} chars before fixes)`);
    if (links?.length) {
      console.error(`Fragment links: ${links.length}`);
    }
  }

  if (notes.length) console.error('Notes:\n' + notes.map(n=>' - '+n).join('\n'));
  console.error('Saved diagram:', outPath);
}

main().catch(e => { console.error(String(e?.stack || e)); process.exit(1); });
