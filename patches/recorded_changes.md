# Archived: patches/recorded_changes.md

This file was archived on 2025-09-16 and moved to `doc/archive/recorded_changes.md`.

If you need the original content, please open the archived copy in `doc/archive/`.

-- archived by automated assistant
   - js/UI-clean.js
   - js/ai/aiEngine.js
   - js/ai/providers/none.js
   - js/ai/providers/ollama.js
   - js/ai/providers/webllm.js
   - js/autofix.js
   - js/autofixProvider.js
   - js/emitters/mermaid.js
   - js/engine-esm.js
   - js/engine.js
   - js/engine/ai.js
   - js/engine/rules.js
   - js/exporters/csv.js
   - js/exporters/xlsx.js
   - js/main.js
   - js/parsers/python-heuristic.js
   - js/parsers/python-wts.js
   - js/rules/applyRules.js
   - js/tests/run.js
   - js/worker.mjs

- Revert instructions (one-liner per file):
   - git checkout origin/main -- <path/to/file>
   - git commit -m "revert: restore <path/to/file> to origin/main" && git push

- Suggested workflow to properly resolve (preferred):
   1. Create a tracking issue: "tech-debt: revert eslint triage marks and properly remove unused code" and assign to maintainer.
   2. For each file, determine whether the declared-but-unused symbol should be:
       - Removed (dead code), or
       - Restored by wiring the missing use, or
       - Kept but documented as part of the public API (then make it used), or
       - Converted to an explicit underscore-prefixed intentionally-unused variable with comment and left for future cleanup.
   3. Implement changes in small PRs (1–3 files per PR), with unit tests where applicable.

- Priority: High — next person to touch lint config or make feature changes should revert these triage marks first.

## Verification

## Rationale

## Next recommended actions

## Files created/edited during this session
- Review `autofix.js`, `layout.js`, and `sanitize.js` for any API usage that needs harmonizing. (A cursory read was performed and no immediate `mermaid.render` calls were found inside those files; main changes were in `js/app.js`.)

