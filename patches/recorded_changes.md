# Recorded Changes

- Date: 2025-09-16
- Author: automated-assistant (recorded by the assistant per user request)

## Changes applied

1. File modified: `js/app.js`
   - Change summary: Adjusted `render()` to avoid forcibly overwriting the editor on each render, surfaced `applyFixes` notes into the `errors` panel, and made `mermaid.render` result handling robust to accept either a string (svg) or an object `{ svg }`.
   - Patch file (non-applied suggestion): `patches/suggested_js_app_patch.diff` (created prior to applying changes).

## Verification
- After applying the patch, the file `js/app.js` was re-read and validated for the change. Lint warnings for unused `notes` were resolved by displaying notes in `errors`.

## Rationale
- Prevent runtime exceptions when `mermaid.render` returns a plain string in some bundlings/versions.
- Prevent surprising UX where a preview operation mutates the editor content each render.

## Next recommended actions
- Review `autofix.js`, `layout.js`, and `sanitize.js` for any API usage that needs harmonizing. (A cursory read was performed and no immediate `mermaid.render` calls were found inside those files; main changes were in `js/app.js`.)
- Run a local smoke test: open `index.html` in a browser and test the render/autofix buttons with a sample diagram.
- Optionally add a small unit test for `applyFixes` behavior (normalization/notes generation).

## Files created/edited during this session
- `patches/suggested_js_app_patch.diff` (created)
- `js/app.js` (modified)
- `patches/recorded_changes.md` (created)

