Module map and recommendations for Autofix_Mermaid

Overview

- Goal: keep the web UI light-weight while wiring modern worker pipelines, RulePack manifests, and repeatable test hooks.
- Current state: UI loads a single entry (`js/main.js`) that initializes panels from `js/app.js` and delegates all heavy work to worker modules.

Current top-level modules

1) frontend/ui (ESM)
   - Files: `index.html`, `js/main.js`, `js/UI.js`, `js/app.js`, `js/Renderer.js`.
   - Responsibility: DOM wiring, docs/config panel management, rule version persistence, status display, export helpers.
   - Notes: `js/app.js` now caches docs/config visibility and RulePack selection via `localStorage` for smoother reloads.

2) rules client/state
   - Files: `js/rules/client.js`, `js/rules/state.js`, `worker.rules-loader.stub.js`, `rules/manifest.json`, `rules/versions/*`.
   - Responsibility: Fetch RulePack/PromptPack JSON via manifest, preprocess Mermaid before render, expose selection metadata to UI and worker payloads.
   - Notes: Manifest-driven selector is reused by UI and worker; AJV schema validation guards malformed packs.

3) workers (classic + module)
   - Files: `js/worker.js`, `js/worker.mjs`, `js/workers/*`, `js/ai/*`, `js/engine/*`.
   - Responsibility: Classic worker hosts legacy pipeline; module worker wraps AI providers. Both accept the rules config injected from UI.
   - Notes: Keep both flavors until browsers fully support module workers without fallbacks.

4) scripts & automation
   - Files: `scripts/run-tests.js`, `scripts/build-packs.mjs`.
   - Responsibility: `npm test` entry that checks layout, runs schema validation & preprocess fixtures; XLSX→JSON pipeline that regenerates packs and updates the manifest.
   - Notes: Ensure CI calls `npm test` so broken packs are caught before shipping.

5) tests
   - Files: `tests/schema-validation.mjs`, `tests/rules-pipeline.mjs`, fixtures under `tests/fixtures/`.
   - Responsibility: Exercise AJV validation against three failing samples and verify preprocess rules mutate representative diagrams.
   - Notes: Additional worker/UI tests can hook into this folder; reuse `scripts/run-tests.js` for orchestration.

6) documentation
   - Files: `README.md`, `README_STAGE3.md`, `docs/*.md`, `docs/legacy/**` (archived assets).
   - Responsibility: User and contributor guides, technical map, archived references.
   - Notes: `docs/legacy/` centralizes historical materials so the root tree stays focused on maintained guides.

Lint, test, and CI
- `package.json` scripts: `npm run lint` (flat-config ESLint) and `npm test` (schema + rules fixtures).
- AJV schema validation runs in both the loader and the test suite; failing packs block merges.

- Goal: make the codebase modular, maintainable, and amenable to incremental migration to TypeScript and CI.
- Approach: keep current behavior while introducing clear module boundaries, minimal build metadata, and lint/test hooks.

Proposed top-level modules

1) frontend/ui (JS, ESM)
   - Files: `index.html`, `js/main.js`, `js/UI.js`, `js/Renderer.js` (legacy prototypes archived under `docs/legacy/ui-prototype/`)
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
   - Files: `js/worker.js`, `js/worker.mjs` (retired classic prototype stored in `docs/legacy/ui-prototype/worker-clean.js`)
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
- Expand worker-side tests (e.g., snapshot expected preprocess output) to cover new rule versions.
- Integrate the `build-packs` script into CI whenever the XLSX source updates.
- Continue shrinking classic worker dependencies so a single module worker can serve modern browsers.
