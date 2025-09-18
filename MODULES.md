Module map and recommendations for Autofix_Mermaid

Overview
- Goal: make the codebase modular, maintainable, and amenable to incremental migration to TypeScript and CI.
- Approach: keep current behavior while introducing clear module boundaries, minimal build metadata, and lint/test hooks.

Proposed top-level modules

1) frontend/ui (JS, ESM)
   - Files: `index.html`, `js/main.js`, `js/UI.js`, `js/UI-clean.js`, `js/Renderer.js`
   - Responsibility: DOM, user interactions, event wiring, render triggering
   - Notes: prefer ESM; isolate DOM helpers; unit-test UI logic with jsdom

2) renderer (JS, ESM)
   - Files: `js/Renderer.js`, `js/emitters/mermaid.js`, `js/vendor/mermaid*.js`
   - Responsibility: Mermaid initialization and svg->png
   - Notes: keep as browser-targeted ESM

3) ai (JS, ESM or UMD for worker importScripts)
   - Files: `js/ai/*` and `js/ai/providers/*` and `js/ai/providerRegistry.js`
   - Responsibility: AI provider registry, provider adapters (none/ollama/webllm), ai-assist logic
   - Notes: providers are currently UMD-style IIFE for worker importScripts compatibility; consider moving to ESM adapters + a tiny compatibility shim for worker

4) worker (mix: classic worker + module worker)
   - Files: `js/worker.js`, `js/worker.mjs`, `js/worker-clean.js`
   - Responsibility: offload heavy tasks, parsing, AI orchestration
   - Notes: keep both flavors for compatibility; gradually unify to ESM worker if browser support allows or provide a build step that outputs both

5) engine/core (TS/JS library)
   - Files: `engine-src/packages/*` and `js/engine*` wrappers
   - Responsibility: main pipeline, rule engine, IR, analyzers
   - Notes: this is already structured as packages; ideal to keep in TypeScript for strong types

6) models (static JSON)
   - Files: `js/models/*`
   - Responsibility: rules_v1.json, knowledge_index_v1.json, qa_templates_v1.json

Compatibility shim
- Provide `js/ai/compat.js` that exports ESM wrapper and registers providers in worker global for importScripts.
- The wrapper allows ESM imports in `worker.mjs` but keeps `aiEngine.js` compatibility for classic worker.

Lint, test, and CI suggestions
- Add `package.json` with scripts: start (local server), lint (eslint), test (node + jest or vitest)
- Add `eslint.config.js` or .eslintrc that matches existing style (there is an `eslint.config.js` already).
- Add simple unit tests for `ai-assist` and `providerRegistry` using node-fetch mock or jsdom worker shim.

Migration plan (phased)
- Phase 0 (safe): Add `package.json`, docs (MODULES.md), lint scripts; small bugfixes (already done: ai-assist path)
- Phase 1: Extract `ai` into clean ESM module and add compatibility shim; add small unit tests
- Phase 2: Convert UI/Renderer to TypeScript (incremental) and add CI pipeline
- Phase 3: Unify workers to ESM and add build step that outputs `worker.js` (UMD) and `worker.mjs` (ESM)

Risk assessment
- Low risk: adding metadata, docs, lint scripts
- Medium risk: refactoring providers to ESM may break classic worker importScripts flows; mitigate with compatibility shim
- High risk: converting workers to a single flavor without a build tool; prefer a build step

Next steps
- Add package.json and basic scripts (done in this iteration)
- Add small unit tests and CI scaffold (optional)
- Start Phase 1 refactor of AI providers to ESM with compatibility shim
