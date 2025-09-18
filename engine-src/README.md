# DiagramMender — Goal Architecture (TypeScript Monorepo)

This repository implements the agreed architecture **without relying on `py2mermaid.py`**:

- **Parser (Python)** — Node runtime: uses **tree-sitter** when available; falls back to a regex-based parser to stay runnable.
- **Analyzers** — **CFG** (control-flow graph) and **CallGraph**.
- **Emitters (Mermaid)** — `flowchart`, `classDiagram`, `sequenceDiagram`, powered by the analyses.
- **Fix Rules** — Mermaid compat fixes + `EnsureParticipants` for sequence diagrams; returns **notes**.
- **Core Pipeline** — `runPipeline(files, {lang, diagram})` orchestrating parse → analyze → emit → fix while surfacing raw Mermaid, fragments, and a stage trace for debugging/composition.
- **Renderer (web)** — strict-mode Mermaid wrapper (for UI integration later).
- **CLI** — `diagrammender emit ... --format mmd|html [--debug] [--fragments-dir <dir>]`

> Parser is structured to **switch to web-tree-sitter** for browser workers with minimal changes.

## Quick Start
```bash
npm i
npm run build

# emit Mermaid for the sample
node packages/cli/dist/index.js emit -i samples/python-demo --lang python --diagram flowchart --format mmd  --out out/flow.mmd
node packages/cli/dist/index.js emit -i samples/python-demo --lang python --diagram sequenceDiagram --format mmd --out out/seq.mmd
node packages/cli/dist/index.js emit -i samples/python-demo --lang python --diagram classDiagram   --format mmd --out out/class.mmd

# HTML preview
node packages/cli/dist/index.js emit -i samples/python-demo --lang python --diagram flowchart --format html --out out/flow.html
```

### Debugging & Composition

- Use `--debug` with the CLI to print parser capabilities plus a stage-by-stage trace (`detect`, `parse`, `analyze`, `emit`, `fix`) with timing data.
- Use `--fragments-dir <dir>` to export each Mermaid fragment and a `manifest.json` (including IDs, titles, source metadata, anchor nodes, and cross-fragment links) so you can recombine them via `composeMermaid(diagram, fragments, { links })`.
- Programmatic callers can inspect `runPipeline(...).rawCode`, `.fragments`, `.links`, and `.trace` to troubleshoot incorrect diagrams or compose custom Mermaid outputs.

## Architecture

```mermaid
flowchart LR
  subgraph Core[Core Pipeline]
    P[Parser Plugins (tree-sitter ready)] --> A1[CFG Analyzer]
    P --> A2[CallGraph Analyzer]
    A1 & A2 --> E[Emitters (Mermaid flow/class/seq)]
    E --> F[Fix Rules Engine]
  end
  subgraph CLI[CLI (Node)]
    FS[File Collector / Ignore] --> P
    F --> OUT[(.mmd/.html)]
  end
  subgraph UI[UI (Browser - future)]
    W[Worker + web-tree-sitter] --> P
    F --> R[Renderer strict]
  end
```

## Packages
- `@diagrammender/types` — IR + analyses types.
- `@diagrammender/parsers-python` — Parser with **tree-sitter (Node)** + fallback.
- `@diagrammender/analyzers` — `cfg.ts` & `calls.ts`.
- `@diagrammender/emitters-mermaid` — Uses analyses to render diagrams.
- `@diagrammender/fix-rules-mermaid-compat` — 6 rules (incl. EnsureParticipants) + registry.
- `@diagrammender/core` — `runPipeline` orchestrator.
- `@diagrammender/renderer-web` — Strict Mermaid wrapper for UI.
- `diagrammender` — CLI.

### Notes
- To enable **tree-sitter** parsing in Node: `npm i tree-sitter tree-sitter-python` in this workspace.
- For browser (future), switch to `web-tree-sitter` and load the WASM grammar in a Worker.
