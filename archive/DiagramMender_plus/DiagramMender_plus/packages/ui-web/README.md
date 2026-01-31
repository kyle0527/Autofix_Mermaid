# DiagramMender • UI (Web)

A static ESM demo that:
- parses a Python project (best-effort, client-side) to produce Mermaid diagrams,
- auto-refines Mermaid syntax,
- renders the output for preview.

This is a transitional package while we refactor into the `core/parsers/fix-rules/renderer` architecture.

## Dependencies

The web UI relies on:

- [`dompurify`](https://github.com/cure53/DOMPurify) for sanitizing rendered SVG
- [`p-limit`](https://github.com/sindresorhus/p-limit) to throttle concurrent file analysis
- `@diagrammender/fix-rules-mermaid-compat` for compatible Mermaid syntax fixes
\n\n> 更新：已加入多 CDN 載入與 DOMPurify 延遲載入，避免前端因單一 CDN 失效而白屏。\n