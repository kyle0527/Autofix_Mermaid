const fs = require('fs/promises');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');

function getLogFilePath() {
  const dateStamp = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `diagrammender-${dateStamp}.log`);
}

async function logMessage(message) {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    const file = getLogFilePath();
    const time = new Date().toISOString();
    await fs.appendFile(file, `[${time}] ${message}\n`, 'utf8');
    return file;
  } catch (err) {
    console.error(`Failed to log message: ${err.message}`);
    throw err;
  }
}

if (require.main === module) {
  (async () => {
    try {
      const file = await logMessage('Sample log entry');
      console.log(`Logged to ${file}`);
    } catch (err) {
      console.error('Logging failed', err);
    }
  })();
}

module.exports = { logMessage, getLogFilePath };
