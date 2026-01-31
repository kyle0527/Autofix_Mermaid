# scripts/

Utility Node.js scripts for development and maintenance.

## Guidelines
- Written in CommonJS (`require`/`module.exports`) targeting Node 18+
- Avoid third-party dependencies; rely on the standard library
- Provide a short comment at the top explaining the script's purpose
- Expose reusable functions and run side-effects only when executed directly (`if (require.main === module)`)
- Add an npm script in `package.json` when a script should be invoked via `npm run`
