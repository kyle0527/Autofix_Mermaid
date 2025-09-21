# data/

Persist structured records in JSON format.

## Guidelines
- Daily files follow `records-YYYY-MM-DD.json`
- Each file stores an array; entries include a `time` field in ISO format
- Use `npm run store` or `node scripts/dataStore.js` to write records
- Do not commit generated data files; only `.gitkeep` remains in Git
- Sanitize any sensitive information before storing
