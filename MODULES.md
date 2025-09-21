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

Next steps
- Expand worker-side tests (e.g., snapshot expected preprocess output) to cover new rule versions.
- Integrate the `build-packs` script into CI whenever the XLSX source updates.
- Continue shrinking classic worker dependencies so a single module worker can serve modern browsers.
