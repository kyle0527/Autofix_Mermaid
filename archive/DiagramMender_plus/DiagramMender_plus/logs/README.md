# logs/

This directory stores plain-text run logs.

## Guidelines
- Files are named `diagrammender-YYYY-MM-DD.log` (one file per day)
- Each log entry must start with an ISO timestamp: `[YYYY-MM-DDTHH:mm:ss.sssZ]`
- Use `npm run log` or `node scripts/logger.js` to append entries
- Keep log files out of version control; only `.gitkeep` remains tracked
- Rotate or delete old logs as needed for your environment
