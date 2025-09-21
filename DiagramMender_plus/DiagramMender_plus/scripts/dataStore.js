const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function getDataFilePath() {
  const dateStamp = new Date().toISOString().slice(0, 10);
  return path.join(DATA_DIR, `records-${dateStamp}.json`);
}

async function saveRecord(record) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const file = getDataFilePath();
    let data = [];
    try {
      const contents = await fs.readFile(file, 'utf8');
      data = JSON.parse(contents);
    } catch (err) {
      // ignore read/parse errors and start fresh
    }
    data.push({ time: new Date().toISOString(), ...record });
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
    return file;
  } catch (err) {
    console.error(`Failed to save record: ${err.message}`);
    throw err;
  }
}

if (require.main === module) {
  (async () => {
    try {
      const file = await saveRecord({ message: 'Sample data record' });
      console.log(`Saved to ${file}`);
    } catch (err) {
      console.error('Saving failed', err);
    }
  })();
}

module.exports = { saveRecord, getDataFilePath };
