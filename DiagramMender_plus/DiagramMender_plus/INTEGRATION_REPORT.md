
# DiagramMender + AutoFix Mermaid Integration (v0.3.0)

This repo merges **DiagramMender** (base) with **AutoFix Mermaid** engine packages.

## What was integrated
- Upgraded packages to AutoFix v0.3.0:
  - @diagrammender/core
  - @diagrammender/fix-rules-mermaid-compat
  - @diagrammender/renderer-web
  - @diagrammender/parsers-python
  - @diagrammender/cli (from AutoFix CLI; renamed and patched)
  - @diagrammender/types (new)
  - @diagrammender/analyzers (new)
  - @diagrammender/emitters/* (new, if present)

## Workspace adjustments
- All internal @diagrammender/* deps are set to **workspace:** to ensure local resolution.
- Root workspaces cover `packages/*` and `packages/*/*`.
- Added root scripts: `install`, `build`, `dev`, `cli` (see package.json).

## How to use
1. Install:
   ```bash
   npm install
   ```
2. Build packages (if packages expose build scripts):
   ```bash
   npm run build
   ```
3. Run CLI:
   ```bash
   npx diagrammender --help
   ```
4. Dev UI (if applicable):
   ```bash
   npm run dev
   ```

## Notes & Manual Follow-ups
- If any of the packages lack a `build` script, you may need to add a `tsconfig.json` and `build` script to compile TS to `dist/`.
- Ensure Node.js ≥ 18.
- If duplicated assets or configs exist, prefer v0.3.0 versions.



# Integration Report (Python tools) — 2025-09-20 20:33:45 UTC

## Summary
- Implemented working `py2mermaid.py` (Mermaid generator from Python AST).
- Added `py2mermaid_v2.py` (MD/MMD/HTML outputs; offline HTML preview with inlined mermaid JS).
- Added `run_v3_then_combine.py` wrapper.
- Repaired broken Python tests under `packages/parsers/python/test`:
  - Implemented `index.py` with `parsePythonProject` for unit tests.
  - Rewrote `test_ir_basic.py` to be executable without pytest.

## Notes
- Node/TS packages remain unchanged (offline environment cannot install devDependencies). Python tools are fully functional.
- Mermaid syntax is auto-mended to avoid trivial rendering issues.
